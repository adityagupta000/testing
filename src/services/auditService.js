const { AuditLog } = require("../models");
const { AppError } = require("../middleware/errorHandler");
const logger = require("../utils/logger");

/**
 * Audit Service
 */
class AuditService {
  /**
   * Get all audit logs with filtering
   */
  async getAllLogs(filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 50, sort = "-createdAt" } = pagination;

      const query = {};

      // Apply filters
      if (filters.action) {
        query.action = filters.action;
      }

      if (filters.resourceType) {
        query.resourceType = filters.resourceType;
      }

      if (filters.userId) {
        query.userId = filters.userId;
      }

      if (filters.success !== undefined) {
        query.success = filters.success;
      }

      if (filters.startDate && filters.endDate) {
        query.createdAt = {
          $gte: new Date(filters.startDate),
          $lte: new Date(filters.endDate),
        };
      }

      const skip = (page - 1) * limit;

      const [logs, total] = await Promise.all([
        AuditLog.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .populate("userId", "email role")
          .lean(),
        AuditLog.countDocuments(query),
      ]);

      return {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Get all logs error:", error);
      throw error;
    }
  }

  /**
   * Get logs for a specific user
   */
  async getUserLogs(userId, limit = 50) {
    try {
      return await AuditLog.getUserLogs(userId, limit);
    } catch (error) {
      logger.error("Get user logs error:", error);
      throw error;
    }
  }

  /**
   * Get logs for a specific resource
   */
  async getResourceLogs(resourceType, resourceId, limit = 50) {
    try {
      return await AuditLog.getResourceLogs(resourceType, resourceId, limit);
    } catch (error) {
      logger.error("Get resource logs error:", error);
      throw error;
    }
  }

  /**
   * Get failed actions
   */
  async getFailedActions(hours = 24, limit = 100) {
    try {
      return await AuditLog.getFailedActions(hours, limit);
    } catch (error) {
      logger.error("Get failed actions error:", error);
      throw error;
    }
  }

  /**
   * Get audit statistics
   */
  async getStats(startDate, endDate) {
    try {
      const start = startDate
        ? new Date(startDate)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const stats = await AuditLog.getStats(start, end);

      const totalLogs = await AuditLog.countDocuments({
        createdAt: { $gte: start, $lte: end },
      });

      const successCount = await AuditLog.countDocuments({
        createdAt: { $gte: start, $lte: end },
        success: true,
      });

      const failureCount = totalLogs - successCount;

      return {
        period: { start, end },
        total: totalLogs,
        success: successCount,
        failure: failureCount,
        byAction: stats,
      };
    } catch (error) {
      logger.error("Get audit stats error:", error);
      throw error;
    }
  }

  /**
   * Get security events
   */
  async getSecurityEvents(hours = 24) {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const events = await AuditLog.find({
        createdAt: { $gte: since },
        $or: [
          { action: "access_denied" },
          { action: "rate_limit_exceeded" },
          { success: false },
        ],
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .populate("userId", "email role")
        .lean();

      return events;
    } catch (error) {
      logger.error("Get security events error:", error);
      throw error;
    }
  }

  /**
   * Export audit logs
   */
  async exportLogs(filters = {}, format = "json") {
    try {
      const query = {};

      if (filters.startDate && filters.endDate) {
        query.createdAt = {
          $gte: new Date(filters.startDate),
          $lte: new Date(filters.endDate),
        };
      }

      const logs = await AuditLog.find(query)
        .sort({ createdAt: -1 })
        .populate("userId", "email role")
        .lean();

      if (format === "csv") {
        return this.convertToCSV(logs);
      }

      return logs;
    } catch (error) {
      logger.error("Export logs error:", error);
      throw error;
    }
  }

  /**
   * Convert logs to CSV format
   */
  convertToCSV(logs) {
    const headers = [
      "Timestamp",
      "Action",
      "Resource Type",
      "User Email",
      "Success",
      "Details",
    ];
    const rows = logs.map((log) => [
      log.createdAt,
      log.action,
      log.resourceType,
      log.userEmail || "N/A",
      log.success ? "Yes" : "No",
      log.details || "",
    ]);

    return [headers, ...rows].map((row) => row.join(",")).join("\n");
  }
}

module.exports = new AuditService();
