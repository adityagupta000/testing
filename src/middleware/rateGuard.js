const rateLimit = require("express-rate-limit");
const RateGuard = require("../models/RateGuard");
const {
  AuditLog,
  AUDIT_ACTIONS,
  RESOURCE_TYPES,
} = require("../models/AuditLog");
const { ROLES } = require("../models");
const logger = require("../utils/logger");

// In-memory store for rate limit instances (can be replaced with Redis)
const rateLimiters = new Map();

/**
 * Dynamic Rate Guard Middleware
 * Applies rate limiting based on database rules
 */
const applyRateGuard = async (req, res, next) => {
  try {
    const routePath = req.route?.path || req.path;
    const method = req.method;
    const userRole = req.user?.role || ROLES.GUEST;
    const userId = req.user?._id?.toString();
    const userIp = req.ip;

    // Find applicable rate guard rule
    const rule = await RateGuard.findRuleForRoute(routePath, method);

    if (!rule) {
      // No rate limiting rule found, proceed
      return next();
    }

    // Check if user/IP is whitelisted
    if (rule.isWhitelisted(userId) || rule.isWhitelisted(userIp)) {
      logger.debug(
        `Rate limit bypassed for whitelisted identifier: ${userId || userIp}`,
      );
      return next();
    }

    // Get limit for user's role
    const limit = rule.getLimitForRole(userRole);

    if (!limit) {
      // No limit configured, proceed
      return next();
    }

    // Create unique key for this rate limiter
    const limiterKey = `${rule._id}_${userRole}`;

    // Get or create rate limiter for this rule and role
    let limiter = rateLimiters.get(limiterKey);

    if (!limiter) {
      limiter = rateLimit({
        windowMs: limit.windowMs,
        max: limit.maxRequests,
        message: {
          success: false,
          message: rule.errorMessage,
          retryAfter: Math.ceil(limit.windowMs / 1000),
          limit: {
            maxRequests: limit.maxRequests,
            windowMs: limit.windowMs,
          },
        },
        standardHeaders: true,
        legacyHeaders: false,
        // Key generator based on IP or user
        keyGenerator: (req) => {
          if (rule.ipBased) {
            return req.ip;
          }
          return req.user?._id?.toString() || req.ip;
        },
        // Custom handler for rate limit exceeded
        handler: async (req, res) => {
          // Log rate limit exceeded
          await AuditLog.log({
            action: AUDIT_ACTIONS.RATE_LIMIT_EXCEEDED,
            resourceType: RESOURCE_TYPES.API,
            resourceId: rule._id,
            resourceName: rule.displayName,
            userId: req.user?._id,
            userEmail: req.user?.email,
            userRole,
            success: false,
            metadata: {
              ip: req.ip,
              userAgent: req.get("user-agent"),
              method: req.method,
              path: req.path,
              limit: limit.maxRequests,
              windowMs: limit.windowMs,
            },
            details: `Rate limit exceeded: ${limit.maxRequests} requests per ${limit.windowMs}ms`,
          });

          res.status(429).json({
            success: false,
            message: rule.errorMessage,
            retryAfter: Math.ceil(limit.windowMs / 1000),
            limit: {
              maxRequests: limit.maxRequests,
              windowMs: limit.windowMs,
              windowSeconds: Math.ceil(limit.windowMs / 1000),
            },
          });
        },
        // Skip function for whitelisted users
        skip: (req) => {
          const skipUserId = req.user?._id?.toString();
          const skipIp = req.ip;
          return rule.isWhitelisted(skipUserId) || rule.isWhitelisted(skipIp);
        },
      });

      rateLimiters.set(limiterKey, limiter);

      logger.debug(
        `Created new rate limiter for ${limiterKey}: ${limit.maxRequests} req/${limit.windowMs}ms`,
      );
    }

    // Apply the rate limiter
    limiter(req, res, next);
  } catch (error) {
    logger.error("Rate guard middleware error:", error);

    // Fail-safe: don't block requests if rate limiting fails
    logger.warn("Bypassing rate limit due to error");
    next();
  }
};

/**
 * Clear rate limiter cache
 * Useful when rate guard rules are updated
 */
const clearRateLimiters = () => {
  rateLimiters.clear();
  logger.info("Rate limiter cache cleared");
};

/**
 * Get active rate limiters count
 */
const getActiveLimiters = () => {
  return rateLimiters.size;
};

/**
 * Apply specific rate guard by ID
 */
const applySpecificRateGuard = (ruleId) => {
  return async (req, res, next) => {
    try {
      const rule = await RateGuard.findById(ruleId);

      if (!rule || !rule.enabled) {
        return next();
      }

      const userRole = req.user?.role || ROLES.GUEST;
      const userId = req.user?._id?.toString();
      const userIp = req.ip;

      // Check whitelist
      if (rule.isWhitelisted(userId) || rule.isWhitelisted(userIp)) {
        return next();
      }

      // Get limit configuration
      const config = rule.toRateLimiterConfig(userRole);

      if (!config) {
        return next();
      }

      // Create and apply rate limiter
      const limiter = rateLimit(config);
      limiter(req, res, next);
    } catch (error) {
      logger.error("Specific rate guard error:", error);
      next();
    }
  };
};

/**
 * Middleware to refresh rate limiters when rules change
 */
const refreshRateLimitersOnUpdate = (req, res, next) => {
  // Clear cache when rate guard rules are modified
  if (
    req.method === "POST" ||
    req.method === "PUT" ||
    req.method === "PATCH" ||
    req.method === "DELETE"
  ) {
    if (req.path.includes("/rate-guards")) {
      clearRateLimiters();
      logger.info("Rate limiters cache cleared due to rule update");
    }
  }
  next();
};

module.exports = {
  applyRateGuard,
  clearRateLimiters,
  getActiveLimiters,
  applySpecificRateGuard,
  refreshRateLimitersOnUpdate,
};
