import { ApiError } from '../utils/ApiError.js';

export function notFound(req, _res, next) {
  next(new ApiError(404, 'The requested information was not found'));
}

function readableField(path = 'field') {
  return String(path)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .trim()
    .replace(/^./, (character) => character.toUpperCase());
}

function validationMessage(entry) {
  const label = readableField(entry.path);
  if (entry.name === 'CastError') return `Enter a valid value for ${label.toLowerCase()}`;
  if (entry.kind === 'required') return `${label} is required`;
  return entry.message || `Check the value entered for ${label.toLowerCase()}`;
}

export function errorHandler(error, _req, res, _next) {
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Unexpected server error';

  if (error.name === 'ValidationError') {
    statusCode = 422;
    message = Object.values(error.errors).map(validationMessage).join(', ');
  }
  if (error.code === 11000) {
    statusCode = 409;
    message = 'An account or record with these details already exists';
  }
  if (error.name === 'CastError') {
    statusCode = 400;
    message = 'The requested information could not be found';
  }
  if (error.name === 'MulterError') {
    statusCode = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = error.code === 'LIMIT_FILE_SIZE'
      ? 'The selected image is too large'
      : 'The image could not be uploaded. Please choose another image and try again.';
  }
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Your session has expired. Please sign in again.';
  }

  if (statusCode >= 500) message = 'Something went wrong. Please try again in a moment.';

  if (process.env.NODE_ENV !== 'test' && statusCode >= 500) console.error(error);
  res.status(statusCode).json({
    success: false,
    message,
    ...(error.details ? { errors: error.details } : {}),
    ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {}),
  });
}
