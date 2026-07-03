// Custom API Error class. Kept because errorMiddleware below uses `instanceof`
// to recognise it; safe to construct from anywhere that wants a typed HTTP error.
class CustomAPIError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'CustomAPIError';
  }
}

// Express error-handling middleware (registered last in server.js). This is the
// only export consumed elsewhere in the app.
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

module.exports = {
  CustomAPIError,
  errorMiddleware
};
