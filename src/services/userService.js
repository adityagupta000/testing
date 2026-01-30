const { User, ROLES } = require("../models");
const {
  AuditLog,
  AUDIT_ACTIONS,
  RESOURCE_TYPES,
} = require("../models/AuditLog");
const { AppError } = require("../middleware/errorHandler");
const logger = require("../utils/logger");

/**
 * User Service
 */
class UserService {
  /**
   * Get all users with filtering and pagination
   */
  async getAllUsers(filters = {}, pagination = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sort = "-createdAt",
        search = "",
      } = pagination;

      const query = {};

      // Apply role filter
      if (filters.role) {
        query.role = filters.role;
      }

      // Apply active status filter
      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
      }

      // Apply search
      if (search) {
        query.$or = [
          { email: { $regex: search, $options: "i" } },
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
        ];
      }

      const skip = (page - 1) * limit;

      const [users, total] = await Promise.all([
        User.find(query).sort(sort).skip(skip).limit(limit).lean(),
        User.countDocuments(query),
      ]);

      return {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Get all users error:", error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new AppError("User not found", 404);
      }

      return user;
    } catch (error) {
      logger.error("Get user by ID error:", error);
      throw error;
    }
  }

  /**
   * Update user (Admin function)
   */
  async updateUser(userId, updates, adminId) {
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
        role: user.role,
        isActive: user.isActive,
      };

      // Update allowed fields
      const allowedUpdates = [
        "firstName",
        "lastName",
        "email",
        "role",
        "isActive",
      ];
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
        adminId,
        { before: oldValues, after: updates },
      );

      logger.info(`User updated: ${user.email} by admin ${adminId}`);

      return user;
    } catch (error) {
      logger.error("Update user error:", error);
      throw error;
    }
  }

  /**
   * Deactivate user
   */
  async deactivateUser(userId, adminId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new AppError("User not found", 404);
      }

      if (!user.isActive) {
        throw new AppError("User is already deactivated", 400);
      }

      user.isActive = false;
      await user.save();

      // Log deactivation
      await AuditLog.log({
        action: AUDIT_ACTIONS.UPDATE,
        resourceType: RESOURCE_TYPES.USER,
        resourceId: user._id,
        userId: adminId,
        success: true,
        details: `User deactivated: ${user.email}`,
      });

      logger.info(`User deactivated: ${user.email} by admin ${adminId}`);

      return user;
    } catch (error) {
      logger.error("Deactivate user error:", error);
      throw error;
    }
  }

  /**
   * Activate user
   */
  async activateUser(userId, adminId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new AppError("User not found", 404);
      }

      if (user.isActive) {
        throw new AppError("User is already active", 400);
      }

      user.isActive = true;
      await user.save();

      // Log activation
      await AuditLog.log({
        action: AUDIT_ACTIONS.UPDATE,
        resourceType: RESOURCE_TYPES.USER,
        resourceId: user._id,
        userId: adminId,
        success: true,
        details: `User activated: ${user.email}`,
      });

      logger.info(`User activated: ${user.email} by admin ${adminId}`);

      return user;
    } catch (error) {
      logger.error("Activate user error:", error);
      throw error;
    }
  }

  /**
   * Delete user
   */
  async deleteUser(userId, adminId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Prevent self-deletion
      if (userId === adminId) {
        throw new AppError("You cannot delete your own account", 400);
      }

      const userEmail = user.email;

      await user.deleteOne();

      // Log deletion
      await AuditLog.logResourceChange(
        AUDIT_ACTIONS.DELETE,
        RESOURCE_TYPES.USER,
        userId,
        adminId,
        { before: user.toJSON() },
      );

      logger.info(`User deleted: ${userEmail} by admin ${adminId}`);

      return { message: "User deleted successfully", email: userEmail };
    } catch (error) {
      logger.error("Delete user error:", error);
      throw error;
    }
  }

  /**
   * Change user role
   */
  async changeUserRole(userId, newRole, adminId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new AppError("User not found", 404);
      }

      const oldRole = user.role;

      if (oldRole === newRole) {
        throw new AppError("User already has this role", 400);
      }

      user.role = newRole;
      await user.save();

      // Log role change
      await AuditLog.logResourceChange(
        AUDIT_ACTIONS.UPDATE,
        RESOURCE_TYPES.USER,
        user._id,
        adminId,
        {
          before: { role: oldRole },
          after: { role: newRole },
        },
      );

      logger.info(
        `User role changed: ${user.email} from ${oldRole} to ${newRole}`,
      );

      return user;
    } catch (error) {
      logger.error("Change user role error:", error);
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats() {
    try {
      const total = await User.countDocuments();
      const active = await User.countDocuments({ isActive: true });
      const inactive = total - active;

      const byRole = await User.aggregate([
        {
          $group: {
            _id: "$role",
            count: { $sum: 1 },
          },
        },
      ]);

      const recentLogins = await User.find({ lastLogin: { $exists: true } })
        .sort({ lastLogin: -1 })
        .limit(10)
        .select("email lastLogin role");

      return {
        total,
        active,
        inactive,
        byRole: byRole.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        recentLogins,
      };
    } catch (error) {
      logger.error("Get user stats error:", error);
      throw error;
    }
  }

  /**
   * Unlock user account
   */
  async unlockUser(userId, adminId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new AppError("User not found", 404);
      }

      user.loginAttempts = 0;
      user.lockUntil = undefined;
      await user.save();

      // Log unlock
      await AuditLog.log({
        action: AUDIT_ACTIONS.UPDATE,
        resourceType: RESOURCE_TYPES.USER,
        resourceId: user._id,
        userId: adminId,
        success: true,
        details: `User account unlocked: ${user.email}`,
      });

      logger.info(`User unlocked: ${user.email} by admin ${adminId}`);

      return user;
    } catch (error) {
      logger.error("Unlock user error:", error);
      throw error;
    }
  }
}

module.exports = new UserService();
