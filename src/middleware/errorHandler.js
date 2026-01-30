const logger = require("../utils/logger");
const config = require("../config");

/**
 * Custom Application Error Class
 */
class AppError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;
    this.errors = errors;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handle Mongoose Validation Errors
 */
const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map((error) => ({
    field: error.path,
    message: error.message,
  }));

  return new AppError("Validation failed", 400, errors);
};

/**
 * Handle Mongoose Duplicate Key Errors
 */
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];

  return new AppError(
    `Duplicate value for field '${field}': ${value}. Please use another value.`,
    409,
  );
};

/**
 * Handle Mongoose Cast Errors
 */
const handleCastError = (err) => {
  return new AppError(`Invalid ${err.path}: ${err.value}`, 400);
};

/**
 * Handle JWT Errors
 */
const handleJWTError = () => {
  return new AppError("Invalid token. Please login again.", 401);
};

const handleJWTExpiredError = () => {
  return new AppError("Your token has expired. Please login again.", 401);
};

/**
 * Send Error Response in Development
 */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    message: err.message,
    error: err,
    stack: err.stack,
    errors: err.errors,
  });
};

/**
 * Send Error Response in Production
 */
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  } else {
    // Programming or unknown error: don't leak error details
    logger.error("ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again later.",
    });
  }
};

/**
 * Global Error Handler Middleware
 */
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  // Log error
  if (err.statusCode >= 500) {
    logger.error("Server Error:", {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      user: req.user?.email,
    });
  } else {
    logger.warn("Client Error:", {
      message: err.message,
      url: req.originalUrl,
      method: req.method,
      statusCode: err.statusCode,
      user: req.user?.email,
    });
  }

  if (config.env === "development") {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Handle specific error types
    if (err.name === "ValidationError") error = handleValidationError(err);
    if (err.code === 11000) error = handleDuplicateKeyError(err);
    if (err.name === "CastError") error = handleCastError(err);
    if (err.name === "JsonWebTokenError") error = handleJWTError();
    if (err.name === "TokenExpiredError") error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};

/**
 * Catch async errors
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Handle 404 - Not Found
 */
const notFound = (req, res, next) => {
  const error = new AppError(
    `Cannot ${req.method} ${req.originalUrl} - Route not found`,
    404,
  );
  next(error);
};

/**
 * Handle Unhandled Promise Rejections
 */
process.on("unhandledRejection", (err) => {
  logger.error("UNHANDLED REJECTION! Shutting down...");
  logger.error(err.name, err.message);
  logger.error(err.stack);

  process.exit(1);
});

/**
 * Handle Uncaught Exceptions
 */
process.on("uncaughtException", (err) => {
  logger.error("UNCAUGHT EXCEPTION! Shutting down...");
  logger.error(err.name, err.message);
  logger.error(err.stack);

  process.exit(1);
});

module.exports = {
  AppError,
  errorHandler,
  catchAsync,
  notFound,
};
