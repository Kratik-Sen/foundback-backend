import { ApiError } from '../utils/ApiError.js';

export function notFound(req, _res, next) {
  next(new ApiError(404, `Route ${req.method} ${req.originalUrl} was not found`));
}

export function errorHandler(error, _req, res, _next) {
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Unexpected server error';

  if (error.name === 'ValidationError') {
    statusCode = 422;
    message = Object.values(error.errors).map((entry) => entry.message).join(', ');
  }
  if (error.code === 11000) {
    statusCode = 409;
    message = `A record already exists for ${Object.keys(error.keyPattern || {}).join(', ')}`;
  }
  if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid resource identifier';
  }
  if (error.name === 'MulterError') {
    statusCode = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = error.code === 'LIMIT_FILE_SIZE' ? 'An uploaded image exceeds the configured size limit' : `Image upload failed: ${error.message}`;
  }
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Your session is invalid or has expired';
  }

  if (process.env.NODE_ENV !== 'test' && statusCode >= 500) console.error(error);
  res.status(statusCode).json({
    success: false,
    message,
    ...(error.details ? { errors: error.details } : {}),
    ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {}),
  });
}
