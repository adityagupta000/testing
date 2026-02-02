require("dotenv").config();

/**
 * Centralized Application Configuration
 * All environment variables are validated and exported from here
 */

const config = {
  // Server
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT, 10) || 3000,
  apiVersion: process.env.API_VERSION || "v1",

  // Database
  mongodb: {
    uri:
      process.env.NODE_ENV === "test"
        ? process.env.MONGODB_TEST_URI
        : process.env.MONGODB_URI,
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || "fallback-secret-key",
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || "info",
    file: process.env.LOG_FILE || "logs/app.log",
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3001",
    credentials: true,
  },

  // Admin
  admin: {
    email: process.env.ADMIN_EMAIL || "admin@example.com",
    password: process.env.ADMIN_PASSWORD || "Admin@123456",
  },

  // Feature Flags (Default System Features)
  features: {
    enableAuditLog: true,
    enableRateGuard: true,
    enableFeatureToggle: true,
  },
};

// Validation
const requiredEnvVars = ["JWT_SECRET"];
const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName],
);

if (missingEnvVars.length > 0 && config.env === "production") {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`,
  );
}

module.exports = config;
