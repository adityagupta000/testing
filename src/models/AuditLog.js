const mongoose = require("mongoose");

/**
 * Audit Log Actions Enum
 */
const AUDIT_ACTIONS = {
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  LOGIN: "login",
  LOGOUT: "logout",
  ACCESS_DENIED: "access_denied",
  RATE_LIMIT_EXCEEDED: "rate_limit_exceeded",
};

/**
 * Audit Log Resource Types
 */
const RESOURCE_TYPES = {
  USER: "user",
  FEATURE_TOGGLE: "feature_toggle",
  RATE_GUARD: "rate_guard",
  AUTH: "auth",
  API: "api",
};

/**
 * Audit Log Schema
 * Tracks all significant system events and changes
 */
const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: [true, "Action is required"],
      enum: Object.values(AUDIT_ACTIONS),
      index: true,
    },
    resourceType: {
      type: String,
      required: [true, "Resource type is required"],
      enum: Object.values(RESOURCE_TYPES),
      index: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    resourceName: {
      type: String,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    userEmail: {
      type: String,
      trim: true,
    },
    userRole: {
      type: String,
    },
    // What changed
    changes: {
      before: {
        type: mongoose.Schema.Types.Mixed,
      },
      after: {
        type: mongoose.Schema.Types.Mixed,
      },
    },
    // Request metadata
    metadata: {
      ip: String,
      userAgent: String,
      method: String,
      path: String,
      statusCode: Number,
      duration: Number, // milliseconds
      errorMessage: String,
    },
    // Success/failure
    success: {
      type: Boolean,
      default: true,
    },
    // Additional details
    details: {
      type: String,
      trim: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

/**
 * Indexes for common queries
 */
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ success: 1, createdAt: -1 });

/**
 * TTL index - auto-delete logs older than 90 days
 */
auditLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 },
);

/**
 * Static method to log an event
 */
auditLogSchema.statics.log = async function (data) {
  try {
    const log = new this(data);
    await log.save();
    return log;
  } catch (error) {
    console.error("Failed to create audit log:", error);
    // Don't throw - audit logging should not break the application
    return null;
  }
};

/**
 * Static method to log authentication events
 */
auditLogSchema.statics.logAuth = async function (
  action,
  userId,
  userEmail,
  success,
  metadata = {},
) {
  return this.log({
    action,
    resourceType: RESOURCE_TYPES.AUTH,
    userId,
    userEmail,
    success,
    metadata,
    details: `User ${success ? "successfully" : "failed to"} ${action}`,
  });
};

/**
 * Static method to log resource changes
 */
auditLogSchema.statics.logResourceChange = async function (
  action,
  resourceType,
  resourceId,
  userId,
  changes,
  metadata = {},
) {
  return this.log({
    action,
    resourceType,
    resourceId,
    userId,
    changes,
    metadata,
    success: true,
  });
};

/**
 * Static method to log API access
 */
auditLogSchema.statics.logApiAccess = async function (
  req,
  statusCode,
  duration,
) {
  return this.log({
    action: AUDIT_ACTIONS.ACCESS_DENIED,
    resourceType: RESOURCE_TYPES.API,
    userId: req.user?._id,
    userEmail: req.user?.email,
    userRole: req.user?.role,
    metadata: {
      ip: req.ip,
      userAgent: req.get("user-agent"),
      method: req.method,
      path: req.path,
      statusCode,
      duration,
    },
    success: statusCode < 400,
  });
};

/**
 * Get audit logs for a specific user
 */
auditLogSchema.statics.getUserLogs = async function (userId, limit = 50) {
  return this.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();
};

/**
 * Get audit logs for a specific resource
 */
auditLogSchema.statics.getResourceLogs = async function (
  resourceType,
  resourceId,
  limit = 50,
) {
  return this.find({ resourceType, resourceId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("userId", "email role")
    .lean();
};

/**
 * Get failed actions
 */
auditLogSchema.statics.getFailedActions = async function (
  hours = 24,
  limit = 100,
) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  return this.find({
    success: false,
    createdAt: { $gte: since },
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

/**
 * Get statistics
 */
auditLogSchema.statics.getStats = async function (startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $group: {
        _id: {
          action: "$action",
          resourceType: "$resourceType",
          success: "$success",
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { count: -1 },
    },
  ]);
};

/**
 * Virtual for formatted timestamp
 */
auditLogSchema.virtual("formattedDate").get(function () {
  return this.createdAt.toISOString();
});

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

module.exports = {
  AuditLog,
  AUDIT_ACTIONS,
  RESOURCE_TYPES,
};
