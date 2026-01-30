const request = require("supertest");
const app = require("../../src/app");
const { User, FeatureToggle, ROLES } = require("../../src/models");
const {
  createTestAdmin,
  createTestUser,
  getAuthToken,
  getAuthHeader,
  createTestFeature,
} = require("../helpers");

describe("Feature Toggle System Flow", () => {
  let admin, adminToken;
  let user, userToken;

  beforeEach(async () => {
    // Create admin with proper database verification
    const createdAdmin = await createTestAdmin();

    // CRITICAL: Fetch the complete user from database with password field
    // This ensures the user is fully persisted and we have all fields
    let dbAdmin = await User.findById(createdAdmin._id).select("+password");
    let retries = 0;

    // Retry logic to handle timing issues
    while (!dbAdmin && retries < 10) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      dbAdmin = await User.findById(createdAdmin._id).select("+password");
      retries++;
    }

    if (!dbAdmin) {
      throw new Error("Admin user not found in database after creation");
    }

    // Set admin to the database version
    admin = dbAdmin;
    // Generate token using the verified database user
    adminToken = getAuthToken(admin._id);

    // Verify token works by making a test request
    const adminVerify = await request(app)
      .get("/api/auth/me")
      .set(getAuthHeader(adminToken));

    if (adminVerify.status !== 200) {
      throw new Error(
        `Admin token verification failed with status ${adminVerify.status}`,
      );
    }

    // Create regular user with same verification process
    const createdUser = await createTestUser();

    let dbUser = await User.findById(createdUser._id).select("+password");
    retries = 0;

    while (!dbUser && retries < 10) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      dbUser = await User.findById(createdUser._id).select("+password");
      retries++;
    }

    if (!dbUser) {
      throw new Error("Regular user not found in database after creation");
    }

    // Set user to the database version
    user = dbUser;
    // Generate token using the verified database user
    userToken = getAuthToken(user._id);

    // Verify token works
    const userVerify = await request(app)
      .get("/api/auth/me")
      .set(getAuthHeader(userToken));

    if (userVerify.status !== 200) {
      throw new Error(
        `User token verification failed with status ${userVerify.status}`,
      );
    }
  });

  describe("Complete Feature Toggle Lifecycle", () => {
    it("should complete full feature toggle lifecycle", async () => {
      // 1. Create Feature
      const featureData = {
        featureName: `new-dashboard-${Date.now()}`,
        description: "New dashboard UI",
        enabled: true,
        allowedRoles: [ROLES.ADMIN, ROLES.USER],
        rolloutPercentage: 100,
        environments: {
          development: { enabled: true },
          staging: { enabled: true },
          production: { enabled: false },
        },
      };

      const createRes = await request(app)
        .post("/api/features")
        .set(getAuthHeader(adminToken))
        .send(featureData);

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      expect(createRes.body.data.feature.featureName).toBe(
        featureData.featureName,
      );

      const featureId = createRes.body.data.feature._id;

      // Wait for database propagation
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 2. Get Feature Details
      const getRes = await request(app)
        .get(`/api/features/${featureId}`)
        .set(getAuthHeader(adminToken));

      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.feature._id).toBe(featureId);

      // 3. Update Feature
      const updateData = {
        description: "Updated dashboard UI",
        rolloutPercentage: 100,
      };

      const updateRes = await request(app)
        .put(`/api/features/${featureId}`)
        .set(getAuthHeader(adminToken))
        .send(updateData);

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.feature.description).toBe(
        updateData.description,
      );

      // 4. List All Features
      const listRes = await request(app)
        .get("/api/features")
        .set(getAuthHeader(adminToken));

      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);
      expect(listRes.body.data.features.length).toBeGreaterThan(0);

      // 5. Delete Feature
      const deleteRes = await request(app)
        .delete(`/api/features/${featureId}`)
        .set(getAuthHeader(adminToken));

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      // 6. Verify Deletion
      const verifyRes = await request(app)
        .get(`/api/features/${featureId}`)
        .set(getAuthHeader(adminToken));

      expect(verifyRes.status).toBe(404);
    });
  });

  describe("Role-Based Feature Access", () => {
    it("should enforce role-based feature access", async () => {
      // 1. Admin creates a feature for ADMIN only
      const adminOnlyFeature = {
        featureName: `admin-analytics-${Date.now()}`,
        description: "Admin analytics dashboard",
        enabled: true,
        allowedRoles: [ROLES.ADMIN],
        rolloutPercentage: 100,
      };

      const createRes = await request(app)
        .post("/api/features")
        .set(getAuthHeader(adminToken))
        .send(adminOnlyFeature);

      expect(createRes.status).toBe(201);
      const feature = createRes.body.data.feature;

      // Wait for database propagation
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 2. Check feature access for admin (should be allowed)
      const adminCheckRes = await request(app)
        .post("/api/features/check")
        .set(getAuthHeader(adminToken))
        .send({ featureName: adminOnlyFeature.featureName });

      expect(adminCheckRes.status).toBe(200);
      expect(adminCheckRes.body.data.enabled).toBe(true);

      // 3. Check feature access for regular user (should be denied)
      const userCheckRes = await request(app)
        .post("/api/features/check")
        .set(getAuthHeader(userToken))
        .send({ featureName: adminOnlyFeature.featureName });

      expect(userCheckRes.status).toBe(200);
      expect(userCheckRes.body.data.enabled).toBe(false);

      // 4. Update feature to allow USER role
      const updateRes = await request(app)
        .put(`/api/features/${feature._id}`)
        .set(getAuthHeader(adminToken))
        .send({ allowedRoles: [ROLES.ADMIN, ROLES.USER] });

      expect(updateRes.status).toBe(200);

      // Wait for update propagation
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 5. Check again - user should now have access
      const userCheckRes2 = await request(app)
        .post("/api/features/check")
        .set(getAuthHeader(userToken))
        .send({ featureName: adminOnlyFeature.featureName });

      expect(userCheckRes2.status).toBe(200);
      expect(userCheckRes2.body.data.enabled).toBe(true);
    });
  });

  describe("Feature Statistics", () => {
    it("should handle feature statistics correctly", async () => {
      // Create multiple features with unique names
      await createTestFeature(admin._id, {
        featureName: `feature-stats-1-${Date.now()}`,
        enabled: true,
      });

      await createTestFeature(admin._id, {
        featureName: `feature-stats-2-${Date.now()}`,
        enabled: false,
      });

      await createTestFeature(admin._id, {
        featureName: `feature-stats-3-${Date.now()}`,
        enabled: true,
        allowedRoles: [ROLES.ADMIN],
      });

      // Wait for all features to be persisted
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get statistics
      const statsRes = await request(app)
        .get("/api/features/stats")
        .set(getAuthHeader(adminToken));

      expect(statsRes.status).toBe(200);
      expect(statsRes.body.success).toBe(true);
      expect(statsRes.body.data).toHaveProperty("total");
      expect(statsRes.body.data).toHaveProperty("enabled");
      expect(statsRes.body.data).toHaveProperty("disabled");
      expect(statsRes.body.data.total).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Environment-Based Feature Control", () => {
    it("should respect environment-specific settings", async () => {
      const feature = await createTestFeature(admin._id, {
        featureName: `env-feature-${Date.now()}`,
        enabled: true,
        allowedRoles: [ROLES.ADMIN, ROLES.USER],
        rolloutPercentage: 100,
        environments: {
          development: { enabled: true },
          staging: { enabled: true },
          production: { enabled: false },
        },
      });

      // Wait for feature propagation
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check in development environment (default in test)
      const devRes = await request(app)
        .post("/api/features/check")
        .set(getAuthHeader(adminToken))
        .send({ featureName: feature.featureName });

      expect(devRes.status).toBe(200);
      expect(devRes.body.success).toBe(true);
      expect(devRes.body.data.enabled).toBe(true);
    });
  });

  describe("Rollout Percentage", () => {
    it("should handle rollout percentage correctly", async () => {
      // Create feature with 0% rollout
      const feature = await createTestFeature(admin._id, {
        featureName: `gradual-rollout-${Date.now()}`,
        enabled: true,
        allowedRoles: [ROLES.ADMIN, ROLES.USER],
        rolloutPercentage: 0,
      });

      // Wait for feature propagation
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check with 0% rollout - should be disabled
      const checkRes = await request(app)
        .post("/api/features/check")
        .set(getAuthHeader(userToken))
        .send({ featureName: feature.featureName });

      expect(checkRes.status).toBe(200);
      expect(checkRes.body.data.enabled).toBe(false);

      // Update to 100% rollout
      await request(app)
        .put(`/api/features/${feature._id}`)
        .set(getAuthHeader(adminToken))
        .send({ rolloutPercentage: 100 });

      // Wait for update propagation
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check with 100% rollout - should be enabled
      const checkRes2 = await request(app)
        .post("/api/features/check")
        .set(getAuthHeader(userToken))
        .send({ featureName: feature.featureName });

      expect(checkRes2.status).toBe(200);
      expect(checkRes2.body.data.enabled).toBe(true);
    });
  });
});
