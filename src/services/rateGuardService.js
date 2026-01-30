const RateGuard = require("../models/RateGuard");
const {
  AuditLog,
  AUDIT_ACTIONS,
  RESOURCE_TYPES,
} = require("../models/AuditLog");
const { AppError } = require("../middleware/errorHandler");
const { clearRateLimiters } = require("../middleware/rateGuard");
const logger = require("../utils/logger");

/**
 * Rate Guard Service
 */
class RateGuardService {
  /**
   * Create a new rate guard rule
   */
  async createRule(ruleData, userId) {
    try {
      // Check if rule already exists for this route and method
      const existing = await RateGuard.findOne({
        routePath: ruleData.routePath,
        method: ruleData.method || "ALL",
      });

      if (existing) {
        throw new AppError(
          `Rate guard rule already exists for ${ruleData.method || "ALL"} ${ruleData.routePath}`,
          409,
        );
      }

      // Create rate guard rule
      const rule = await RateGuard.create({
        ...ruleData,
        createdBy: userId,
      });

      // Clear rate limiter cache to apply new rule
      clearRateLimiters();

      // Log creation
      await AuditLog.logResourceChange(
        AUDIT_ACTIONS.CREATE,
        RESOURCE_TYPES.RATE_GUARD,
        rule._id,
        userId,
        { after: rule.toJSON() },
      );

      logger.info(
        `Rate guard rule created: ${rule.displayName} by user ${userId}`,
      );

      return rule;
    } catch (error) {
      logger.error("Create rate guard rule error:", error);
      throw error;
    }
  }

  /**
   * Get all rate guard rules with optional filtering
   */
  async getAllRules(filters = {}) {
    try {
      const query = {};

      // Apply filters
      if (filters.enabled !== undefined) {
        query.enabled = filters.enabled;
      }

      if (filters.method) {
        query.method = filters.method.toUpperCase();
      }

      if (filters.search) {
        query.$or = [
          { routePath: { $regex: filters.search, $options: "i" } },
          { description: { $regex: filters.search, $options: "i" } },
        ];
      }

      const rules = await RateGuard.find(query)
        .populate("createdBy", "email firstName lastName")
        .populate("updatedBy", "email firstName lastName")
        .sort({ routePath: 1 });

      return rules;
    } catch (error) {
      logger.error("Get all rate guard rules error:", error);
      throw error;
    }
  }

  /**
   * Get active rate guard rules
   */
  async getActiveRules() {
    try {
      return await RateGuard.getActiveRules();
    } catch (error) {
      logger.error("Get active rules error:", error);
      throw error;
    }
  }

  /**
   * Get a specific rule by ID
   */
  async getRuleById(ruleId) {
    try {
      const rule = await RateGuard.findById(ruleId)
        .populate("createdBy", "email firstName lastName")
        .populate("updatedBy", "email firstName lastName");

      if (!rule) {
        throw new AppError("Rate guard rule not found", 404);
      }

      return rule;
    } catch (error) {
      logger.error("Get rule by ID error:", error);
      throw error;
    }
  }

  /**
   * Find rule for a specific route
   */
  async findRuleForRoute(routePath, method = "ALL") {
    try {
      const rule = await RateGuard.findRuleForRoute(routePath, method);
      return rule;
    } catch (error) {
      logger.error("Find rule for route error:", error);
      throw error;
    }
  }

  /**
   * Update a rate guard rule
   */
  async updateRule(ruleId, updates, userId) {
    try {
      const rule = await RateGuard.findById(ruleId);

      if (!rule) {
        throw new AppError("Rate guard rule not found", 404);
      }

      // Store old values for audit
      const oldValues = rule.toJSON();

      // Update fields
      Object.keys(updates).forEach((key) => {
        if (updates[key] !== undefined) {
          rule[key] = updates[key];
        }
      });

      rule.updatedBy = userId;
      await rule.save();

      // Clear rate limiter cache to apply changes
      clearRateLimiters();

      // Log update
      await AuditLog.logResourceChange(
        AUDIT_ACTIONS.UPDATE,
        RESOURCE_TYPES.RATE_GUARD,
        rule._id,
        userId,
        { before: oldValues, after: updates },
      );

      logger.info(
        `Rate guard rule updated: ${rule.displayName} by user ${userId}`,
      );

      return rule;
    } catch (error) {
      logger.error("Update rate guard rule error:", error);
      throw error;
    }
  }

