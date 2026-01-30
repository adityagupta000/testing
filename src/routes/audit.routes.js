const express = require("express");
const router = express.Router();
const { auditService } = require("../services");
const { authenticate, adminOnly, catchAsync } = require("../middleware");

/**
 * All audit routes require authentication and admin role
 */
router.use(authenticate);
router.use(adminOnly);

/**
 * @route   GET /api/audit
 * @desc    Get all audit logs with filtering
 * @access  Private/Admin
 */
router.get(
  "/",
  catchAsync(async (req, res) => {
    const {
      action,
      resourceType,
      userId,
      success,
      startDate,
      endDate,
      page,
      limit,
      sort,
    } = req.query;

    const filters = {
      ...(action && { action }),
      ...(resourceType && { resourceType }),
      ...(userId && { userId }),
      ...(success !== undefined && { success: success === "true" }),
      ...(startDate && endDate && { startDate, endDate }),
    };

    const pagination = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      sort: sort || "-createdAt",
    };

    const result = await auditService.getAllLogs(filters, pagination);

    res.json({
      success: true,
      data: result,
    });
  }),
);

/**
 * @route   GET /api/audit/user/:userId
 * @desc    Get audit logs for a specific user
 * @access  Private/Admin
 */
router.get(
  "/user/:userId",
  catchAsync(async (req, res) => {
    const { limit } = req.query;
    const logs = await auditService.getUserLogs(
      req.params.userId,
      parseInt(limit) || 50,
    );

    res.json({
      success: true,
      data: { logs, count: logs.length },
    });
  }),
);

/**
 * @route   GET /api/audit/resource/:resourceType/:resourceId
 * @desc    Get audit logs for a specific resource
 * @access  Private/Admin
 */
router.get(
  "/resource/:resourceType/:resourceId",
  catchAsync(async (req, res) => {
    const { resourceType, resourceId } = req.params;
    const { limit } = req.query;

    const logs = await auditService.getResourceLogs(
      resourceType,
      resourceId,
      parseInt(limit) || 50,
    );

    res.json({
      success: true,
      data: { logs, count: logs.length },
    });
  }),
);

/**
 * @route   GET /api/audit/failed
 * @desc    Get failed actions
 * @access  Private/Admin
 */
router.get(
  "/failed",
  catchAsync(async (req, res) => {
    const { hours, limit } = req.query;

    const logs = await auditService.getFailedActions(
      parseInt(hours) || 24,
      parseInt(limit) || 100,
    );

    res.json({
      success: true,
      data: { logs, count: logs.length },
    });
  }),
);

/**
 * @route   GET /api/audit/security
 * @desc    Get security events
 * @access  Private/Admin
 */
router.get(
  "/security",
  catchAsync(async (req, res) => {
    const { hours } = req.query;

    const events = await auditService.getSecurityEvents(parseInt(hours) || 24);

    res.json({
      success: true,
      data: { events, count: events.length },
    });
  }),
);

/**
 * @route   GET /api/audit/stats
 * @desc    Get audit statistics
 * @access  Private/Admin
 */
router.get(
  "/stats",
  catchAsync(async (req, res) => {
    const { startDate, endDate } = req.query;

    const stats = await auditService.getStats(startDate, endDate);

    res.json({
      success: true,
      data: stats,
    });
  }),
);

/**
 * @route   GET /api/audit/export
 * @desc    Export audit logs
 * @access  Private/Admin
 */
router.get(
  "/export",
  catchAsync(async (req, res) => {
    const { startDate, endDate, format } = req.query;

    const filters = {
      ...(startDate && endDate && { startDate, endDate }),
    };

    const logs = await auditService.exportLogs(filters, format || "json");

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=audit-logs.csv",
      );
      res.send(logs);
    } else {
      res.json({
        success: true,
        data: { logs, count: logs.length },
      });
    }
  }),
);

module.exports = router;
