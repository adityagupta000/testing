const express = require("express");
const router = express.Router();
const { userService } = require("../services");
const {
  authenticate,
  adminOnly,
  validate,
  schemas,
  catchAsync,
} = require("../middleware");

/**
 * All user routes require authentication
 */
router.use(authenticate);

/**
 * @route   GET /api/users
 * @desc    Get all users (admin only)
 * @access  Private/Admin
 */
router.get(
  "/",
  adminOnly,
  catchAsync(async (req, res) => {
    const { role, isActive, page, limit, sort, search } = req.query;

    const filters = {
      ...(role && { role }),
      ...(isActive !== undefined && { isActive: isActive === "true" }),
    };

    const pagination = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      sort: sort || "-createdAt",
      search: search || "",
    };

    const result = await userService.getAllUsers(filters, pagination);

    res.json({
      success: true,
      data: result,
    });
  }),
);

/**
 * @route   GET /api/users/stats
 * @desc    Get user statistics (admin only)
 * @access  Private/Admin
 */
router.get(
  "/stats",
  adminOnly,
  catchAsync(async (req, res) => {
    const stats = await userService.getUserStats();

    res.json({
      success: true,
      data: stats,
    });
  }),
);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID (admin only)
 * @access  Private/Admin
 */
router.get(
  "/:id",
  adminOnly,
  validate(schemas.idParam),
  catchAsync(async (req, res) => {
    const user = await userService.getUserById(req.params.id);

    res.json({
      success: true,
      data: { user },
    });
  }),
);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user (admin only)
 * @access  Private/Admin
 */
router.put(
  "/:id",
  adminOnly,
  validate(schemas.idParam),
  validate(schemas.updateUser),
  catchAsync(async (req, res) => {
    const user = await userService.updateUser(
      req.params.id,
      req.body,
      req.user._id,
    );

    res.json({
      success: true,
      message: "User updated successfully",
      data: { user },
    });
  }),
);

/**
 * @route   PUT /api/users/:id/role
 * @desc    Change user role (admin only)
 * @access  Private/Admin
 */
router.put(
  "/:id/role",
  adminOnly,
  validate(schemas.idParam),
  catchAsync(async (req, res) => {
    const { role } = req.body;

    if (!role || !["admin", "user", "guest"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Valid role is required (admin, user, or guest)",
      });
    }

    const user = await userService.changeUserRole(
      req.params.id,
      role,
      req.user._id,
    );

    res.json({
      success: true,
      message: "User role changed successfully",
      data: { user },
    });
  }),
);

/**
 * @route   PUT /api/users/:id/deactivate
 * @desc    Deactivate user (admin only)
 * @access  Private/Admin
 */
router.put(
  "/:id/deactivate",
  adminOnly,
  validate(schemas.idParam),
  catchAsync(async (req, res) => {
    const user = await userService.deactivateUser(req.params.id, req.user._id);

    res.json({
      success: true,
      message: "User deactivated successfully",
      data: { user },
    });
  }),
);

/**
 * @route   PUT /api/users/:id/activate
 * @desc    Activate user (admin only)
 * @access  Private/Admin
 */
router.put(
  "/:id/activate",
  adminOnly,
  validate(schemas.idParam),
  catchAsync(async (req, res) => {
    const user = await userService.activateUser(req.params.id, req.user._id);

    res.json({
      success: true,
      message: "User activated successfully",
      data: { user },
    });
  }),
);

/**
 * @route   PUT /api/users/:id/unlock
 * @desc    Unlock user account (admin only)
 * @access  Private/Admin
 */
router.put(
  "/:id/unlock",
  adminOnly,
  validate(schemas.idParam),
  catchAsync(async (req, res) => {
    const user = await userService.unlockUser(req.params.id, req.user._id);

    res.json({
      success: true,
      message: "User account unlocked successfully",
      data: { user },
    });
  }),
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user (admin only)
 * @access  Private/Admin
 */
router.delete(
  "/:id",
  adminOnly,
  validate(schemas.idParam),
  catchAsync(async (req, res) => {
    const result = await userService.deleteUser(req.params.id, req.user._id);

    res.json({
      success: true,
      message: result.message,
      data: { email: result.email },
    });
  }),
);

module.exports = router;
