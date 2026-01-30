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

  // FIXED: Properly create and persist users before generating tokens
  beforeEach(async () => {
    // Create admin and ensure it's saved before generating token
    admin = await createTestAdmin();
    await admin.save(); // Ensure full persistence
    adminToken = getAuthToken(admin._id);

    // Create regular user and ensure it's saved before generating token
    user = await createTestUser();
    await user.save(); // Ensure full persistence
    userToken = getAuthToken(user._id);
  });

  describe("Complete Feature Toggle Lifecycle", () => {
    it("should complete full feature toggle lifecycle", async () => {
      // 1. Create Feature
      const featureData = {
        featureName: "new-dashboard",
        description: "New dashboard UI",
        enabled: true,
        allowedRoles: [ROLES.ADMIN, ROLES.USER],
        rolloutPercentage: 50,
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
      expect(updateRes.body.data.feature.rolloutPercentage).toBe(
        updateData.rolloutPercentage,
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
      // 1. Ensure users exist in database
      const dbAdmin = await User.findById(admin._id);
      const dbUser = await User.findById(user._id);

      expect(dbAdmin).toBeDefined();
      expect(dbUser).toBeDefined();

      // 2. Admin creates a feature for ADMIN only
      const adminOnlyFeature = {
        featureName: "admin-analytics",
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

      // 3. Check feature access using the check endpoint
      const adminCheckRes = await request(app)
        .post("/api/features/check")
        .set(getAuthHeader(adminToken))
        .send({ featureName: "admin-analytics" });

      expect(adminCheckRes.status).toBe(200);
      expect(adminCheckRes.body.data.enabled).toBe(true);

      // 4. Check feature access for regular user (should be denied)
      const userCheckRes = await request(app)
        .post("/api/features/check")
        .set(getAuthHeader(userToken))
        .send({ featureName: "admin-analytics" });

      expect(userCheckRes.status).toBe(200);
      expect(userCheckRes.body.data.enabled).toBe(false);

      // 5. Update feature to allow USER role
      const updateRes = await request(app)
        .put(`/api/features/${feature._id}`)
        .set(getAuthHeader(adminToken))
        .send({ allowedRoles: [ROLES.ADMIN, ROLES.USER] });

      expect(updateRes.status).toBe(200);

      // 6. Check again - user should now have access
      const userCheckRes2 = await request(app)
        .post("/api/features/check")
        .set(getAuthHeader(userToken))
        .send({ featureName: "admin-analytics" });

      expect(userCheckRes2.status).toBe(200);
      expect(userCheckRes2.body.data.enabled).toBe(true);
    });
  });

  describe("Feature Statistics", () => {
    it("should handle feature statistics correctly", async () => {
      // Ensure admin exists in database
      const dbAdmin = await User.findById(admin._id);
      expect(dbAdmin).toBeDefined();

      // 1. Create multiple features
      const feature1 = await createTestFeature(admin._id, {
        featureName: "feature-1",
        enabled: true,
      });

      const feature2 = await createTestFeature(admin._id, {
        featureName: "feature-2",
        enabled: false,
      });

      const feature3 = await createTestFeature(admin._id, {
        featureName: "feature-3",
        enabled: true,
        allowedRoles: [ROLES.ADMIN],
      });

      // 2. Get statistics
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
      // Ensure admin exists in database
      const dbAdmin = await User.findById(admin._id);
      expect(dbAdmin).toBeDefined();

      const feature = await createTestFeature(admin._id, {
        featureName: "env-feature",
        enabled: true,
        allowedRoles: [ROLES.ADMIN, ROLES.USER],
        environments: {
          development: { enabled: true },
          staging: { enabled: true },
          production: { enabled: false },
        },
      });

      // Check in development environment (default in test)
      const devRes = await request(app)
        .post("/api/features/check")
        .set(getAuthHeader(adminToken))
        .send({ featureName: "env-feature" });

      expect(devRes.status).toBe(200);
      expect(devRes.body.success).toBe(true);
      expect(devRes.body.data.enabled).toBe(true);

      // Note: Testing production environment would require changing NODE_ENV
      // which is not practical in a single test. This is a known limitation.
    });
  });

  describe("Rollout Percentage", () => {
    it("should handle rollout percentage correctly", async () => {
      // Ensure users exist in database
      const dbAdmin = await User.findById(admin._id);
      const dbUser = await User.findById(user._id);

      expect(dbAdmin).toBeDefined();
      expect(dbUser).toBeDefined();

      // Create feature with 0% rollout
      const feature = await createTestFeature(admin._id, {
        featureName: "gradual-rollout",
        enabled: true,
        allowedRoles: [ROLES.ADMIN, ROLES.USER],
        rolloutPercentage: 0,
      });

      const checkRes = await request(app)
        .post("/api/features/check")
        .set(getAuthHeader(userToken))
        .send({ featureName: "gradual-rollout" });

      expect(checkRes.status).toBe(200);
      expect(checkRes.body.data.enabled).toBe(false);

      // Update to 100% rollout
      await request(app)
        .put(`/api/features/${feature._id}`)
        .set(getAuthHeader(adminToken))
        .send({ rolloutPercentage: 100 });

      const checkRes2 = await request(app)
        .post("/api/features/check")
        .set(getAuthHeader(userToken))
        .send({ featureName: "gradual-rollout" });

      expect(checkRes2.status).toBe(200);
      expect(checkRes2.body.data.enabled).toBe(true);
    });
  });
});
