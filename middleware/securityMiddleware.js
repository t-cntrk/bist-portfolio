const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { getBaseUrl } = require('../utils/envConfig');

// ============================================
// VALIDATION RESULT HANDLER
// ============================================

// Returns the first express-validator error (if any) as { message }.
// Apply AFTER body(...) validators on a route.
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: errors.array()[0].msg,
      errors: errors.array()
    });
  }
  next();
}

const JWT_SECRET = process.env.JWT_SECRET;

// ============================================
// CSRF PROTECTION
// ============================================

// Session-based CSRF token storage
const csrfTokens = new Map();

// Clean up old CSRF tokens every hour. unref() so this timer never keeps the
// process (or a Jest run) alive on its own.
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, tokenData] of csrfTokens.entries()) {
    if (now - tokenData.timestamp > 24 * 60 * 60 * 1000) { // 24 hours
      csrfTokens.delete(sessionId);
    }
  }
}, 60 * 60 * 1000).unref();

// Generate CSRF token
function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

// CSRF validation middleware
function validateCSRF(req, res, next) {
  const sessionId = (req.signedCookies && req.signedCookies.sessionId) || req.cookies.sessionId;
  const token = req.headers['x-csrf-token'] || req.body.csrfToken;

  if (!sessionId || !token) {
    return res.status(403).json({ message: 'CSRF token required' });
  }

  const storedTokenData = csrfTokens.get(sessionId);
  if (!storedTokenData || storedTokenData.token !== token) {
    return res.status(403).json({ message: 'Invalid CSRF token' });
  }

  next();
}

// ============================================
// RATE LIMITING
// ============================================

// Yahoo Finance API rate limiter
const yahooLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Max 30 requests per minute
  message: { message: 'Çok fazla istek gönderildi, lütfen 1 dakika bekleyin.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false
});

// Chart data rate limiter
const chartLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Max 20 chart requests per minute
  message: { message: 'Çok fazla grafik isteği gönderildi, lütfen 1 dakika bekleyin.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Authentication endpoints rate limiter (stricter)
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Max 5 login/register attempts per minute
  message: { message: 'Çok fazla deneme yapıldı, lütfen 1 dakika sonra tekrar deneyin.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Forgot password rate limiter
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // Max 3 password reset requests per minute
  message: { message: 'Çok fazla şifre sıfırlama isteği, lütfen 1 dakika sonra tekrar deneyin.' },
  standardHeaders: true,
  legacyHeaders: false
});

// General-purpose limiter for unauthenticated utility endpoints (CSRF token
// issuance, client error logging). Caps abuse / memory-growth from clients that
// hammer these without a session.
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Max 60 requests per minute per IP
  message: { message: 'Çok fazla istek gönderildi, lütfen kısa bir süre sonra tekrar deneyin.' },
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================
// JWT AUTHENTICATION
// ============================================

// JWT authentication middleware - reads token from HttpOnly cookie
function authenticateToken(req, res, next) {
  // Get token from HttpOnly cookie (NOT from Authorization header)
  const token = req.cookies.authToken;
  
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { username, id }
    next();
  } catch (err) {
    console.error('JWT verification error:', err.name);
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired, please login again' });
    }
    
    if (err.name === 'JsonWebTokenError') {
      return res.status(403).json({ message: 'Invalid token' });
    }
    
    return res.status(403).json({ message: 'Token verification failed' });
  }
}

// ============================================
// SECURITY HEADERS
// ============================================

// Apply standard security headers
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}

// HTTPS enforcement (production only)
function enforceHTTPS(req, res, next) {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    // Build the redirect from the trusted configured base URL, NOT the
    // attacker-controllable Host header (prevents host-header injection /
    // open redirect on the 301).
    const base = getBaseUrl().replace(/^http:\/\//, 'https://').replace(/\/+$/, '');
    return res.redirect(301, base + req.url);
  }
  next();
}

// Content Security Policy
function contentSecurityPolicy(req, res, next) {
  const cspString = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' cdnjs.cloudflare.com cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' fonts.googleapis.com cdn.jsdelivr.net",
    "img-src 'self' data: https: *.yahoo.com",
    "connect-src 'self' *.yahoo.com cdn.jsdelivr.net cdnjs.cloudflare.com",
    "font-src 'self' fonts.gstatic.com",
    "object-src 'none'",
    "media-src 'self'",
    "frame-src 'none'",
    "report-uri /csp-violation-report"
  ].join('; ');

  res.setHeader('Content-Security-Policy', cspString);
  next();
}

// CSP violation report handler
function handleCSPViolation(req, res) {
  try {
    const report = req.body;
    
    // Filter invalid reports
    if (!report || !report['csp-report'] || !report['csp-report']['document-uri']) {
      console.log('🔍 Invalid CSP report filtered:', {
        timestamp: new Date().toISOString(),
        report: report
      });
      return res.status(204).end();
    }
    
    const cspReport = report['csp-report'];
    
    // Filter Chrome DevTools false positives
    if (cspReport['document-uri'] === 'undefined' || 
        cspReport['violated-directive'] === 'undefined' ||
        cspReport['document-uri'].includes('chrome-devtools') ||
        cspReport['document-uri'].includes('devtools')) {
      console.log('🔍 Chrome DevTools CSP report filtered');
      return res.status(204).end();
    }
    
    // Log real CSP violations
    console.warn('🚨 CSP VIOLATION:', {
      timestamp: new Date().toISOString(),
      documentUri: cspReport['document-uri'],
      violatedDirective: cspReport['violated-directive'],
      blockedUri: cspReport['blocked-uri'],
      userAgent: req.headers['user-agent']
    });
    
    res.status(204).end();
  } catch (error) {
    console.error('CSP report handling error:', error);
    res.status(204).end();
  }
}

// ============================================
// ERROR LOGGING
// ============================================

// Log API errors (4xx, 5xx responses) – skip expected auth failures
function errorLogging(req, res, next) {
  res.on('finish', () => {
    if (res.statusCode < 400) return;
    if (req.path && req.path.startsWith('/.well-known/')) return;

    // 401 on login/register = wrong credentials or unverified email (expected)
    const pathOrUrl = req.originalUrl || req.url || req.path || '';
    if (res.statusCode === 401 && /auth\/(login|register)/.test(pathOrUrl)) return;

    console.error('API Error:', {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
  });
  next();
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // CSRF
  generateCSRFToken,
  validateCSRF,
  csrfTokens,

  // Validation
  handleValidationErrors,
  
  // Rate Limiters
  yahooLimiter,
  chartLimiter,
  authLimiter,
  forgotPasswordLimiter,
  generalLimiter,
  
  // Authentication
  authenticateToken,
  
  // Security Headers
  securityHeaders,
  enforceHTTPS,
  contentSecurityPolicy,
  handleCSPViolation,
  
  // Logging
  errorLogging
};