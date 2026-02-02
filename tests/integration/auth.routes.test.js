const request = require("supertest");
const app = require("../../src/app");
const { User, ROLES } = require("../../src/models");
const { createTestUser, getAuthHeader, getAuthToken } = require("../helpers");

describe("Auth Routes", () => {
  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      const userData = {
        email: "newuser@example.com",
        password: "password123",
        firstName: "New",
        lastName: "User",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
    });

    it("should not register user with existing email", async () => {
      const email = "existing@example.com";
      await createTestUser({ email });

      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email,
          password: "password123",
        })
        .expect(409);

      expect(response.body.success).toBe(false);
    });

    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: "test@example.com",
          // Missing password
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should validate email format", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: "invalid-email",
          password: "password123",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/auth/login", () => {
    let testUser;
    const password = "password123";

    beforeEach(async () => {
      testUser = await createTestUser({ password });
    });

    it("should login successfully with correct credentials", async () => {
      // CRITICAL: Add wait after user creation
      await new Promise((resolve) => setTimeout(resolve, 300));

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
    });

    it("should not login with incorrect password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password: "wrongpassword",
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it("should not login with non-existent email", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "nonexistent@example.com",
          password,
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it("should not login with inactive account", async () => {
      testUser.isActive = false;
      await testUser.save();

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password,
        })
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it("should increment login attempts on failed login", async () => {
      await request(app).post("/api/auth/login").send({
        email: testUser.email,
        password: "wrongpassword",
      });

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.loginAttempts).toBe(1);
    });
  });

  describe("GET /api/auth/me", () => {
    let testUser;
    let authToken;

    beforeEach(async () => {
      testUser = await createTestUser();
      authToken = getAuthToken(testUser._id);
    });

    it("should return current user profile", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set(getAuthHeader(authToken))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user._id.toString()).toBe(
        testUser._id.toString(),
      );
    });

    it("should require authentication", async () => {
      const response = await request(app).get("/api/auth/me").expect(401);

      expect(response.body.success).toBe(false);
    });

    it("should reject invalid token", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set(getAuthHeader("invalid-token"))
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe("PUT /api/auth/profile", () => {
    let testUser;
    let authToken;

    beforeEach(async () => {
      testUser = await createTestUser();
      authToken = getAuthToken(testUser._id);
    });

    it("should update user profile", async () => {
      const updates = {
        firstName: "Updated",
        lastName: "Name",
      };

      const response = await request(app)
        .put("/api/auth/profile")
        .set(getAuthHeader(authToken))
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.firstName).toBe(updates.firstName);
      expect(response.body.data.user.lastName).toBe(updates.lastName);
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .put("/api/auth/profile")
        .send({ firstName: "Test" })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe("PUT /api/auth/change-password", () => {
    let testUser;
    let authToken;
    const currentPassword = "password123";

    beforeEach(async () => {
      testUser = await createTestUser({ password: currentPassword });
      authToken = getAuthToken(testUser._id);
    });
    it("should change password successfully", async () => {
      // CRITICAL: Add wait after user creation
      await new Promise((resolve) => setTimeout(resolve, 300));

      const response = await request(app)
        .put("/api/auth/change-password")
        .set(getAuthHeader(authToken))
        .send({
          currentPassword,
          newPassword: "newpassword123",
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // CRITICAL: Wait for password change to persist
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Verify password was actually changed
      const updatedUser = await User.findById(testUser._id).select("+password");
      const isNewPasswordValid =
        await updatedUser.comparePassword("newpassword123");
      expect(isNewPasswordValid).toBe(true);
    });

    it("should reject incorrect current password", async () => {
      const response = await request(app)
        .put("/api/auth/change-password")
        .set(getAuthHeader(authToken))
        .send({
          currentPassword: "wrongpassword",
          newPassword: "newpassword123",
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it("should validate new password length", async () => {
      const response = await request(app)
        .put("/api/auth/change-password")
        .set(getAuthHeader(authToken))
        .send({
          currentPassword,
          newPassword: "123", // Too short
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .put("/api/auth/change-password")
        .send({
          currentPassword,
          newPassword: "newpassword123",
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/auth/logout", () => {
    let testUser;
    let authToken;

    beforeEach(async () => {
      testUser = await createTestUser();
      authToken = getAuthToken(testUser._id);
    });

    it("should logout successfully", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .set(getAuthHeader(authToken))
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it("should require authentication", async () => {
      const response = await request(app).post("/api/auth/logout").expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
