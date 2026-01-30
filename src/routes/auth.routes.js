const express = require("express");
const router = express.Router();
const { authService } = require("../services");
const {
  authenticate,
  validate,
  schemas,
  catchAsync,
} = require("../middleware");

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  "/register",
  validate(schemas.register),
  catchAsync(async (req, res) => {
    const { email, password, firstName, lastName } = req.body;

    const result = await authService.register(
      { email, password, firstName, lastName },
      {
        ip: req.ip,
        userAgent: req.get("user-agent"),
      },
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: result,
    });
  }),
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  "/login",
  validate(schemas.login),
  catchAsync(async (req, res) => {
    const { email, password } = req.body;

    const result = await authService.login(email, password, {
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.json({
      success: true,
      message: "Login successful",
      data: result,
    });
  }),
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post(
  "/logout",
  authenticate,
  catchAsync(async (req, res) => {
    await authService.logout(req.user._id, {
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  }),
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post(
  "/refresh",
  catchAsync(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token is required",
      });
    }

    const result = await authService.refreshToken(refreshToken);

    res.json({
      success: true,
      message: "Token refreshed successfully",
      data: result,
    });
  }),
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get(
  "/me",
  authenticate,
  catchAsync(async (req, res) => {
    const user = await authService.getCurrentUser(req.user._id);

    res.json({
      success: true,
      data: { user },
    });
  }),
);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  "/profile",
  authenticate,
  catchAsync(async (req, res) => {
    const { firstName, lastName } = req.body;

    const user = await authService.updateProfile(req.user._id, {
      firstName,
      lastName,
    });

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: { user },
    });
  }),
);

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put(
  "/change-password",
  authenticate,
  catchAsync(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    const result = await authService.changePassword(
      req.user._id,
      currentPassword,
      newPassword,
    );

    res.json({
      success: true,
      message: result.message,
    });
  }),
);

module.exports = router;
