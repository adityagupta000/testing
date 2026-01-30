const database = require("../src/config/database");
const logger = require("../src/utils/logger");
const { User, FeatureToggle, RateGuard, ROLES } = require("../src/models");
const config = require("../src/config");

/**
 * Database Seeder
 * Populates database with sample data for development
 */
class DatabaseSeeder {
  async seed() {
    try {
      console.log("🌱 Starting database seeding...\n");

      // Connect to database
      await database.connect();

      // Clear existing data
      await this.clearData();

      // Seed data
      const admin = await this.seedUsers();
      await this.seedFeatureToggles(admin._id);
      await this.seedRateGuards(admin._id);

      console.log("\n✅ Database seeding completed successfully!");
      console.log("\n📋 Sample Credentials:");
      console.log("   Admin: admin@example.com / Admin@123456");
      console.log("   User:  user@example.com / User@123456");
      console.log("   Guest: guest@example.com / Guest@123456\n");

      await database.disconnect();
      process.exit(0);
    } catch (error) {
      console.error("❌ Seeding failed:", error);
      process.exit(1);
    }
  }

  async clearData() {
    console.log("🗑️  Clearing existing data...");

    await User.deleteMany({});
    await FeatureToggle.deleteMany({});
    await RateGuard.deleteMany({});

    console.log("   ✓ Data cleared");
  }

  async seedUsers() {
    console.log("👥 Seeding users...");

    // Create admin user
    const admin = await User.create({
      email: "admin@example.com",
      password: "Admin@123456",
      firstName: "System",
      lastName: "Administrator",
      role: ROLES.ADMIN,
      isActive: true,
    });
    console.log(`   ✓ Admin created: ${admin.email}`);

    // Create regular user
    const user = await User.create({
      email: "user@example.com",
      password: "User@123456",
      firstName: "Regular",
      lastName: "User",
      role: ROLES.USER,
      isActive: true,
    });
    console.log(`   ✓ User created: ${user.email}`);

    // Create guest user
    const guest = await User.create({
      email: "guest@example.com",
      password: "Guest@123456",
      firstName: "Guest",
      lastName: "User",
      role: ROLES.GUEST,
      isActive: true,
    });
    console.log(`   ✓ Guest created: ${guest.email}`);

    return admin;
  }

  async seedFeatureToggles(adminId) {
    console.log("🎛️  Seeding feature toggles...");

    const features = [
      {
        featureName: "premium-features",
        description: "Access to premium features",
        enabled: true,
        allowedRoles: [ROLES.ADMIN, ROLES.USER],
        rolloutPercentage: 100,
        environments: {
          development: { enabled: true },
          staging: { enabled: true },
          production: { enabled: false },
        },
        createdBy: adminId,
      },
      {
        featureName: "analytics-dashboard",
        description: "Advanced analytics dashboard",
        enabled: true,
        allowedRoles: [ROLES.ADMIN],
        rolloutPercentage: 100,
        environments: {
          development: { enabled: true },
          staging: { enabled: true },
          production: { enabled: true },
        },
        createdBy: adminId,
      },
      {
        featureName: "beta-features",
        description: "Early access to beta features",
        enabled: true,
        allowedRoles: [ROLES.ADMIN, ROLES.USER],
        rolloutPercentage: 50,
        environments: {
          development: { enabled: true },
          staging: { enabled: true },
          production: { enabled: false },
        },
        createdBy: adminId,
      },
      {
        featureName: "file-upload",
        description: "File upload functionality",
        enabled: true,
        allowedRoles: [ROLES.ADMIN, ROLES.USER, ROLES.GUEST],
        rolloutPercentage: 100,
        environments: {
          development: { enabled: true },
          staging: { enabled: true },
          production: { enabled: true },
        },
        createdBy: adminId,
      },
      {
        featureName: "advanced-search",
        description: "Advanced search capabilities",
        enabled: false,
        allowedRoles: [ROLES.ADMIN, ROLES.USER],
        rolloutPercentage: 0,
        environments: {
          development: { enabled: false },
          staging: { enabled: false },
          production: { enabled: false },
        },
        createdBy: adminId,
      },
    ];

    for (const feature of features) {
      await FeatureToggle.create(feature);
      console.log(`   ✓ Feature created: ${feature.featureName}`);
    }
  }

  async seedRateGuards(adminId) {
    console.log("🛡️  Seeding rate guard rules...");

    const rules = [
      {
        routePath: "/api/auth/login",
        method: "POST",
        description: "Login rate limiting",
        enabled: true,
        limits: {
          admin: {
            maxRequests: 100,
            windowMs: 60000,
          },
          user: {
            maxRequests: 10,
            windowMs: 60000,
          },
          guest: {
            maxRequests: 5,
            windowMs: 60000,
          },
        },
        errorMessage: "Too many login attempts. Please try again later.",
        createdBy: adminId,
      },
      {
        routePath: "/api/features",
        method: "POST",
        description: "Feature creation rate limiting",
        enabled: true,
        limits: {
          admin: {
            maxRequests: 50,
            windowMs: 60000,
          },
          user: {
            maxRequests: 0,
            windowMs: 60000,
          },
          guest: {
            maxRequests: 0,
            windowMs: 60000,
          },
        },
        createdBy: adminId,
      },
      {
        routePath: "/api/users",
        method: "GET",
        description: "User list rate limiting",
        enabled: true,
        limits: {
          admin: {
            maxRequests: 100,
            windowMs: 60000,
          },
          user: {
            maxRequests: 20,
            windowMs: 60000,
          },
          guest: {
            maxRequests: 5,
            windowMs: 60000,
          },
        },
        createdBy: adminId,
      },
      {
        routePath: "/api/audit",
        method: "ALL",
        description: "Audit log access rate limiting",
        enabled: true,
        limits: {
          admin: {
            maxRequests: 200,
            windowMs: 60000,
          },
          user: {
            maxRequests: 0,
            windowMs: 60000,
          },
          guest: {
            maxRequests: 0,
            windowMs: 60000,
          },
        },
        createdBy: adminId,
      },
    ];

    for (const rule of rules) {
      await RateGuard.create(rule);
      console.log(`   ✓ Rate guard created: ${rule.method} ${rule.routePath}`);
    }
  }
}

// Run seeder
if (require.main === module) {
  const seeder = new DatabaseSeeder();
  seeder.seed();
}

module.exports = DatabaseSeeder;
