const { User, FeatureToggle, RateGuard, ROLES } = require("../src/models");
const { generateToken } = require("../src/middleware/auth");

/**
 * Create test user
 */
const createTestUser = async (overrides = {}) => {
  const defaultUser = {
    email: `test-${Date.now()}@example.com`,
    password: "password123",
    firstName: "Test",
    lastName: "User",
    role: ROLES.USER,
    isActive: true,
  };

  const user = await User.create({ ...defaultUser, ...overrides });
  // FIXED: Ensure user is fully persisted before returning
  await user.save();
  return user;
};

/**
 * Create test admin
 */
const createTestAdmin = async (overrides = {}) => {
  const admin = await createTestUser({ ...overrides, role: ROLES.ADMIN });
  // FIXED: Ensure admin is fully persisted
  await admin.save();
  return admin;
};

/**
 * Create test guest
 */
const createTestGuest = async (overrides = {}) => {
  return createTestUser({ ...overrides, role: ROLES.GUEST });
};

/**
 * Generate auth token for user
 */
const getAuthToken = (userId) => {
  return generateToken(userId);
};

/**
 * Create authenticated request header
 */
const getAuthHeader = (token) => {
  return { Authorization: `Bearer ${token}` };
};

/**
 * Create test feature toggle
 */
const createTestFeature = async (userId, overrides = {}) => {
  const defaultFeature = {
    featureName: `test-feature-${Date.now()}`,
    description: "Test feature",
    enabled: true,
    allowedRoles: [ROLES.ADMIN, ROLES.USER],
    rolloutPercentage: 100,
    environments: {
      development: { enabled: true },
      staging: { enabled: true },
      production: { enabled: false },
    },
    createdBy: userId,
  };

  const feature = await FeatureToggle.create({
    ...defaultFeature,
    ...overrides,
  });
  return feature;
};

/**
 * Create test rate guard rule
 */
const createTestRateGuard = async (userId, overrides = {}) => {
  const defaultRule = {
    routePath: `/test/${Date.now()}`,
    method: "ALL",
    description: "Test rate guard rule",
    enabled: true,
    limits: {
      admin: {
        maxRequests: 1000,
        windowMs: 60000,
      },
      user: {
        maxRequests: 100,
        windowMs: 60000,
      },
      guest: {
        maxRequests: 10,
        windowMs: 60000,
      },
    },
    createdBy: userId,
  };

  const rule = await RateGuard.create({ ...defaultRule, ...overrides });
  return rule;
};

/**
 * Wait for async operations
 */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Extract error message from response
 */
const getErrorMessage = (response) => {
  return response.body.message || response.body.error || "Unknown error";
};

module.exports = {
  createTestUser,
  createTestAdmin,
  createTestGuest,
  getAuthToken,
  getAuthHeader,
  createTestFeature,
  createTestRateGuard,
  wait,
  getErrorMessage,
};
