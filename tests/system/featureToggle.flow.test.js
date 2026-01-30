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
      expect(createRes.body.data.featureName).toBe(featureData.featureName);

      const featureId = createRes.body.data._id;

      // 2. Get Feature Details
      const getRes = await request(app)
        .get(`/api/features/${featureId}`)
        .set(getAuthHeader(adminToken));

      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data._id).toBe(featureId);

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
      expect(updateRes.body.data.description).toBe(updateData.description);
      expect(updateRes.body.data.rolloutPercentage).toBe(
        updateData.rolloutPercentage,
      );

      // 4. List All Features
      const listRes = await request(app)
        .get("/api/features")
        .set(getAuthHeader(adminToken));

      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);
      expect(listRes.body.data.length).toBeGreaterThan(0);

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
      const featureId = createRes.body.data._id;

      // 2. Check feature access for admin
      const adminCheckRes = await request(app)
        .get(`/api/features/${featureId}/check`)
        .set(getAuthHeader(adminToken));

      expect(adminCheckRes.status).toBe(200);
      expect(adminCheckRes.body.data.hasAccess).toBe(true);
      expect(adminCheckRes.body.data.reason).toContain("role");

      // 3. Check feature access for regular user (should be denied)
      const userCheckRes = await request(app)
        .get(`/api/features/${featureId}/check`)
        .set(getAuthHeader(userToken));

      expect(userCheckRes.status).toBe(200);
      expect(userCheckRes.body.data.hasAccess).toBe(false);
      expect(userCheckRes.body.data.reason).toContain("role");

      // 4. Update feature to allow USER role
      const updateRes = await request(app)
        .put(`/api/features/${featureId}`)
        .set(getAuthHeader(adminToken))
        .send({ allowedRoles: [ROLES.ADMIN, ROLES.USER] });

      expect(updateRes.status).toBe(200);

      // 5. Check again - user should now have access
      const userCheckRes2 = await request(app)
        .get(`/api/features/${featureId}/check`)
        .set(getAuthHeader(userToken));

      expect(userCheckRes2.status).toBe(200);
      expect(userCheckRes2.body.data.hasAccess).toBe(true);
    });
  });

  describe("Feature Statistics", () => {
    it("should handle feature statistics correctly", async () => {
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
      const feature = await createTestFeature(admin._id, {
        featureName: "env-feature",
        enabled: true,
        environments: {
          development: { enabled: true },
          staging: { enabled: true },
          production: { enabled: false },
        },
      });

      // Check in development environment
      const devRes = await request(app)
        .get(`/api/features/${feature._id}/check`)
        .set(getAuthHeader(adminToken))
        .query({ environment: "development" });

      expect(devRes.status).toBe(200);
      expect(devRes.body.data.hasAccess).toBe(true);

      // Check in production environment (should be disabled)
      const prodRes = await request(app)
        .get(`/api/features/${feature._id}/check`)
        .set(getAuthHeader(adminToken))
        .query({ environment: "production" });

      expect(prodRes.status).toBe(200);
      expect(prodRes.body.data.hasAccess).toBe(false);
      expect(prodRes.body.data.reason).toContain("environment");
    });
  });

  describe("Rollout Percentage", () => {
    it("should handle rollout percentage correctly", async () => {
      // Create feature with 0% rollout
      const feature = await createTestFeature(admin._id, {
        featureName: "gradual-rollout",
        enabled: true,
        rolloutPercentage: 0,
      });

      const checkRes = await request(app)
        .get(`/api/features/${feature._id}/check`)
        .set(getAuthHeader(userToken));

      expect(checkRes.status).toBe(200);
      expect(checkRes.body.data.hasAccess).toBe(false);
      expect(checkRes.body.data.reason).toContain("rollout");

      // Update to 100% rollout
      await request(app)
        .put(`/api/features/${feature._id}`)
        .set(getAuthHeader(adminToken))
        .send({ rolloutPercentage: 100 });

      const checkRes2 = await request(app)
        .get(`/api/features/${feature._id}/check`)
        .set(getAuthHeader(userToken));

      expect(checkRes2.status).toBe(200);
      expect(checkRes2.body.data.hasAccess).toBe(true);
    });
  });
});
