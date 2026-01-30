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
 */
class AuthService {
  /**
   * Register a new user
   */
  async register(userData, metadata = {}) {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email });

      if (existingUser) {
        throw new AppError("User with this email already exists", 409);
      }

      // Create user with default role
      const user = await User.create({
        ...userData,
        role: userData.role || ROLES.USER,
      });

      // Log registration
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

      // Generate tokens
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
      // Find user with password field
      const user = await User.findByEmail(email);

      if (!user) {
        // Log failed login attempt
        await AuditLog.logAuth(AUDIT_ACTIONS.LOGIN, null, email, false, {
          ...metadata,
          reason: "User not found",
        });

        throw new AppError("Invalid email or password", 401);
      }

      // Check if account is locked
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

      // Check if account is active
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

      // Verify password
      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        // Increment failed login attempts
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

      // Reset login attempts on successful login
      await user.resetLoginAttempts();

      // Log successful login
      await AuditLog.logAuth(
        AUDIT_ACTIONS.LOGIN,
        user._id,
        user.email,
        true,
        metadata,
      );

      // Generate tokens
      const accessToken = generateToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      logger.info(`User logged in: ${user.email}`);

      // Remove password from response
      const userResponse = user.toJSON();

      return {
        user: userResponse,
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
      // Verify refresh token
      const decoded = verifyRefreshToken(refreshToken);

      // Find user
      const user = await User.findById(decoded.userId);

      if (!user || !user.isActive) {
        throw new AppError("Invalid refresh token", 401);
      }

      // Generate new access token
      const newAccessToken = generateToken(user._id);

      logger.info(`Token refreshed for user: ${user.email}`);

      return {
        accessToken: newAccessToken,
      };
    } catch (error) {
      logger.error("Token refresh error:", error);
      throw new AppError("Invalid or expired refresh token", 401);
    }
  }

  /**
   * Logout user
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
   * Get current user profile
   */
  async getCurrentUser(userId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new AppError("User not found", 404);
      }

      return user;
    } catch (error) {
      logger.error("Get current user error:", error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(userId, updates) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Store old values for audit
      const oldValues = {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      };

      // Update allowed fields
      const allowedUpdates = ["firstName", "lastName"];
      allowedUpdates.forEach((field) => {
        if (updates[field] !== undefined) {
          user[field] = updates[field];
        }
      });

      await user.save();

      // Log update
      await AuditLog.logResourceChange(
        AUDIT_ACTIONS.UPDATE,
        RESOURCE_TYPES.USER,
        user._id,
        userId,
        { before: oldValues, after: updates },
      );

      logger.info(`User profile updated: ${user.email}`);

      return user;
    } catch (error) {
      logger.error("Update profile error:", error);
      throw error;
    }
  }

  /**
   * Change password
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await User.findById(userId).select("+password");

      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Verify current password
      const isPasswordValid = await user.comparePassword(currentPassword);

      if (!isPasswordValid) {
        throw new AppError("Current password is incorrect", 401);
      }

      // Update password
      user.password = newPassword;
      await user.save();

      // Log password change
      await AuditLog.log({
        action: AUDIT_ACTIONS.UPDATE,
        resourceType: RESOURCE_TYPES.USER,
        resourceId: user._id,
        userId: user._id,
        userEmail: user.email,
        success: true,
        details: "Password changed successfully",
      });

      logger.info(`Password changed for user: ${user.email}`);

      return { message: "Password changed successfully" };
    } catch (error) {
      logger.error("Change password error:", error);
      throw error;
    }
  }
}

module.exports = new AuthService();
