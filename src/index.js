const app = require("./app");
const config = require("./config");
const database = require("./config/database");
const logger = require("./utils/logger");
const { User, ROLES } = require("./models");

/**
 * Start Server
 */
const startServer = async () => {
  try {
    // Connect to database
    await database.connect();
    logger.info("Database connection established");

    // Create default admin user if not exists
    await createDefaultAdmin();

    // Start Express server
    const server = app.listen(config.port, () => {
      logger.info(`Server started successfully`);
      logger.info(`Environment: ${config.env}`);
      logger.info(`Port: ${config.port}`);
      logger.info(`API: http://localhost:${config.port}/api`);
      logger.info(`Health: http://localhost:${config.port}/api/health`);
    });

    // Graceful shutdown
    process.on("SIGTERM", () => gracefulShutdown(server));
    process.on("SIGINT", () => gracefulShutdown(server));
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

/**
 * Create Default Admin User
 */
const createDefaultAdmin = async () => {
  try {
    const adminExists = await User.findOne({ role: ROLES.ADMIN });

    if (!adminExists) {
      const admin = await User.create({
        email: config.admin.email,
        password: config.admin.password,
        role: ROLES.ADMIN,
        firstName: "System",
        lastName: "Administrator",
        isActive: true,
      });

      logger.info(`Default admin user created: ${admin.email}`);
      logger.warn(`Please change the default admin password immediately!`);
    } else {
      logger.info("Admin user already exists");
    }
  } catch (error) {
    logger.error("Failed to create default admin:", error);
  }
};

/**
 * Graceful Shutdown
 */
const gracefulShutdown = async (server) => {
  logger.info("Received shutdown signal, closing server gracefully...");

  // Stop accepting new requests
  server.close(async () => {
    logger.info("HTTP server closed");

    try {
      // Close database connection
      await database.disconnect();
      logger.info("Database connection closed");

      logger.info("Graceful shutdown completed");
      process.exit(0);
    } catch (error) {
      logger.error("Error during shutdown:", error);
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error("Forcing shutdown due to timeout");
    process.exit(1);
  }, 30000);
};

// Start the server
startServer();
