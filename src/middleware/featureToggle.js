const FeatureToggle = require("../models/FeatureToggle");
const {
  AuditLog,
  AUDIT_ACTIONS,
  RESOURCE_TYPES,
} = require("../models/AuditLog");
const { ROLES } = require("../models");
const config = require("../config");
const logger = require("../utils/logger");

/**
 * Feature Toggle Middleware
 * Checks if a feature is enabled for the current user
 */
const requireFeature = (featureName) => {
  return async (req, res, next) => {
    try {
      // Determine user role (guest if not authenticated)
      const userRole = req.user?.role || ROLES.GUEST;
      const userId = req.user?._id;
      const environment = config.env;

      // Check if feature is enabled
      const isEnabled = await FeatureToggle.checkFeature(
        featureName,
        userRole,
        environment,
        userId,
      );

      if (!isEnabled) {
        // Log access denial
        await AuditLog.log({
          action: AUDIT_ACTIONS.ACCESS_DENIED,
          resourceType: RESOURCE_TYPES.FEATURE_TOGGLE,
          resourceName: featureName,
          userId: req.user?._id,
          userEmail: req.user?.email,
          userRole,
          success: false,
          metadata: {
            ip: req.ip,
            userAgent: req.get("user-agent"),
            method: req.method,
            path: req.path,
            environment,
          },
          details: `Feature '${featureName}' is not enabled for role '${userRole}'`,
        });

        return res.status(403).json({
          success: false,
          message: `Feature '${featureName}' is not available`,
          featureName,
          reason: "Feature is disabled or not available for your account",
        });
      }

      // Feature is enabled, proceed
      req.enabledFeature = featureName;
      next();
    } catch (error) {
      logger.error(`Feature toggle check failed for '${featureName}':`, error);

      // Fail-safe: allow access if feature toggle system fails
      // This prevents feature toggle failures from breaking the entire app
      logger.warn(
        `Allowing access to '${featureName}' due to feature toggle system failure`,
      );
      next();
    }
  };
};

/**
 * Check multiple features (all must be enabled)
 */
const requireAllFeatures = (...featureNames) => {
  return async (req, res, next) => {
    try {
      const userRole = req.user?.role || ROLES.GUEST;
      const userId = req.user?._id;
      const environment = config.env;

      // Check all features
      const checks = await Promise.all(
        featureNames.map((name) =>
          FeatureToggle.checkFeature(name, userRole, environment, userId),
        ),
      );

      const allEnabled = checks.every(Boolean);

      if (!allEnabled) {
        const disabledFeatures = featureNames.filter(
          (_, index) => !checks[index],
        );

        await AuditLog.log({
          action: AUDIT_ACTIONS.ACCESS_DENIED,
          resourceType: RESOURCE_TYPES.FEATURE_TOGGLE,
          userId: req.user?._id,
          userEmail: req.user?.email,
          userRole,
          success: false,
          metadata: {
            ip: req.ip,
            path: req.path,
            method: req.method,
            disabledFeatures,
          },
          details: `Required features not enabled: ${disabledFeatures.join(", ")}`,
        });

        return res.status(403).json({
          success: false,
          message: "Some required features are not available",
          disabledFeatures,
        });
      }

      req.enabledFeatures = featureNames;
      next();
    } catch (error) {
      logger.error("Multiple feature toggle check failed:", error);
      next();
    }
  };
};

/**
 * Check if any of the features is enabled
 */
const requireAnyFeature = (...featureNames) => {
  return async (req, res, next) => {
    try {
      const userRole = req.user?.role || ROLES.GUEST;
      const userId = req.user?._id;
      const environment = config.env;

      // Check all features
      const checks = await Promise.all(
        featureNames.map((name) =>
          FeatureToggle.checkFeature(name, userRole, environment, userId),
        ),
      );

      const anyEnabled = checks.some(Boolean);

      if (!anyEnabled) {
        await AuditLog.log({
          action: AUDIT_ACTIONS.ACCESS_DENIED,
          resourceType: RESOURCE_TYPES.FEATURE_TOGGLE,
          userId: req.user?._id,
          userEmail: req.user?.email,
          userRole,
          success: false,
          metadata: {
            ip: req.ip,
            path: req.path,
            method: req.method,
            requiredFeatures: featureNames,
          },
          details: `None of the required features are enabled: ${featureNames.join(", ")}`,
        });

        return res.status(403).json({
          success: false,
          message: "None of the required features are available",
          requiredFeatures: featureNames,
        });
      }

      const enabledFeatures = featureNames.filter((_, index) => checks[index]);
      req.enabledFeatures = enabledFeatures;
      next();
    } catch (error) {
      logger.error("Any feature toggle check failed:", error);
      next();
    }
  };
};

/**
 * Get enabled features for current user (doesn't block, just adds info)
 */
const attachEnabledFeatures = async (req, res, next) => {
  try {
    const userRole = req.user?.role || ROLES.GUEST;
    const environment = config.env;

    const enabledFeatures = await FeatureToggle.getEnabledFeatures(
      userRole,
      environment,
    );
    req.availableFeatures = enabledFeatures.map((f) => f.featureName);

    next();
  } catch (error) {
    logger.error("Failed to attach enabled features:", error);
    req.availableFeatures = [];
    next();
  }
};

module.exports = {
  requireFeature,
  requireAllFeatures,
  requireAnyFeature,
  attachEnabledFeatures,
};
