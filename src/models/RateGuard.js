const mongoose = require("mongoose");
const { ROLES } = require("./User");

/**
 * Rate Guard Schema
 * Defines rate limiting rules for API endpoints
 */
const rateGuardSchema = new mongoose.Schema(
  {
    routePath: {
      type: String,
      required: [true, "Route path is required"],
      trim: true,
      index: true,
    },
    method: {
      type: String,
      enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "ALL"],
      default: "ALL",
      uppercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    // Role-specific rate limits
    limits: {
      admin: {
        maxRequests: { type: Number, default: 1000 },
        windowMs: { type: Number, default: 60000 }, // 1 minute
      },
      user: {
        maxRequests: { type: Number, default: 100 },
        windowMs: { type: Number, default: 60000 },
      },
      guest: {
        maxRequests: { type: Number, default: 10 },
        windowMs: { type: Number, default: 60000 },
      },
    },
    // Global limit (applies to all roles)
    globalLimit: {
      maxRequests: { type: Number },
      windowMs: { type: Number },
    },
    // IP-based limiting
    ipBased: {
      type: Boolean,
      default: false,
    },
    // Block on limit exceeded
    blockDuration: {
      type: Number, // milliseconds
      default: 0, // 0 = no blocking, just rate limit
    },
    // Custom error message
    errorMessage: {
      type: String,
      default: "Rate limit exceeded. Please try again later.",
    },
    // Whitelist (IPs or user IDs that bypass rate limiting)
    whitelist: [
      {
        type: String,
      },
    ],
    // Metadata
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

/**
 * Compound index for route and method lookup
 */
rateGuardSchema.index({ routePath: 1, method: 1 });
rateGuardSchema.index({ enabled: 1 });

/**
 * Get rate limit for specific role
 */
rateGuardSchema.methods.getLimitForRole = function (role) {
  if (!this.enabled) {
    return null;
  }

  // Check if global limit exists and should be applied
  if (this.globalLimit && this.globalLimit.maxRequests) {
    return {
      maxRequests: this.globalLimit.maxRequests,
      windowMs: this.globalLimit.windowMs,
    };
  }

  // Return role-specific limit
  const roleLimit = this.limits[role];
  if (!roleLimit) {
    return this.limits.user; // Default to user limits
  }

  return roleLimit;
};

/**
 * Check if identifier is whitelisted
 */
rateGuardSchema.methods.isWhitelisted = function (identifier) {
  return this.whitelist.includes(identifier);
};

/**
 * Static method to find rate guard rule for route
 */
rateGuardSchema.statics.findRuleForRoute = async function (
  routePath,
  method = "ALL",
) {
  // Try exact match first
  let rule = await this.findOne({
    routePath,
    method: method.toUpperCase(),
    enabled: true,
  });

  // Try with ALL method if specific method not found
  if (!rule && method !== "ALL") {
    rule = await this.findOne({
      routePath,
      method: "ALL",
      enabled: true,
    });
  }

  // Try pattern matching for wildcard routes
  if (!rule) {
    const rules = await this.find({ enabled: true });
    rule = rules.find((r) => {
      const pattern = r.routePath
        .replace(/\*/g, ".*")
        .replace(/:\w+/g, "[^/]+");
      const regex = new RegExp(`^${pattern}$`);
      return (
        regex.test(routePath) &&
        (r.method === "ALL" || r.method === method.toUpperCase())
      );
    });
  }

  return rule;
};

/**
 * Get all active rate guard rules
 */
rateGuardSchema.statics.getActiveRules = async function () {
  return this.find({ enabled: true }).sort({ routePath: 1 });
};

/**
 * Virtual for display name
 */
rateGuardSchema.virtual("displayName").get(function () {
  return `${this.method} ${this.routePath}`;
});

/**
 * Pre-save validation
 */
rateGuardSchema.pre("save", function (next) {
  // Ensure at least one limit is defined
  const hasLimit =
    this.globalLimit?.maxRequests ||
    Object.values(this.limits).some((limit) => limit.maxRequests > 0);

  if (!hasLimit) {
    next(new Error("At least one rate limit must be defined"));
  }

  next();
});

/**
 * Format for rate limiter middleware
 */
rateGuardSchema.methods.toRateLimiterConfig = function (role) {
  const limit = this.getLimitForRole(role);

  if (!limit) {
    return null;
  }

  return {
    windowMs: limit.windowMs,
    max: limit.maxRequests,
    message: this.errorMessage,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) =>
      this.isWhitelisted(req.ip) || this.isWhitelisted(req.user?.id),
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: this.errorMessage,
        retryAfter: Math.ceil(limit.windowMs / 1000),
      });
    },
  };
};

const RateGuard = mongoose.model("RateGuard", rateGuardSchema);

module.exports = RateGuard;
