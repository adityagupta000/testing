const express = require("express");
const router = express.Router();
const database = require("../config/database");
const config = require("../config");
const { authenticate, adminOnly, catchAsync } = require("../middleware");
const { User, FeatureToggle, RateGuard, AuditLog } = require("../models");

/**
 * @route   GET /api/health
 * @desc    Basic health check
 * @access  Public
 */
router.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * @route   GET /api/status
 * @desc    Detailed system status
 * @access  Public
 */
router.get(
  "/status",
  catchAsync(async (req, res) => {
    const dbStatus = database.isConnected() ? "connected" : "disconnected";

    res.json({
      success: true,
      data: {
        service: "Policy Toggle Service",
        version: "1.0.0",
        environment: config.env,
        status: "operational",
        database: dbStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
    });
  }),
);

/**
 * @route   GET /api/system/info
 * @desc    System information (admin only)
 * @access  Private/Admin
 */
router.get(
  "/system/info",
  authenticate,
  adminOnly,
  catchAsync(async (req, res) => {
    const [userCount, featureCount, rateGuardCount, auditCount] =
      await Promise.all([
        User.countDocuments(),
        FeatureToggle.countDocuments(),
        RateGuard.countDocuments(),
        AuditLog.countDocuments(),
      ]);

    res.json({
      success: true,
      data: {
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          uptime: process.uptime(),
          memory: {
            total:
              Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + " MB",
            used:
              Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + " MB",
          },
        },
        database: {
          status: database.isConnected() ? "connected" : "disconnected",
          collections: {
            users: userCount,
            features: featureCount,
            rateGuards: rateGuardCount,
            auditLogs: auditCount,
          },
        },
        environment: config.env,
        timestamp: new Date().toISOString(),
      },
    });
  }),
);

/**
 * @route   GET /api/system/metrics
 * @desc    System metrics (admin only)
 * @access  Private/Admin
 */
router.get(
  "/system/metrics",
  authenticate,
  adminOnly,
  catchAsync(async (req, res) => {
    const now = new Date();
    const last24Hours = new Date(now - 24 * 60 * 60 * 1000);

    const [recentAuditLogs, failedActions, activeUsers] = await Promise.all([
      AuditLog.countDocuments({ createdAt: { $gte: last24Hours } }),
      AuditLog.countDocuments({
        createdAt: { $gte: last24Hours },
        success: false,
      }),
      User.countDocuments({
        isActive: true,
        lastLogin: { $gte: last24Hours },
      }),
    ]);

    res.json({
      success: true,
      data: {
        period: "24 hours",
        metrics: {
          totalAuditLogs: recentAuditLogs,
          failedActions: failedActions,
          successRate:
            recentAuditLogs > 0
              ? (
                  ((recentAuditLogs - failedActions) / recentAuditLogs) *
                  100
                ).toFixed(2) + "%"
              : "N/A",
          activeUsers: activeUsers,
        },
        timestamp: new Date().toISOString(),
      },
    });
  }),
);

module.exports = router;
