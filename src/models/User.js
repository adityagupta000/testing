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
      select: false,
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
 * CRITICAL FIX: Most robust password hash detection
 */
userSchema.pre("save", async function (next) {
  try {
    // Only proceed if password field exists and is modified
    if (!this.password || !this.isModified("password")) {
      return next();
    }

    // CRITICAL FIX: Check if password is already a bcrypt hash
    // Bcrypt hashes have a very specific format:
    // - Always start with $2a$, $2b$, or $2y$
    // - Followed by cost factor (e.g., $10$)
    // - Total length is always 60 characters
    // - Format: $2[aby]$[0-9]{2}$[./A-Za-z0-9]{53}

    const isBcryptHash = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(
      this.password,
    );

    if (isBcryptHash) {
      // Password is already hashed, don't hash again
      return next();
    }

    // Hash the plaintext password
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Compare password method
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    // Ensure we have a password to compare
    if (!this.password) {
      throw new Error("Password not available for comparison");
    }

    if (!candidatePassword) {
      return false;
    }

    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
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
 * Returns the updated document
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
  return this;
};

/**
 * Reset login attempts
 * Returns the updated document
 */
userSchema.methods.resetLoginAttempts = async function () {
  this.loginAttempts = 0;
  this.lastLogin = new Date();
  this.lockUntil = undefined;
  await this.save();
  return this;
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
