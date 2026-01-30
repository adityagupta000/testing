const FeatureToggle = require("../models/FeatureToggle");
const {
  AuditLog,
  AUDIT_ACTIONS,
  RESOURCE_TYPES,
} = require("../models/AuditLog");
const { AppError } = require("../middleware/errorHandler");
const logger = require("../utils/logger");
const config = require("../config");

/**
 * Feature Toggle Service
 */
class FeatureToggleService {
  /**
   * Create a new feature toggle
   */
  async createFeature(featureData, userId) {
    try {
      // Check if feature already exists
      const existing = await FeatureToggle.findOne({
        featureName: featureData.featureName,
      });

      if (existing) {
        throw new AppError(
          `Feature '${featureData.featureName}' already exists`,
          409,
        );
      }

      // Create feature toggle
      const feature = await FeatureToggle.create({
        ...featureData,
        createdBy: userId,
      });

      // Log creation
      await AuditLog.logResourceChange(
        AUDIT_ACTIONS.CREATE,
        RESOURCE_TYPES.FEATURE_TOGGLE,
        feature._id,
        userId,
        { after: feature.toJSON() },
      );

      logger.info(
        `Feature toggle created: ${feature.featureName} by user ${userId}`,
      );

      return feature;
    } catch (error) {
      logger.error("Create feature toggle error:", error);
      throw error;
    }
  }

  /**
   * Get all feature toggles with optional filtering
   */
  async getAllFeatures(filters = {}) {
    try {
      const query = {};

      // Apply filters
      if (filters.enabled !== undefined) {
        query.enabled = filters.enabled;
      }

      if (filters.search) {
        query.$or = [
          { featureName: { $regex: filters.search, $options: "i" } },
          { description: { $regex: filters.search, $options: "i" } },
        ];
      }

      const features = await FeatureToggle.find(query)
        .populate("createdBy", "email firstName lastName")
        .populate("updatedBy", "email firstName lastName")
        .sort({ createdAt: -1 });

      return features;
    } catch (error) {
      logger.error("Get all features error:", error);
      throw error;
    }
  }

  /**
   * Get enabled features for a specific role
   */
  async getEnabledFeaturesForRole(role, environment = config.env) {
    try {
      const features = await FeatureToggle.getEnabledFeatures(
        role,
        environment,
      );

      return features.map((f) => ({
        featureName: f.featureName,
        description: f.description,
        rolloutPercentage: f.rolloutPercentage,
      }));
    } catch (error) {
      logger.error("Get enabled features error:", error);
      throw error;
    }
  }

  /**
   * Get a specific feature by ID
   */
  async getFeatureById(featureId) {
    try {
      const feature = await FeatureToggle.findById(featureId)
        .populate("createdBy", "email firstName lastName")
        .populate("updatedBy", "email firstName lastName");

      if (!feature) {
        throw new AppError("Feature toggle not found", 404);
      }

      return feature;
    } catch (error) {
      logger.error("Get feature by ID error:", error);
      throw error;
    }
  }

  /**
   * Get a feature by name
   */
  async getFeatureByName(featureName) {
    try {
      const feature = await FeatureToggle.findOne({ featureName });

      if (!feature) {
        throw new AppError("Feature toggle not found", 404);
      }

      return feature;
    } catch (error) {
      logger.error("Get feature by name error:", error);
      throw error;
    }
  }

  /**
   * Update a feature toggle
   */
  async updateFeature(featureId, updates, userId) {
    try {
      const feature = await FeatureToggle.findById(featureId);

      if (!feature) {
        throw new AppError("Feature toggle not found", 404);
      }

      // Store old values for audit
      const oldValues = feature.toJSON();

      // Update fields
      Object.keys(updates).forEach((key) => {
        if (updates[key] !== undefined) {
          feature[key] = updates[key];
        }
      });

      feature.updatedBy = userId;
      await feature.save();

      // Log update
      await AuditLog.logResourceChange(
        AUDIT_ACTIONS.UPDATE,
        RESOURCE_TYPES.FEATURE_TOGGLE,
        feature._id,
        userId,
        { before: oldValues, after: updates },
      );

      logger.info(
        `Feature toggle updated: ${feature.featureName} by user ${userId}`,
      );

      return feature;
    } catch (error) {
      logger.error("Update feature toggle error:", error);
      throw error;
    }
  }

