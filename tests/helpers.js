const { User, FeatureToggle, RateGuard, ROLES } = require("../src/models");
const { generateToken } = require("../src/middleware/auth");

/**
 * Create test user with proper async handling
 */
const createTestUser = async (overrides = {}) => {
  const defaultUser = {
    email: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`,
    password: "password123",
    firstName: "Test",
    lastName: "User",
    role: ROLES.USER,
    isActive: true,
  };

  const user = await User.create({ ...defaultUser, ...overrides });

  // Ensure user is fully persisted with retry logic
  let dbUser = null;
  let retries = 0;
  while (!dbUser && retries < 10) {
    dbUser = await User.findById(user._id);
    if (!dbUser) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    retries++;
  }

  if (!dbUser) {
    throw new Error(`User ${user.email} not found in database after creation`);
  }

  return dbUser;
};

/**
 * Create test admin with proper async handling
 */
const createTestAdmin = async (overrides = {}) => {
  const admin = await createTestUser({ ...overrides, role: ROLES.ADMIN });

  // Additional verification for admin
  const dbAdmin = await User.findById(admin._id);
  if (!dbAdmin || dbAdmin.role !== ROLES.ADMIN) {
    throw new Error("Admin user verification failed");
  }

  return dbAdmin;
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
  if (!userId) {
    throw new Error("userId is required for token generation");
  }
  return generateToken(userId);
};

/**
 * Create authenticated request header
 */
const getAuthHeader = (token) => {
  if (!token) {
    throw new Error("token is required for auth header");
  }
  return { Authorization: `Bearer ${token}` };
};

/**
 * Create test feature toggle with proper async handling
 */
const createTestFeature = async (userId, overrides = {}) => {
  if (!userId) {
    throw new Error("userId is required for feature creation");
  }

  const defaultFeature = {
    featureName: `test-feature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

  // Ensure feature is fully persisted
  const dbFeature = await FeatureToggle.findById(feature._id);
  if (!dbFeature) {
    throw new Error(
      `Feature ${feature.featureName} not found in database after creation`,
    );
  }

  return dbFeature;
};

/**
 * Create test rate guard rule with proper async handling
 */
const createTestRateGuard = async (userId, overrides = {}) => {
  if (!userId) {
    throw new Error("userId is required for rate guard creation");
  }

  const defaultRule = {
    routePath: `/test/${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

  // Ensure rule is fully persisted
  const dbRule = await RateGuard.findById(rule._id);
  if (!dbRule) {
    throw new Error(
      `Rate guard ${rule.displayName} not found in database after creation`,
    );
  }

  return dbRule;
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
