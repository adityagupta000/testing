const express = require("express");
const router = express.Router();
const { rateGuardService } = require("../services");
const {
  authenticate,
  adminOnly,
  validate,
  schemas,
  catchAsync,
} = require("../middleware");

/**
 * All rate guard routes require authentication
 */
router.use(authenticate);

/**
 * @route   GET /api/rate-guards
 * @desc    Get all rate guard rules
 * @access  Private
 */
router.get(
  "/",
  catchAsync(async (req, res) => {
    const { enabled, method, search } = req.query;

    const filters = {
      ...(enabled !== undefined && { enabled: enabled === "true" }),
      ...(method && { method }),
      ...(search && { search }),
    };

    const rules = await rateGuardService.getAllRules(filters);

    res.json({
      success: true,
      data: { rules, count: rules.length },
    });
  }),
);

/**
 * @route   GET /api/rate-guards/active
 * @desc    Get active rate guard rules
 * @access  Private
 */
router.get(
  "/active",
  catchAsync(async (req, res) => {
    const rules = await rateGuardService.getActiveRules();

    res.json({
      success: true,
      data: { rules, count: rules.length },
    });
  }),
);

/**
 * @route   GET /api/rate-guards/stats
 * @desc    Get rate guard statistics (admin only)
 * @access  Private/Admin
 */
router.get(
  "/stats",
  adminOnly,
  catchAsync(async (req, res) => {
    const stats = await rateGuardService.getRateGuardStats();

    res.json({
      success: true,
      data: stats,
    });
  }),
);

/**
 * @route   GET /api/rate-guards/:id
 * @desc    Get rate guard rule by ID
 * @access  Private
 */
router.get(
  "/:id",
  validate(schemas.idParam),
  catchAsync(async (req, res) => {
    const rule = await rateGuardService.getRuleById(req.params.id);

    res.json({
      success: true,
      data: { rule },
    });
  }),
);

/**
 * @route   POST /api/rate-guards/test
 * @desc    Test rate limit for a route
 * @access  Private
 */
router.post(
  "/test",
  catchAsync(async (req, res) => {
    const { routePath, method } = req.body;

    if (!routePath) {
      return res.status(400).json({
        success: false,
        message: "routePath is required",
      });
    }

    const result = await rateGuardService.testRateLimit(
      routePath,
      method || "ALL",
      req.user.role,
    );

    res.json({
      success: true,
      data: result,
    });
  }),
);

/**
 * @route   POST /api/rate-guards
 * @desc    Create new rate guard rule (admin only)
 * @access  Private/Admin
 */
router.post(
  "/",
  adminOnly,
  validate(schemas.createRateGuard),
  catchAsync(async (req, res) => {
    const rule = await rateGuardService.createRule(req.body, req.user._id);

    res.status(201).json({
      success: true,
      message: "Rate guard rule created successfully",
      data: { rule },
    });
  }),
);

/**
 * @route   PUT /api/rate-guards/:id
 * @desc    Update rate guard rule (admin only)
 * @access  Private/Admin
 */
router.put(
  "/:id",
  adminOnly,
  validate(schemas.idParam),
  catchAsync(async (req, res) => {
    const rule = await rateGuardService.updateRule(
      req.params.id,
      req.body,
      req.user._id,
    );

    res.json({
      success: true,
      message: "Rate guard rule updated successfully",
      data: { rule },
    });
  }),
);

/**
 * @route   PUT /api/rate-guards/:id/toggle
 * @desc    Toggle rate guard rule enable/disable (admin only)
 * @access  Private/Admin
 */
router.put(
  "/:id/toggle",
  adminOnly,
  validate(schemas.idParam),
  catchAsync(async (req, res) => {
    const { enabled } = req.body;

    if (enabled === undefined) {
      return res.status(400).json({
        success: false,
        message: "enabled field is required (true or false)",
      });
    }

    const rule = await rateGuardService.toggleRule(
      req.params.id,
      enabled,
      req.user._id,
    );

    res.json({
      success: true,
      message: `Rate guard rule ${enabled ? "enabled" : "disabled"} successfully`,
      data: { rule },
    });
  }),
);

/**
 * @route   PUT /api/rate-guards/:id/whitelist/add
 * @desc    Add identifier to whitelist (admin only)
 * @access  Private/Admin
 */
router.put(
  "/:id/whitelist/add",
  adminOnly,
  validate(schemas.idParam),
  catchAsync(async (req, res) => {
    const { identifier } = req.body;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: "identifier is required (user ID or IP address)",
      });
    }

    const rule = await rateGuardService.addToWhitelist(
      req.params.id,
      identifier,
      req.user._id,
    );

    res.json({
      success: true,
      message: "Identifier added to whitelist successfully",
      data: { rule },
    });
  }),
);

/**
 * @route   PUT /api/rate-guards/:id/whitelist/remove
 * @desc    Remove identifier from whitelist (admin only)
 * @access  Private/Admin
 */
router.put(
  "/:id/whitelist/remove",
  adminOnly,
  validate(schemas.idParam),
  catchAsync(async (req, res) => {
    const { identifier } = req.body;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: "identifier is required (user ID or IP address)",
      });
    }

    const rule = await rateGuardService.removeFromWhitelist(
      req.params.id,
      identifier,
      req.user._id,
    );

    res.json({
      success: true,
      message: "Identifier removed from whitelist successfully",
      data: { rule },
    });
  }),
);

/**
 * @route   DELETE /api/rate-guards/:id
 * @desc    Delete rate guard rule (admin only)
 * @access  Private/Admin
 */
router.delete(
  "/:id",
  adminOnly,
  validate(schemas.idParam),
  catchAsync(async (req, res) => {
    const result = await rateGuardService.deleteRule(
      req.params.id,
      req.user._id,
    );

    res.json({
      success: true,
      message: result.message,
      data: { displayName: result.displayName },
    });
  }),
);

module.exports = router;
