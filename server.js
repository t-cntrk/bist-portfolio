require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const { getBaseUrl, getAllowedOrigins } = require('./utils/envConfig');

if (process.env.NODE_ENV === 'production') {
  const secret = process.env.JWT_SECRET;
  if (!secret || typeof secret !== 'string' || secret.length < 16) {
    console.error('FATAL: In production, JWT_SECRET must be set and at least 16 characters.');
    process.exit(1);
  }
  // COOKIE_SECRET signs the CSRF session cookie; a weak/default value makes the
  // session forgeable, so enforce it just like JWT_SECRET.
  const cookieSecret = process.env.COOKIE_SECRET;
  if (!cookieSecret || typeof cookieSecret !== 'string' || cookieSecret.length < 16) {
    console.error('FATAL: In production, COOKIE_SECRET must be set and at least 16 characters.');
    process.exit(1);
  }
} else if (!process.env.JWT_SECRET) {
  // Dev convenience: without this, jwt.sign(payload, undefined) throws and login
  // 500s on a fresh checkout that forgot to set JWT_SECRET. Never used in prod
  // (the block above hard-fails there instead).
  process.env.JWT_SECRET = 'dev-only-insecure-jwt-secret-change-me';
  console.warn('⚠️  JWT_SECRET not set — using an insecure development default. Set JWT_SECRET in .env for real use.');
}

// Import services and middleware
const { initializeDatabase, shutdownDatabase } = require('./services/databaseService');
const { testEmail } = require('./services/emailService');
const { 
  generateCSRFToken, 
  csrfTokens, 
  securityHeaders, 
  enforceHTTPS, 
  contentSecurityPolicy, 
  handleCSPViolation, 
  errorLogging,
  generalLimiter
} = require('./middleware/securityMiddleware');
const { errorMiddleware } = require('./utils/errorHandler');

// Import routes
const authController = require('./controllers/authController');
const authRoutes = require('./routes/authRoutes');

// Conditional import for optional routes
let stockRoutes, portfolioRoutes;
try {
  stockRoutes = require('./routes/stockRoutes');
} catch (err) {
  console.warn('⚠️  stockRoutes.js not found - stock endpoints disabled');
  stockRoutes = null;
}

try {
  portfolioRoutes = require('./routes/portfolioRoutes');
} catch (err) {
  console.warn('⚠️  portfolioRoutes.js not found - portfolio endpoints disabled');
  portfolioRoutes = null;
}

const app = express();
const PORT = process.env.PORT || 3100;

// Trust the first proxy hop (nginx / Docker ingress / Vercel) so req.secure and
// client IPs (used by rate limiting) are evaluated correctly behind a proxy.
// Only in production: trusting XFF when NOT behind a proxy would let clients
// spoof their IP and bypass per-IP rate limits.
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);

const allowedOrigins = getAllowedOrigins();

console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Base URL:', getBaseUrl());
console.log('Allowed Origins:', allowedOrigins);

// CORS configuration
const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn('CORS blocked origin:', origin);
      // Do not throw an error here - let our own middleware handle the rejection
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token']
};

// Apply middleware
app.use(cors(corsOptions));

// Explicitly reject disallowed CORS origins with 403 (security test expects this behavior)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ message: 'CORS blocked' });
  }
  next();
});

// Ensure CORS middleware errors (from the cors package) return 403 instead of 500
app.use((err, req, res, next) => {
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'CORS blocked' });
  }
  next(err);
});

// Signed cookies for CSRF session integrity
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'dev-cookie-secret';
app.use(cookieParser(COOKIE_SECRET));

// Body parsers. 1mb is ample for this API's JSON payloads (auth, portfolio,
// CSP/error reports); the old 10mb limit was needless DoS surface on the
// unauthenticated endpoints.
app.use(express.json({ limit: '1mb', type: ['application/json', 'application/csp-report'] }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Security middleware
app.use(securityHeaders);
app.use(enforceHTTPS);
app.use(contentSecurityPolicy);
app.use(errorLogging);

// Static files with cache busting for CSS
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Last-Modified', new Date().toUTCString());
    }
  }
}));

// ============================================
// BASIC ROUTES
// ============================================

// Favicon handler (prevent 404)
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Chrome DevTools well-known endpoint (prevent 404)
app.get('/.well-known/*', (req, res) => {
  res.status(204).end();
});

// Root route - serve main HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// SECURITY & UTILITY ENDPOINTS
// ============================================

