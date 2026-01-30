const { ROLES } = require("../models");
const {
  AuditLog,
  AUDIT_ACTIONS,
  RESOURCE_TYPES,
} = require("../models/AuditLog");
const logger = require("../utils/logger");

/**
 * Role-based Authorization Middleware
 * Restricts access based on user roles
 */
const authorize = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      // User must be authenticated first
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // Check if user's role is in allowed roles
      if (!allowedRoles.includes(req.user.role)) {
        // Log access denial
        await AuditLog.log({
          action: AUDIT_ACTIONS.ACCESS_DENIED,
          resourceType: RESOURCE_TYPES.API,
          userId: req.user._id,
          userEmail: req.user.email,
          userRole: req.user.role,
          success: false,
          metadata: {
            ip: req.ip,
            userAgent: req.get("user-agent"),
            method: req.method,
            path: req.path,
            requiredRoles: allowedRoles,
          },
          details: `Access denied - required roles: ${allowedRoles.join(", ")}`,
        });

        return res.status(403).json({
          success: false,
          message:
            "Insufficient permissions. This action requires higher privileges.",
          requiredRoles: allowedRoles,
        });
      }

      next();
    } catch (error) {
      logger.error("Authorization error:", error);
      res.status(500).json({
        success: false,
        message: "Authorization check failed",
      });
    }
  };
};

/**
 * Admin Only Middleware
 */
const adminOnly = authorize(ROLES.ADMIN);

/**
 * Admin or User Middleware
 */
const authenticatedUsers = authorize(ROLES.ADMIN, ROLES.USER);

/**
 * Check if user owns resource
 */
const isOwner = (resourceUserIdField = "userId") => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // Admins can access any resource
      if (req.user.role === ROLES.ADMIN) {
        return next();
      }

      // Get resource from request (could be in params, body, or attached by previous middleware)
      const resource = req.resource || req.body;
      const resourceUserId = resource?.[resourceUserIdField];

      if (!resourceUserId) {
        return res.status(400).json({
          success: false,
          message: "Resource ownership could not be determined",
        });
      }

      // Check if user owns the resource
      if (resourceUserId.toString() !== req.user._id.toString()) {
        await AuditLog.log({
          action: AUDIT_ACTIONS.ACCESS_DENIED,
          resourceType: RESOURCE_TYPES.API,
          userId: req.user._id,
          userEmail: req.user.email,
          success: false,
          metadata: {
            ip: req.ip,
            path: req.path,
            method: req.method,
          },
          details: "Access denied - not resource owner",
        });

        return res.status(403).json({
          success: false,
          message: "You do not have permission to access this resource",
        });
      }

      next();
    } catch (error) {
      logger.error("Ownership check error:", error);
      res.status(500).json({
        success: false,
        message: "Ownership verification failed",
      });
    }
  };
};

/**
 * Permission check based on custom logic
 */
const hasPermission = (permissionCheck) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const hasAccess = await permissionCheck(req.user, req);

      if (!hasAccess) {
        await AuditLog.log({
          action: AUDIT_ACTIONS.ACCESS_DENIED,
          resourceType: RESOURCE_TYPES.API,
          userId: req.user._id,
          userEmail: req.user.email,
          success: false,
          metadata: {
            ip: req.ip,
            path: req.path,
            method: req.method,
          },
          details: "Custom permission check failed",
        });

        return res.status(403).json({
          success: false,
          message: "You do not have permission to perform this action",
        });
      }

      next();
    } catch (error) {
      logger.error("Permission check error:", error);
      res.status(500).json({
        success: false,
        message: "Permission verification failed",
      });
    }
  };
};

module.exports = {
  authorize,
  adminOnly,
  authenticatedUsers,
  isOwner,
  hasPermission,
  ROLES,
};
