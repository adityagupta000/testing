const { User, ROLES } = require("../../src/models");

describe("User Model", () => {
  describe("User Creation", () => {
    it("should create a new user successfully", async () => {
      const userData = {
        email: "test@example.com",
        password: "password123",
        firstName: "John",
        lastName: "Doe",
        role: ROLES.USER,
      };

      const user = await User.create(userData);

      expect(user.email).toBe(userData.email);
      expect(user.firstName).toBe(userData.firstName);
      expect(user.lastName).toBe(userData.lastName);
      expect(user.role).toBe(ROLES.USER);
      expect(user.isActive).toBe(true);
      expect(user.password).not.toBe(userData.password); // Should be hashed
    });

    it("should hash password before saving", async () => {
      const plainPassword = "password123";
      const user = await User.create({
        email: "test@example.com",
        password: plainPassword,
        role: ROLES.USER,
      });

      expect(user.password).not.toBe(plainPassword);
      expect(user.password.length).toBeGreaterThan(20); // Bcrypt hash length
    });

    it("should require email", async () => {
      const userData = {
        password: "password123",
        role: ROLES.USER,
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it("should require password", async () => {
      const userData = {
        email: "test@example.com",
        role: ROLES.USER,
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it("should enforce unique email", async () => {
      const email = "duplicate@example.com";

      await User.create({
        email,
        password: "password123",
        role: ROLES.USER,
      });

      await expect(
        User.create({
          email,
          password: "password456",
          role: ROLES.USER,
        }),
      ).rejects.toThrow();
    });

    it("should validate email format", async () => {
      const userData = {
        email: "invalid-email",
        password: "password123",
        role: ROLES.USER,
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it("should set default role to USER", async () => {
      const user = await User.create({
        email: "test@example.com",
        password: "password123",
      });

      expect(user.role).toBe(ROLES.USER);
    });
  });

  describe("Password Methods", () => {
    let user;
    const plainPassword = "password123";

    beforeEach(async () => {
      user = await User.create({
        email: "test@example.com",
        password: plainPassword,
        role: ROLES.USER,
      });
    });

    it("should compare password correctly", async () => {
      const isMatch = await user.comparePassword(plainPassword);
      expect(isMatch).toBe(true);
    });

    it("should reject incorrect password", async () => {
      const isMatch = await user.comparePassword("wrongpassword");
      expect(isMatch).toBe(false);
    });

    it("should update password hash when password changes", async () => {
      const oldPassword = user.password;
      user.password = "newpassword123";
      await user.save();

      expect(user.password).not.toBe(oldPassword);
      const isMatch = await user.comparePassword("newpassword123");
      expect(isMatch).toBe(true);
    });
  });

  describe("Account Locking", () => {
    let user;

    beforeEach(async () => {
      user = await User.create({
        email: "test@example.com",
        password: "password123",
        role: ROLES.USER,
      });
    });

    it("should not be locked initially", () => {
      expect(user.isLocked()).toBe(false);
    });

    it("should increment login attempts", async () => {
      await user.incLoginAttempts();
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.loginAttempts).toBe(1);
    });

    it("should lock account after 5 failed attempts", async () => {
      for (let i = 0; i < 5; i++) {
        await user.incLoginAttempts();
        user = await User.findById(user._id);
      }

      expect(user.isLocked()).toBe(true);
      expect(user.lockUntil).toBeDefined();
    });

    it("should reset login attempts on successful login", async () => {
      await user.incLoginAttempts();
      await user.incLoginAttempts();
      await user.resetLoginAttempts();

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.loginAttempts).toBe(0);
      expect(updatedUser.lockUntil).toBeUndefined();
    });
  });

  describe("Role Methods", () => {
    it("should check if user has specific role", async () => {
      const adminUser = await User.create({
        email: "admin@example.com",
        password: "password123",
        role: ROLES.ADMIN,
      });

      expect(adminUser.hasRole(ROLES.ADMIN)).toBe(true);
      expect(adminUser.hasRole(ROLES.USER)).toBe(false);
    });

    it("should check if user is admin", async () => {
      const adminUser = await User.create({
        email: "admin@example.com",
        password: "password123",
        role: ROLES.ADMIN,
      });

      const regularUser = await User.create({
        email: "user@example.com",
        password: "password123",
        role: ROLES.USER,
      });

      expect(adminUser.isAdmin()).toBe(true);
      expect(regularUser.isAdmin()).toBe(false);
    });
  });

  describe("Virtual Properties", () => {
    it("should return full name", async () => {
      const user = await User.create({
        email: "test@example.com",
        password: "password123",
        firstName: "John",
        lastName: "Doe",
        role: ROLES.USER,
      });

      expect(user.fullName).toBe("John Doe");
    });

    it("should return Anonymous if no name provided", async () => {
      const user = await User.create({
        email: "test@example.com",
        password: "password123",
        role: ROLES.USER,
      });

      expect(user.fullName).toBe("Anonymous");
    });
  });

  describe("Static Methods", () => {
    it("should find user by email", async () => {
      const email = "test@example.com";
      await User.create({
        email,
        password: "password123",
        role: ROLES.USER,
      });

      const user = await User.findByEmail(email);
      expect(user).toBeDefined();
      expect(user.email).toBe(email);
    });

    it("should return null for non-existent email", async () => {
      const user = await User.findByEmail("nonexistent@example.com");
      expect(user).toBeNull();
    });
  });
});
