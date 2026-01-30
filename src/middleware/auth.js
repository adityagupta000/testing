const jwt = require("jsonwebtoken");
const config = require("../config");
const { User } = require("../models");
const logger = require("../utils/logger");

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please provide a valid token.",
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token has expired. Please login again.",
        });
      }

      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          message: "Invalid token. Please login again.",
        });
      }

      throw error;
    }

    // Find user
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found. Token may be invalid.",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account has been deactivated. Please contact support.",
      });
    }

    // Check if account is locked
    if (user.isLocked()) {
      return res.status(423).json({
        success: false,
        message:
          "Account is temporarily locked due to multiple failed login attempts.",
      });
    }

    // Attach user to request
    req.user = user;
    req.token = token;

    next();
  } catch (error) {
    logger.error("Authentication error:", error);
    res.status(500).json({
      success: false,
      message: "Authentication failed. Please try again.",
    });
  }
};

/**
 * Optional Authentication
 * Attaches user if token is valid, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      const user = await User.findById(decoded.userId);

      if (user && user.isActive && !user.isLocked()) {
        req.user = user;
        req.token = token;
      }
    } catch (error) {
      // Silently ignore invalid tokens for optional auth
      req.user = null;
    }

    next();
  } catch (error) {
    logger.error("Optional authentication error:", error);
    req.user = null;
    next();
  }
};

/**
 * Generate JWT token
 */
const generateToken = (userId, expiresIn = config.jwt.expiresIn) => {
  return jwt.sign({ userId }, config.jwt.secret, { expiresIn });
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (userId) => {
  return jwt.sign({ userId, type: "refresh" }, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
};

/**
 * Verify refresh token
 */
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    if (decoded.type !== "refresh") {
      throw new Error("Invalid token type");
    }
    return decoded;
  } catch (error) {
    throw new Error("Invalid or expired refresh token");
  }
};

module.exports = {
  authenticate,
  optionalAuth,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
};
