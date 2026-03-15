// Custom API Error class
class CustomAPIError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'CustomAPIError';
  }
}

// Error middleware for Express
const errorMiddleware = (err, req, res, next) => {
  console.error('Error middleware caught:', err);
  
  if (err instanceof CustomAPIError) {
    return res.status(err.statusCode).json({ 
      error: 'API_ERROR',
      message: err.message 
    });
  }
  
  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'VALIDATION_ERROR',
      message: 'Geçersiz veri formatı',
      details: err.message 
    });
  }
  
  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ 
      error: 'AUTH_ERROR',
      message: 'Geçersiz token' 
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ 
      error: 'AUTH_ERROR',
      message: 'Token süresi dolmuş' 
    });
  }
  
  // Handle database errors
  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(400).json({ 
      error: 'DATABASE_ERROR',
      message: 'Veri kısıtlaması hatası' 
    });
  }
  
  // Handle rate limiting errors
  if (err.status === 429) {
    return res.status(429).json({ 
      error: 'RATE_LIMIT_ERROR',
      message: 'Çok fazla istek, lütfen bekleyin' 
    });
  }
  
  // Default error response (maintains backward compatibility)
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Sunucu hatası';
  
  // Log error for debugging
  console.error('Unhandled error:', {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    statusCode,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });
  
  // Send error response
  return res.status(statusCode).json({ 
    error: 'SERVER_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'Sunucu hatası' : message
  });
};

// Async error wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Error logging utility
const logError = (error, context = {}) => {
  const errorLog = {
    timestamp: new Date().toISOString(),
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    context,
    environment: process.env.NODE_ENV
  };
  
  console.error('Error logged:', errorLog);
  
  // In production, you might want to send to external logging service
  if (process.env.NODE_ENV === 'production') {
    // TODO: Implement production error logging
    // Example: sendToLoggingService(errorLog);
  }
  
  return errorLog;
};

// Validation error helper
const createValidationError = (field, message) => {
  return new CustomAPIError(`${field}: ${message}`, 400);
};

// Database error helper
const createDatabaseError = (operation, details) => {
  return new CustomAPIError(`${operation} işlemi başarısız: ${details}`, 500);
};

// Authentication error helper
const createAuthError = (message) => {
  return new CustomAPIError(message, 401);
};

// Authorization error helper
const createForbiddenError = (message) => {
  return new CustomAPIError(message, 403);
};

// Not found error helper
const createNotFoundError = (resource) => {
  return new CustomAPIError(`${resource} bulunamadı`, 404);
};

// Rate limit error helper
const createRateLimitError = (message) => {
  return new CustomAPIError(message, 429);
};

module.exports = {
  CustomAPIError,
  errorMiddleware,
  asyncHandler,
  logError,
  createValidationError,
  createDatabaseError,
  createAuthError,
  createForbiddenError,
  createNotFoundError,
  createRateLimitError
}; 