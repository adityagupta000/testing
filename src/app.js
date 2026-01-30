const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const config = require("./config");
const logger = require("./utils/logger");
const routes = require("./routes");
const {
  httpLogger,
  requestTimer,
  auditLogger,
  requestContext,
  sanitize,
  applyRateGuard,
  errorHandler,
  notFound,
} = require("./middleware");

/**
 * Create Express Application
 */
const app = express();

/**
 * Security Middleware
 */
app.use(helmet());
app.use(cors(config.cors));

/**
 * Request Processing Middleware
 */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/**
 * Logging Middleware
 */
app.use(httpLogger);
app.use(requestTimer);
app.use(requestContext);

/**
 * Input Sanitization
 */
app.use(sanitize);

/**
 * Trust proxy (for accurate IP addresses behind proxy/load balancer)
 */
app.set("trust proxy", 1);

/**
 * Apply Dynamic Rate Guard Middleware
 * This checks database rules and applies rate limiting
 */
app.use(applyRateGuard);

/**
 * Audit Logger (logs after response)
 */
app.use(auditLogger);

/**
 * API Routes
 */
app.use("/api", routes);

/**
 * Root Route
 */
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Policy-Driven Feature Toggle & Rate Guard Service",
    version: "1.0.0",
    status: "operational",
    api: "/api",
    health: "/api/health",
    documentation: "See README.md",
  });
});

/**
 * 404 Handler
 */
app.use(notFound);

/**
 * Global Error Handler
 */
app.use(errorHandler);

module.exports = app;
