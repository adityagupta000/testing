const { User, ROLES } = require("../models");
const {
  AuditLog,
  AUDIT_ACTIONS,
  RESOURCE_TYPES,
} = require("../models/AuditLog");
const {
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require("../middleware/auth");
const { AppError } = require("../middleware/errorHandler");
const logger = require("../utils/logger");

/**
 * Authentication Service
 * Clean, deterministic, test-safe implementation
 */
class AuthService {
  /**
   * Register a new user
   */
  async register(userData, metadata = {}) {
    try {
      const existingUser = await User.findOne({ email: userData.email });

      if (existingUser) {
        throw new AppError("User with this email already exists", 409);
      }

      const user = await User.create({
        ...userData,
        role: userData.role || ROLES.USER,
      });

      await AuditLog.log({
        action: AUDIT_ACTIONS.CREATE,
        resourceType: RESOURCE_TYPES.USER,
        resourceId: user._id,
        userId: user._id,
        userEmail: user.email,
        success: true,
        metadata,
        details: "User registered successfully",
      });

      const accessToken = generateToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      logger.info(`New user registered: ${user.email}`);

      return {
        user: user.toJSON(),
        tokens: {
          accessToken,
          refreshToken,
        },
      };
    } catch (error) {
      logger.error("Registration error:", error);
      throw error;
    }
  }

  /**
   * Login user
   */
  async login(email, password, metadata = {}) {
    try {
      const user = await User.findByEmail(email);

      if (!user) {
        await AuditLog.logAuth(AUDIT_ACTIONS.LOGIN, null, email, false, {
          ...metadata,
          reason: "User not found",
        });
        throw new AppError("Invalid email or password", 401);
      }

      if (!user.password) {
        throw new AppError("Authentication error", 500);
      }

      if (user.isLocked()) {
        await AuditLog.logAuth(
          AUDIT_ACTIONS.LOGIN,
          user._id,
          user.email,
          false,
          { ...metadata, reason: "Account locked" },
        );
        throw new AppError(
          "Account is temporarily locked. Please try again later.",
          423,
        );
      }

      if (!user.isActive) {
        await AuditLog.logAuth(
          AUDIT_ACTIONS.LOGIN,
          user._id,
          user.email,
          false,
          { ...metadata, reason: "Account deactivated" },
        );
        throw new AppError("Account has been deactivated", 403);
      }

      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        await user.incLoginAttempts();
        await AuditLog.logAuth(
          AUDIT_ACTIONS.LOGIN,
          user._id,
          user.email,
          false,
          { ...metadata, reason: "Invalid password" },
        );
        throw new AppError("Invalid email or password", 401);
      }

      await user.resetLoginAttempts();

      await AuditLog.logAuth(
        AUDIT_ACTIONS.LOGIN,
        user._id,
        user.email,
        true,
        metadata,
      );

      const accessToken = generateToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      logger.info(`User logged in: ${user.email}`);

      return {
        user: user.toJSON(),
        tokens: {
          accessToken,
          refreshToken,
        },
      };
    } catch (error) {
      logger.error("Login error:", error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken) {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      const user = await User.findById(decoded.userId);

      if (!user || !user.isActive) {
        throw new AppError("Invalid refresh token", 401);
      }

      const newAccessToken = generateToken(user._id);
      logger.info(`Token refreshed for user: ${user.email}`);

      return { accessToken: newAccessToken };
    } catch (error) {
      logger.error("Token refresh error:", error);
      throw new AppError("Invalid or expired refresh token", 401);
    }
  }

  /**
   * Logout
   */
  async logout(userId, metadata = {}) {
    try {
      const user = await User.findById(userId);

      if (user) {
        await AuditLog.logAuth(
          AUDIT_ACTIONS.LOGOUT,
          user._id,
          user.email,
          true,
          metadata,
        );
        logger.info(`User logged out: ${user.email}`);
      }

      return { message: "Logged out successfully" };
    } catch (error) {
      logger.error("Logout error:", error);
      throw error;
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }
    return user;
  }

  /**
   * Update profile
   */
  async updateProfile(userId, updates) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const allowedUpdates = ["firstName", "lastName"];
    allowedUpdates.forEach((field) => {
      if (updates[field] !== undefined) {
        user[field] = updates[field];
      }
    });

    await user.save();

    await AuditLog.logResourceChange(
      AUDIT_ACTIONS.UPDATE,
      RESOURCE_TYPES.USER,
      user._id,
      userId,
      { after: updates },
    );

    logger.info(`User profile updated: ${user.email}`);
    return user;
  }

  /**
   * Change password
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      // Fetch user with password field
      const user = await User.findById(userId).select("+password");

      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Verify current password
      const isValid = await user.comparePassword(currentPassword);
      if (!isValid) {
        throw new AppError("Current password is incorrect", 401);
      }

      // Set new password (will be hashed by pre-save hook)
      user.password = newPassword;

      // Save and wait for completion
      await user.save();

      // Verify save was successful by refetching
      const savedUser = await User.findById(userId).select("+password");
      if (!savedUser) {
        throw new AppError("Failed to save password change", 500);
      }

      // Log the password change
      await AuditLog.log({
        action: AUDIT_ACTIONS.UPDATE,
        resourceType: RESOURCE_TYPES.USER,
        resourceId: savedUser._id,
        userId: savedUser._id,
        userEmail: savedUser.email,
        success: true,
        details: "Password changed successfully",
      });

      logger.info(`Password changed for user: ${savedUser.email}`);

      return { message: "Password changed successfully" };
    } catch (error) {
      logger.error("Password change error:", error);
      throw error;
    }
  }
}

module.exports = new AuthService();
