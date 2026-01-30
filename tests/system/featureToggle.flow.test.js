const request = require("supertest");
const app = require("../../src/app");
const {
  createTestAdmin,
  createTestUser,
  getAuthHeader,
  getAuthToken,
} = require("../helpers");

describe("Feature Toggle System Flow", () => {
  let admin;
  let adminToken;
  let user;
  let userToken;
  let featureId;

  beforeEach(async () => {
    // Create test users
    admin = await createTestAdmin();
    adminToken = getAuthToken(admin._id);

    user = await createTestUser();
    userToken = getAuthToken(user._id);
  });

  it("should complete full feature toggle lifecycle", async () => {
    // Step 1: Admin creates a new feature toggle
    const createResponse = await request(app)
      .post("/api/features")
      .set(getAuthHeader(adminToken))
      .send({
        featureName: "premium-features",
        description: "Premium features for paid users",
        enabled: true,
        allowedRoles: ["admin", "user"],
        rolloutPercentage: 100,
        environments: {
          development: { enabled: true },
          staging: { enabled: true },
          production: { enabled: false },
        },
      })
      .expect(201);

    expect(createResponse.body.success).toBe(true);
    featureId = createResponse.body.data.feature._id;

    // Step 2: User checks enabled features
    const enabledResponse = await request(app)
      .get("/api/features/enabled")
      .set(getAuthHeader(userToken))
      .expect(200);

    expect(enabledResponse.body.success).toBe(true);
    const hasFeature = enabledResponse.body.data.features.some(
      (f) => f.featureName === "premium-features",
    );
    expect(hasFeature).toBe(true);

    // Step 3: User checks specific feature access
    const checkResponse = await request(app)
      .post("/api/features/check")
      .set(getAuthHeader(userToken))
      .send({ featureName: "premium-features" })
      .expect(200);

    expect(checkResponse.body.data.enabled).toBe(true);

    // Step 4: Admin disables the feature
    const toggleResponse = await request(app)
      .put(`/api/features/${featureId}/toggle`)
      .set(getAuthHeader(adminToken))
      .send({ enabled: false })
      .expect(200);

    expect(toggleResponse.body.data.feature.enabled).toBe(false);

    // Step 5: User checks feature access again (should be disabled)
    const recheckResponse = await request(app)
      .post("/api/features/check")
      .set(getAuthHeader(userToken))
      .send({ featureName: "premium-features" })
      .expect(200);

    expect(recheckResponse.body.data.enabled).toBe(false);

    // Step 6: Admin deletes the feature
    const deleteResponse = await request(app)
      .delete(`/api/features/${featureId}`)
      .set(getAuthHeader(adminToken))
      .expect(200);

    expect(deleteResponse.body.success).toBe(true);

    // Step 7: Verify feature is deleted
    await request(app)
      .get(`/api/features/${featureId}`)
      .set(getAuthHeader(adminToken))
      .expect(404);
  });

  it("should enforce role-based feature access", async () => {
    // Create admin-only feature
    const createResponse = await request(app)
      .post("/api/features")
      .set(getAuthHeader(adminToken))
      .send({
        featureName: "admin-dashboard",
        description: "Admin-only dashboard",
        enabled: true,
        allowedRoles: ["admin"],
        rolloutPercentage: 100,
      })
      .expect(201);

    featureId = createResponse.body.data.feature._id;

    // Admin can access
    const adminCheckResponse = await request(app)
      .post("/api/features/check")
      .set(getAuthHeader(adminToken))
      .send({ featureName: "admin-dashboard" })
      .expect(200);

    expect(adminCheckResponse.body.data.enabled).toBe(true);

    // Regular user cannot access
    const userCheckResponse = await request(app)
      .post("/api/features/check")
      .set(getAuthHeader(userToken))
      .send({ featureName: "admin-dashboard" })
      .expect(200);

    expect(userCheckResponse.body.data.enabled).toBe(false);
  });

  it("should prevent non-admin users from creating features", async () => {
    const response = await request(app)
      .post("/api/features")
      .set(getAuthHeader(userToken))
      .send({
        featureName: "unauthorized-feature",
        description: "Should not be created",
        enabled: true,
      })
      .expect(403);

    expect(response.body.success).toBe(false);
  });

  it("should handle feature statistics correctly", async () => {
    // Create multiple features
    await request(app)
      .post("/api/features")
      .set(getAuthHeader(adminToken))
      .send({
        featureName: "feature-1",
        enabled: true,
      });

    await request(app)
      .post("/api/features")
      .set(getAuthHeader(adminToken))
      .send({
        featureName: "feature-2",
        enabled: false,
      });

    // Get statistics
    const statsResponse = await request(app)
      .get("/api/features/stats")
      .set(getAuthHeader(adminToken))
      .expect(200);

    expect(statsResponse.body.data.total).toBeGreaterThanOrEqual(2);
    expect(statsResponse.body.data.enabled).toBeGreaterThanOrEqual(1);
    expect(statsResponse.body.data.disabled).toBeGreaterThanOrEqual(1);
  });
});