// CSRF token generation
app.get('/api/csrf-token', generalLimiter, (req, res) => {
  const token = generateCSRFToken();
  const sessionId = (req.signedCookies && req.signedCookies.sessionId) || 
                    req.cookies.sessionId || 
                    require('crypto').randomBytes(16).toString('hex');
  
  csrfTokens.set(sessionId, { token, timestamp: Date.now() });
  
  // Set session cookie if doesn't exist
  if (!req.signedCookies || !req.signedCookies.sessionId) {
    res.cookie('sessionId', sessionId, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      signed: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
  }
  
  res.json({ csrfToken: token });
});

// CSP violation report handler
app.post('/csp-violation-report', handleCSPViolation);

// CSP report endpoint with filtering
app.post('/api/csp-report', (req, res) => {
  const report = req.body;
  
  // Filter invalid/false-positive reports
  if (!report['document-uri'] || !report['violated-directive']) {
    console.log('🔍 Filtered invalid CSP report:', {
      timestamp: new Date().toISOString(),
      report: report
    });
    return res.status(204).end();
  }
  
  // Log real CSP violations
  console.warn('🚨 CSP VIOLATION:', {
    timestamp: new Date().toISOString(),
    documentUri: report['document-uri'],
    violatedDirective: report['violated-directive'],
    blockedUri: report['blocked-uri'],
    userAgent: req.headers['user-agent']
  });
  
  res.status(204).end();
});

// Client-side error logging
app.post('/api/error-log', generalLimiter, (req, res) => {
  try {
    const errorLog = req.body;
    
    if (!errorLog || !errorLog.timestamp) {
      return res.status(400).json({ error: 'Invalid error log data' });
    }
    
    // Log errors in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Client Error Log:', errorLog);
    }
    
    // In production, implement external logging service
    if (process.env.NODE_ENV === 'production') {
      console.error('Production Error Log:', {
        timestamp: errorLog.timestamp,
        message: errorLog.message,
        userId: errorLog.userId,
        url: errorLog.url
      });
    }
    
    res.json({ success: true, message: 'Error logged successfully' });
  } catch (error) {
    console.error('Error logging endpoint error:', error);
    res.status(500).json({ error: 'Failed to log error' });
  }
});

// ============================================
// TESTING & DEBUG ENDPOINTS (DEV ONLY)
// ============================================

// Health check and email test are dev-only (avoid info disclosure / abuse in prod)
if (process.env.NODE_ENV !== 'production') {
  app.get('/test', (req, res) => {
    res.json({
      message: 'Server is working!',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  });

  app.get('/test-email', async (req, res) => {
    try {
      const result = await testEmail();
      res.json(result);
    } catch (error) {
      console.error('Email test error:', error);
      res.status(500).json({
        error: 'Email sending failed',
        details: error.message
      });
    }
  });
}

// Token debug endpoint (development only)
if (process.env.NODE_ENV === 'development') {
  app.get('/debug-tokens', (req, res) => {
    const { getConnection } = require('./services/databaseService');
    const db = getConnection();
    
    db.all(
      'SELECT id, username, email, verification_token, token_expires, datetime(token_expires/1000, "unixepoch") as expires_date FROM users WHERE verification_token IS NOT NULL', 
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        const currentTime = Date.now();
        const tokens = rows.map(row => ({
          id: row.id,
          username: row.username,
          email: row.email,
          token: row.verification_token ? row.verification_token.substring(0, 10) + '...' : null,
          expires: row.token_expires,
          expiresDate: row.expires_date,
          isValid: row.token_expires > currentTime,
          timeLeftMinutes: row.token_expires > currentTime 
            ? Math.floor((row.token_expires - currentTime) / (1000 * 60)) 
            : 0
        }));
        
        res.json({
          currentTime: new Date(currentTime).toISOString(),
          tokens: tokens
        });
      }
    );
  });
}

// ============================================
// EMAIL VERIFICATION & PASSWORD RESET
// ============================================

// Email verification handler (logic lives in authController.verifyEmail)
app.get('/verify-email', authController.verifyEmail);

// Password reset page (logic lives in authController.resetPasswordPage)
app.get('/reset-password', authController.resetPasswordPage);

// Password-change page (from email link; logic in authController.passwordChangePage)
app.get('/verify-password-change', authController.passwordChangePage);

// Account-deletion confirmation page (from email link)
app.get('/verify-account-deletion', authController.accountDeletionPage);

// ============================================
// API ROUTES
// ============================================

// Authentication routes (always available)
app.use('/api/auth', authRoutes);

// Stock routes (optional)
if (stockRoutes) {
  app.use('/api', stockRoutes);
}

// Portfolio routes (optional)
if (portfolioRoutes) {
  app.use('/api', portfolioRoutes);
}

// ============================================
// ERROR HANDLING
// ============================================

// Global error handler
app.use(errorMiddleware);

// 404 handler for undefined routes
app.use((req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('404 Not found:', req.method, req.url);
  }
  res.status(404).json({ message: 'Endpoint not found' });
});

// ============================================
// DATABASE & SERVER INITIALIZATION
// ============================================

// Initialize database
const db = initializeDatabase();

// Graceful shutdown handler (SIGINT = Ctrl+C, SIGTERM = Docker/K8s stop)
function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  // Stop accepting new connections, then close DB and exit
  if (typeof server !== 'undefined' && server.close) {
    server.close(() => {
      shutdownDatabase();
      process.exit(0);
    });
    // Force-exit if connections linger too long
    setTimeout(() => {
      shutdownDatabase();
      process.exit(0);
    }, 10000).unref();
  } else {
    shutdownDatabase();
    process.exit(0);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start server (handle port-in-use so it doesn't throw unhandled)
const server = app.listen(PORT, () => {
  console.log(`\n✅ Server running on http://localhost:${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Base URL: ${getBaseUrl()}`);
  console.log(`📁 Structure: Modular (routes/, services/, middleware/, utils/)`);
  console.log(`🔒 Security: CORS, CSP, Rate Limiting, HTTPS enforcement`);
  console.log(`📊 Database: SQLite with connection pooling`);
  console.log(`📧 Email: Nodemailer with template support\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use.`);
    console.error('   Stop the other process using this port, or set PORT to a different number (e.g. PORT=3001 node server.js).\n');
    process.exit(1);
  }
  throw err;
});
