const config = require('../config');

/**
 * Global error handler middleware.
 * Catches all unhandled errors, logs them, and returns appropriate responses.
 */
function errorHandler(err, req, res, _next) {
  // Log the error
  console.error(`[${new Date().toISOString()}] Error:`, err.message);
  if (config.nodeEnv === 'development') {
    console.error(err.stack);
  }

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Build response
  const response = {
    error: err.message || 'Internal server error',
  };

  // Include stack trace only in development
  if (config.nodeEnv === 'development') {
    response.stack = err.stack;
  }

  // Handle specific error types
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    response.error = 'A record with this value already exists.';
    return res.status(409).json(response);
  }

  if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    response.error = 'Referenced record does not exist.';
    return res.status(400).json(response);
  }

  if (err.type === 'entity.parse.failed') {
    response.error = 'Invalid JSON in request body.';
    return res.status(400).json(response);
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    response.error = 'File too large.';
    return res.status(413).json(response);
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
