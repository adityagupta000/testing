const mongoose = require("mongoose");
const { ROLES } = require("./User");

/**
 * Feature Toggle Schema
 * Defines which features are accessible to which roles
 */
const featureToggleSchema = new mongoose.Schema(
  {
    featureName: {
      type: String,
      required: [true, "Feature name is required"],
      unique: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    // Which roles can access this feature
    allowedRoles: [
      {
        type: String,
        enum: Object.values(ROLES),
      },
    ],
    // Environment-specific settings
    environments: {
      development: {
        enabled: { type: Boolean, default: true },
      },
      staging: {
        enabled: { type: Boolean, default: true },
      },
      production: {
        enabled: { type: Boolean, default: false },
      },
    },
    // Percentage rollout (0-100)
    rolloutPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 100,
    },
    // Feature dependencies
    dependsOn: [
      {
        type: String, // Other feature names
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
 * Indexes for performance
 */
featureToggleSchema.index({ featureName: 1, enabled: 1 });
featureToggleSchema.index({ createdAt: -1 });

/**
 * Check if feature is enabled for a specific role and environment
 */
featureToggleSchema.methods.isEnabledFor = function (
  role,
  environment = "development",
) {
  // Check if feature is globally enabled
  if (!this.enabled) {
    return false;
  }

  // Check environment-specific setting
  if (
    this.environments[environment] &&
    !this.environments[environment].enabled
  ) {
    return false;
  }

  // Check role access
  if (this.allowedRoles.length === 0) {
    return true; // No role restriction = available to all
  }

  return this.allowedRoles.includes(role);
};

/**
 * Check if feature should be rolled out to user (based on percentage)
 */
featureToggleSchema.methods.shouldRollout = function (userId) {
  if (this.rolloutPercentage === 100) {
    return true;
  }

  if (this.rolloutPercentage === 0) {
    return false;
  }

  // Use consistent hash of userId to determine rollout
  const hash = userId
    .toString()
    .split("")
    .reduce((acc, char) => {
      return (acc << 5) - acc + char.charCodeAt(0);
    }, 0);

  const userPercentile = Math.abs(hash % 100);
  return userPercentile < this.rolloutPercentage;
};

/**
 * Static method to check if feature is enabled
 */
featureToggleSchema.statics.checkFeature = async function (
  featureName,
  role,
  environment,
  userId,
) {
  const feature = await this.findOne({ featureName, enabled: true });

  if (!feature) {
    return false;
  }

  // Check role and environment
  if (!feature.isEnabledFor(role, environment)) {
    return false;
  }

  // Check rollout percentage
  if (userId && !feature.shouldRollout(userId)) {
    return false;
  }

  return true;
};

/**
 * Get all enabled features for a role
 */
featureToggleSchema.statics.getEnabledFeatures = async function (
  role,
  environment = "development",
) {
  const features = await this.find({ enabled: true });

  return features.filter((feature) => feature.isEnabledFor(role, environment));
};

/**
 * Pre-save validation
 */
featureToggleSchema.pre("save", function (next) {
  // Ensure at least one environment is enabled if feature is enabled
  if (this.enabled) {
    const hasEnabledEnv = Object.values(this.environments).some(
      (env) => env.enabled,
    );
    if (!hasEnabledEnv && this.isNew) {
      this.environments.development.enabled = true;
    }
  }
  next();
});

const FeatureToggle = mongoose.model("FeatureToggle", featureToggleSchema);

module.exports = FeatureToggle;
