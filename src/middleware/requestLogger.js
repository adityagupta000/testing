const morgan = require("morgan");
const logger = require("../utils/logger");
const { AuditLog } = require("../models");

/**
 * Morgan HTTP request logger with Winston integration
 */
const httpLogger = morgan(
  ":method :url :status :res[content-length] - :response-time ms",
  {
    stream: logger.stream,
    skip: (req) => {
      // Skip logging for health check endpoints
      return req.url === "/health" || req.url === "/api/health";
    },
  },
);

/**
 * Request timing middleware
 */
const requestTimer = (req, res, next) => {
  req.startTime = Date.now();

  // Capture response finish event
  res.on("finish", () => {
    req.duration = Date.now() - req.startTime;
  });

  next();
};

/**
 * Log API access with audit trail
 */
const auditLogger = async (req, res, next) => {
  // Wait for response to finish
  res.on("finish", async () => {
    try {
      // Only log authenticated requests or failed requests
      if (req.user || res.statusCode >= 400) {
        await AuditLog.logApiAccess(req, res.statusCode, req.duration);
      }
    } catch (error) {
      // Don't break request flow if audit logging fails
      logger.error("Audit logging failed:", error);
    }
  });

  next();
};

/**
 * Request context middleware
 * Adds useful context to the request object
 */
const requestContext = (req, res, next) => {
  // Add request ID for tracking
  req.id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Add request metadata
  req.context = {
    id: req.id,
    ip: req.ip,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get("user-agent"),
    referer: req.get("referer"),
    timestamp: new Date(),
  };

  // Log request start
  logger.debug(`[${req.id}] ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });

  next();
};

/**
 * Response logger
 * Logs response details
 */
const responseLogger = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = function (data) {
    // Log response
    logger.debug(`[${req.id}] Response:`, {
      statusCode: res.statusCode,
      duration: req.duration,
      dataSize: JSON.stringify(data).length,
    });

    return originalJson(data);
  };

  next();
};

/**
 * Security headers logger
 */
const logSecurityHeaders = (req, res, next) => {
  // Log suspicious requests
  const suspiciousPatterns = [
    /\.\./, // Path traversal
    /<script/i, // XSS attempt
    /union.*select/i, // SQL injection
    /javascript:/i, // JavaScript injection
  ];

  const isSuspicious = suspiciousPatterns.some(
    (pattern) =>
      pattern.test(req.url) ||
      pattern.test(JSON.stringify(req.body)) ||
      pattern.test(JSON.stringify(req.query)),
  );

  if (isSuspicious) {
    logger.warn("Suspicious request detected:", {
      id: req.id,
      ip: req.ip,
      url: req.url,
      method: req.method,
      body: req.body,
      query: req.query,
      userAgent: req.get("user-agent"),
    });
  }

  next();
};

/**
 * Rate limit logger
 */
const logRateLimit = (req, res, next) => {
  // Add rate limit info to response if available
  const rateLimit = {
    limit: res.getHeader("X-RateLimit-Limit"),
    remaining: res.getHeader("X-RateLimit-Remaining"),
    reset: res.getHeader("X-RateLimit-Reset"),
  };

  if (rateLimit.limit) {
    req.rateLimit = rateLimit;

    // Log if approaching rate limit
    if (rateLimit.remaining && parseInt(rateLimit.remaining) < 10) {
      logger.warn("Approaching rate limit:", {
        user: req.user?.email,
        ip: req.ip,
        remaining: rateLimit.remaining,
        limit: rateLimit.limit,
      });
    }
  }

  next();
};

/**
 * Create detailed access log
 */
const detailedAccessLog = (req, res, next) => {
  res.on("finish", () => {
    const log = {
      requestId: req.id,
      timestamp: req.context.timestamp,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: req.duration,
      ip: req.ip,
      user: req.user
        ? {
            id: req.user._id,
            email: req.user.email,
            role: req.user.role,
          }
        : null,
      userAgent: req.get("user-agent"),
      referer: req.get("referer"),
      contentLength: res.get("content-length"),
      rateLimit: req.rateLimit,
    };

    // Log based on status code
    if (res.statusCode >= 500) {
      logger.error("Server Error:", log);
    } else if (res.statusCode >= 400) {
      logger.warn("Client Error:", log);
    } else {
      logger.info("Access:", log);
    }
  });

  next();
};

module.exports = {
  httpLogger,
  requestTimer,
  auditLogger,
  requestContext,
  responseLogger,
  logSecurityHeaders,
  logRateLimit,
  detailedAccessLog,
};
