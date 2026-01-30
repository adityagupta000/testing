const express = require("express");
const router = express.Router();
const { featureToggleService } = require("../services");
const {
  authenticate,
  adminOnly,
  validate,
  schemas,
  catchAsync,
} = require("../middleware");

/**
 * All feature toggle routes require authentication
 */
router.use(authenticate);

/**
 * @route   GET /api/features
 * @desc    Get all feature toggles
 * @access  Private
 */
router.get(
  "/",
  catchAsync(async (req, res) => {
    const { enabled, search } = req.query;

    const filters = {
      ...(enabled !== undefined && { enabled: enabled === "true" }),
      ...(search && { search }),
    };

    const features = await featureToggleService.getAllFeatures(filters);

    res.json({
      success: true,
      data: { features, count: features.length },
    });
  }),
);

/**
 * @route   GET /api/features/stats
 * @desc    Get feature toggle statistics (admin only)
 * @access  Private/Admin
 */
router.get(
  "/stats",
  adminOnly,
  catchAsync(async (req, res) => {
    const stats = await featureToggleService.getFeatureStats();

    res.json({
      success: true,
      data: stats,
    });
  }),
);

/**
 * @route   GET /api/features/enabled
 * @desc    Get enabled features for current user
 * @access  Private
 */
router.get(
  "/enabled",
  catchAsync(async (req, res) => {
    const features = await featureToggleService.getEnabledFeaturesForRole(
      req.user.role,
    );

    res.json({
      success: true,
      data: { features, count: features.length },
    });
  }),
);

/**
 * @route   GET /api/features/:id
 * @desc    Get feature toggle by ID
 * @access  Private
 */
router.get(
  "/:id",
  validate(schemas.idParam),
  catchAsync(async (req, res) => {
    const feature = await featureToggleService.getFeatureById(req.params.id);

    res.json({
      success: true,
      data: { feature },
    });
  }),
);

/**
 * @route   GET /api/features/name/:featureName
 * @desc    Get feature toggle by name
 * @access  Private
 */
router.get(
  "/name/:featureName",
  catchAsync(async (req, res) => {
    const feature = await featureToggleService.getFeatureByName(
      req.params.featureName,
    );

    res.json({
      success: true,
      data: { feature },
    });
  }),
);

/**
 * @route   POST /api/features/check
 * @desc    Check if a feature is enabled for current user
 * @access  Private
 */
router.post(
  "/check",
  catchAsync(async (req, res) => {
    const { featureName } = req.body;

    if (!featureName) {
      return res.status(400).json({
        success: false,
        message: "Feature name is required",
      });
    }

    const result = await featureToggleService.checkFeatureAccess(
      featureName,
      req.user.role,
      req.user._id,
    );

    res.json({
      success: true,
      data: result,
    });
  }),
);

/**
 * @route   POST /api/features
 * @desc    Create new feature toggle (admin only)
 * @access  Private/Admin
 */
router.post(
  "/",
  adminOnly,
  validate(schemas.createFeatureToggle),
  catchAsync(async (req, res) => {
    const feature = await featureToggleService.createFeature(
      req.body,
      req.user._id,
    );

    res.status(201).json({
      success: true,
      message: "Feature toggle created successfully",
      data: { feature },
    });
  }),
);

/**
 * @route   PUT /api/features/:id
 * @desc    Update feature toggle (admin only)
 * @access  Private/Admin
 */
router.put(
  "/:id",
  adminOnly,
  validate(schemas.idParam),
  catchAsync(async (req, res) => {
    const feature = await featureToggleService.updateFeature(
      req.params.id,
      req.body,
      req.user._id,
    );

    res.json({
      success: true,
      message: "Feature toggle updated successfully",
      data: { feature },
    });
  }),
);

/**
 * @route   PUT /api/features/:id/toggle
 * @desc    Toggle feature enable/disable (admin only)
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

    const feature = await featureToggleService.toggleFeature(
      req.params.id,
      enabled,
      req.user._id,
    );

    res.json({
      success: true,
      message: `Feature ${enabled ? "enabled" : "disabled"} successfully`,
      data: { feature },
    });
  }),
);

/**
 * @route   DELETE /api/features/:id
 * @desc    Delete feature toggle (admin only)
 * @access  Private/Admin
 */
router.delete(
  "/:id",
  adminOnly,
  validate(schemas.idParam),
  catchAsync(async (req, res) => {
    const result = await featureToggleService.deleteFeature(
      req.params.id,
      req.user._id,
    );

    res.json({
      success: true,
      message: result.message,
      data: { featureName: result.featureName },
    });
  }),
);

/**
 * @route   POST /api/features/bulk-update
 * @desc    Bulk update features (admin only)
 * @access  Private/Admin
 */
router.post(
  "/bulk-update",
  adminOnly,
  catchAsync(async (req, res) => {
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "updates array is required",
      });
    }

    const results = await featureToggleService.bulkUpdateFeatures(
      updates,
      req.user._id,
    );

    res.json({
      success: true,
      message: "Bulk update completed",
      data: { results },
    });
  }),
);

module.exports = router;
