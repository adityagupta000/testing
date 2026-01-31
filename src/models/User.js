const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

/**
 * User Roles Enum
 */
const ROLES = {
  ADMIN: "admin",
  USER: "user",
  GUEST: "guest",
};

/**
 * User Schema
 */
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Don't return password by default
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.USER,
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  },
);

/**
 * Pre-save hook to hash password
 */
userSchema.pre("save", async function (next) {
  // Only hash if password is modified
  if (!this.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Compare password method
 * FIXED: Better error handling and validation
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    // Ensure we have a password to compare
    if (!this.password) {
      throw new Error("Password not available for comparison");
    }

    if (!candidatePassword) {
      throw new Error("Candidate password is required");
    }

    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    // Log the actual error for debugging
    console.error("Password comparison error:", error.message);
    throw new Error("Password comparison failed");
  }
};

/**
 * Check if account is locked
 */
userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

/**
 * Increment login attempts
 * FIXED: Returns the updated document
 */
userSchema.methods.incLoginAttempts = async function () {
  // Reset attempts if lock has expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    this.loginAttempts = 1;
    this.lockUntil = undefined;
    await this.save();
    return this;
  }

  this.loginAttempts += 1;

  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts >= 5 && !this.isLocked()) {
    this.lockUntil = Date.now() + 2 * 60 * 60 * 1000;
  }

  await this.save();
  return this; // FIXED: Return the document
};

/**
 * Reset login attempts
 */
userSchema.methods.resetLoginAttempts = async function () {
  return this.updateOne({
    $set: { loginAttempts: 0, lastLogin: new Date() },
    $unset: { lockUntil: 1 },
  });
};

/**
 * Get full name
 */
userSchema.virtual("fullName").get(function () {
  return `${this.firstName || ""} ${this.lastName || ""}`.trim() || "Anonymous";
});

/**
 * Static method to find by email
 */
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() }).select("+password");
};

/**
 * Check if user has role
 */
userSchema.methods.hasRole = function (role) {
  return this.role === role;
};

/**
 * Check if user is admin
 */
userSchema.methods.isAdmin = function () {
  return this.role === ROLES.ADMIN;
};

const User = mongoose.model("User", userSchema);

module.exports = {
  User,
  ROLES,
};
