const mongoose = require("mongoose");

/**
 * Setup test environment before all tests
 */
beforeAll(async () => {
  try {
    // Use MongoDB from docker-compose.test.yml or fallback to local
    const mongoUri =
      process.env.MONGODB_TEST_URI ||
      "mongodb://localhost:27017/policy-toggle-service-test";

    // Connect to the containerized MongoDB
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✓ Test database connected");
  } catch (error) {
    console.error("Failed to connect to test database:", error);
    throw error;
  }
});

/**
 * Clear database between tests
 */
afterEach(async () => {
  try {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  } catch (error) {
    console.error("Failed to clear database:", error);
  }
});

/**
 * Cleanup after all tests
 */
afterAll(async () => {
  try {
    // Close mongoose connection
    await mongoose.connection.close();
    console.log("✓ Test database closed");
  } catch (error) {
    console.error("Failed to close database connection:", error);
  }
});

/**
 * Global test timeout
 */
jest.setTimeout(30000);

/**
 * Suppress console logs during tests (optional)
 */
if (process.env.SUPPRESS_LOGS === "true") {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}