  /**
   * Toggle rule enable/disable
   */
  async toggleRule(ruleId, enabled, userId) {
    try {
      const rule = await RateGuard.findById(ruleId);

      if (!rule) {
        throw new AppError("Rate guard rule not found", 404);
      }

      const oldValue = rule.enabled;
      rule.enabled = enabled;
      rule.updatedBy = userId;
      await rule.save();

      // Clear rate limiter cache
      clearRateLimiters();

      // Log toggle
      await AuditLog.logResourceChange(
        AUDIT_ACTIONS.UPDATE,
        RESOURCE_TYPES.RATE_GUARD,
        rule._id,
        userId,
        {
          before: { enabled: oldValue },
          after: { enabled },
        },
      );

      logger.info(
        `Rate guard rule ${enabled ? "enabled" : "disabled"}: ${rule.displayName}`,
      );

      return rule;
    } catch (error) {
      logger.error("Toggle rate guard rule error:", error);
      throw error;
    }
  }

  /**
   * Delete a rate guard rule
   */
  async deleteRule(ruleId, userId) {
    try {
      const rule = await RateGuard.findById(ruleId);

      if (!rule) {
        throw new AppError("Rate guard rule not found", 404);
      }

      const displayName = rule.displayName;

      await rule.deleteOne();

      // Clear rate limiter cache
      clearRateLimiters();

      // Log deletion
      await AuditLog.logResourceChange(
        AUDIT_ACTIONS.DELETE,
        RESOURCE_TYPES.RATE_GUARD,
        ruleId,
        userId,
        { before: rule.toJSON() },
      );

      logger.info(`Rate guard rule deleted: ${displayName} by user ${userId}`);

      return { message: "Rate guard rule deleted successfully", displayName };
    } catch (error) {
      logger.error("Delete rate guard rule error:", error);
      throw error;
    }
  }

  /**
   * Add user/IP to whitelist
   */
  async addToWhitelist(ruleId, identifier, userId) {
    try {
      const rule = await RateGuard.findById(ruleId);

      if (!rule) {
        throw new AppError("Rate guard rule not found", 404);
      }

      if (rule.whitelist.includes(identifier)) {
        throw new AppError("Identifier already in whitelist", 409);
      }

      rule.whitelist.push(identifier);
      rule.updatedBy = userId;
      await rule.save();

      // Clear rate limiter cache
      clearRateLimiters();

      logger.info(
        `Added to whitelist: ${identifier} for rule ${rule.displayName}`,
      );

      return rule;
    } catch (error) {
      logger.error("Add to whitelist error:", error);
      throw error;
    }
  }

  /**
   * Remove user/IP from whitelist
   */
  async removeFromWhitelist(ruleId, identifier, userId) {
    try {
      const rule = await RateGuard.findById(ruleId);

      if (!rule) {
        throw new AppError("Rate guard rule not found", 404);
      }

      rule.whitelist = rule.whitelist.filter((item) => item !== identifier);
      rule.updatedBy = userId;
      await rule.save();

      // Clear rate limiter cache
      clearRateLimiters();

      logger.info(
        `Removed from whitelist: ${identifier} for rule ${rule.displayName}`,
      );

      return rule;
    } catch (error) {
      logger.error("Remove from whitelist error:", error);
      throw error;
    }
  }

  /**
   * Get rate guard statistics
   */
  async getRateGuardStats() {
    try {
      const total = await RateGuard.countDocuments();
      const enabled = await RateGuard.countDocuments({ enabled: true });
      const disabled = total - enabled;

      const byMethod = await RateGuard.aggregate([
        {
          $group: {
            _id: "$method",
            count: { $sum: 1 },
          },
        },
      ]);

      const ipBased = await RateGuard.countDocuments({ ipBased: true });

      return {
        total,
        enabled,
        disabled,
        ipBased,
        byMethod: byMethod.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
      };
    } catch (error) {
      logger.error("Get rate guard stats error:", error);
      throw error;
    }
  }

  /**
   * Test rate limit for a route
   */
  async testRateLimit(routePath, method, role) {
    try {
      const rule = await this.findRuleForRoute(routePath, method);

      if (!rule) {
        return {
          hasRule: false,
          message: "No rate limit rule found for this route",
        };
      }

      const limit = rule.getLimitForRole(role);

      return {
        hasRule: true,
        enabled: rule.enabled,
        limit,
        displayName: rule.displayName,
      };
    } catch (error) {
      logger.error("Test rate limit error:", error);
      throw error;
    }
  }
}

module.exports = new RateGuardService();
