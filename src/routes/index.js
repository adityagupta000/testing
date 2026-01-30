/**
 * Routes Index
 * Centralized routing configuration
 */

const express = require("express");
const router = express.Router();

// Import route modules
const authRoutes = require("./auth.routes");
const userRoutes = require("./users.routes");
const featureRoutes = require("./features.routes");
const rateGuardRoutes = require("./rateGuards.routes");
const auditRoutes = require("./audit.routes");
const systemRoutes = require("./system.routes");

// Mount routes
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/features", featureRoutes);
router.use("/rate-guards", rateGuardRoutes);
router.use("/audit", auditRoutes);

// System routes are mounted at root level
router.use("/", systemRoutes);

// API documentation endpoint
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Policy-Driven Feature Toggle & Rate Guard Service API",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      users: "/api/users",
      features: "/api/features",
      rateGuards: "/api/rate-guards",
      audit: "/api/audit",
      health: "/api/health",
      status: "/api/status",
    },
    documentation: "See README.md for detailed API documentation",
  });
});

module.exports = router;