  /**
   * Toggle feature enable/disable
   */
  async toggleFeature(featureId, enabled, userId) {
    try {
      const feature = await FeatureToggle.findById(featureId);

      if (!feature) {
        throw new AppError("Feature toggle not found", 404);
      }

      const oldValue = feature.enabled;
      feature.enabled = enabled;
      feature.updatedBy = userId;
      await feature.save();

      // Log toggle
      await AuditLog.logResourceChange(
        AUDIT_ACTIONS.UPDATE,
        RESOURCE_TYPES.FEATURE_TOGGLE,
        feature._id,
        userId,
        {
          before: { enabled: oldValue },
          after: { enabled },
        },
      );

      logger.info(
        `Feature ${enabled ? "enabled" : "disabled"}: ${feature.featureName}`,
      );

      return feature;
    } catch (error) {
      logger.error("Toggle feature error:", error);
      throw error;
    }
  }

  /**
   * Delete a feature toggle
   */
  async deleteFeature(featureId, userId) {
    try {
      const feature = await FeatureToggle.findById(featureId);

      if (!feature) {
        throw new AppError("Feature toggle not found", 404);
      }

      const featureName = feature.featureName;

      await feature.deleteOne();

      // Log deletion
      await AuditLog.logResourceChange(
        AUDIT_ACTIONS.DELETE,
        RESOURCE_TYPES.FEATURE_TOGGLE,
        featureId,
        userId,
        { before: feature.toJSON() },
      );

      logger.info(`Feature toggle deleted: ${featureName} by user ${userId}`);

      return { message: "Feature toggle deleted successfully", featureName };
    } catch (error) {
      logger.error("Delete feature toggle error:", error);
      throw error;
    }
  }

  /**
   * Check if a feature is enabled for user
   */
  async checkFeatureAccess(featureName, role, userId = null) {
    try {
      const environment = config.env;
      const isEnabled = await FeatureToggle.checkFeature(
        featureName,
        role,
        environment,
        userId,
      );

      return {
        featureName,
        enabled: isEnabled,
        role,
        environment,
      };
    } catch (error) {
      logger.error("Check feature access error:", error);
      throw error;
    }
  }

  /**
   * Bulk update features
   */
  async bulkUpdateFeatures(updates, userId) {
    try {
      const results = [];

      for (const update of updates) {
        try {
          const feature = await this.updateFeature(
            update.id,
            update.data,
            userId,
          );
          results.push({ id: update.id, success: true, feature });
        } catch (error) {
          results.push({ id: update.id, success: false, error: error.message });
        }
      }

      return results;
    } catch (error) {
      logger.error("Bulk update features error:", error);
      throw error;
    }
  }

  /**
   * Get feature statistics
   */
  async getFeatureStats() {
    try {
      const total = await FeatureToggle.countDocuments();
      const enabled = await FeatureToggle.countDocuments({ enabled: true });
      const disabled = total - enabled;

      const byEnvironment = await FeatureToggle.aggregate([
        {
          $project: {
            devEnabled: "$environments.development.enabled",
            stagingEnabled: "$environments.staging.enabled",
            prodEnabled: "$environments.production.enabled",
          },
        },
        {
          $group: {
            _id: null,
            development: { $sum: { $cond: ["$devEnabled", 1, 0] } },
            staging: { $sum: { $cond: ["$stagingEnabled", 1, 0] } },
            production: { $sum: { $cond: ["$prodEnabled", 1, 0] } },
          },
        },
      ]);

      return {
        total,
        enabled,
        disabled,
        byEnvironment: byEnvironment[0] || {
          development: 0,
          staging: 0,
          production: 0,
        },
      };
    } catch (error) {
      logger.error("Get feature stats error:", error);
      throw error;
    }
  }
}

module.exports = new FeatureToggleService();
