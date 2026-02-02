# Policy-Driven Feature Toggle & Rate Guard Service

A Node.js/Express backend service demonstrating dynamic feature access control and API rate limiting through database-driven policy rules.

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Testing](#testing)
- [API Documentation](#api-documentation)
- [File Locations](#file-locations)
- [Default Credentials](#default-credentials)
- [Configuration](#configuration)
- [Project Structure](#project-structure)

## Overview

This system allows administrators to define rules that control:
- Which features are accessible to which users
- How frequently certain APIs can be accessed
- Who is authorized to change system behavior

All rules are enforced at runtime using middleware and fully tested using Jest and Supertest.

## Key Features

### 1. Authentication & Authorization
- JWT-based authentication with refresh tokens
- Three user roles: Admin, User, Guest
- Account locking after 5 failed login attempts
- Password change and profile management

### 2. Dynamic Feature Toggles
- Admin-managed feature access rules
- Role-based feature availability
- Environment-specific settings (dev/staging/prod)
- Percentage-based rollout for gradual deployment
- Feature dependency support

### 3. Dynamic Rate Limiting (Rate Guard)
- Route-specific rate limiting rules
- Role-based limit differentiation
- IP-based or user-based tracking
- Whitelist support for exempt users/IPs
- Real-time rule updates without server restart

### 4. Audit Logging
- Complete action tracking with user details
- Failed action monitoring
- Security event tracking
- Export capabilities (JSON/CSV)
- Automatic 90-day log retention

## Tech Stack

**Backend:**
- Node.js 18+
- Express.js
- MongoDB 7.0+ with Mongoose
- JWT authentication
- Bcrypt password hashing
- Joi validation
- Winston logging

**Testing:**
- Jest
- Supertest
- In-memory MongoDB for tests

**DevOps:**
- Docker & Docker Compose
- Health check endpoints
- Graceful shutdown handling

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- MongoDB 7.0+
- Docker & Docker Compose (optional)

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd policy-toggle-service
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start MongoDB** (if not using Docker)
   ```bash
   mongod --dbpath /path/to/data
   ```

5. **Seed the database** (optional but recommended)
   ```bash
   npm run seed
   ```

6. **Run the application**
   ```bash
   # Development mode with auto-reload
   npm run dev

   # Production mode
   npm start
   ```

7. **Access the API**
   - API: http://localhost:3000/api
   - Health: http://localhost:3000/api/health

### Docker Setup

1. **Start all services**
   ```bash
   docker-compose up -d
   ```

2. **Stop services**
   ```bash
   docker-compose down
   ```

3. **View logs**
   ```bash
   docker-compose logs -f
   ```

## Testing

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# System tests only
npm run test:system
```

### Test with Docker
```bash
npm run docker:test
```

### Generate Test Documentation
```bash
# Generate Markdown documentation
npm run test:docs

# Generate Excel report
npm run test:excel

# Generate both
npm run test:reports
```

### Test Coverage
Coverage reports are generated in the `coverage/` directory after running tests.

**Coverage Goals:**
- Branches: 70%+
- Functions: 70%+
- Lines: 70%+
- Statements: 70%+

## API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication Endpoints

#### Register New User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "tokens": {
      "accessToken": "jwt-token",
      "refreshToken": "refresh-token"
    }
  }
}
```

#### Get Current User Profile
```http
GET /api/auth/me
Authorization: Bearer <token>
```

#### Update Profile
```http
PUT /api/auth/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "firstName": "Jane",
  "lastName": "Smith"
}
```

#### Change Password
```http
PUT /api/auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456"
}
```

### Feature Toggle Endpoints

#### Get All Features
```http
GET /api/features
Authorization: Bearer <token>
```

#### Check Feature Access
```http
POST /api/features/check
Authorization: Bearer <token>
Content-Type: application/json

{
  "featureName": "premium-features"
}
```

#### Create Feature (Admin Only)
```http
POST /api/features
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "featureName": "premium-features",
  "description": "Premium features for paid users",
  "enabled": true,
  "allowedRoles": ["admin", "user"],
  "rolloutPercentage": 100
}
```

#### Update Feature (Admin Only)
```http
PUT /api/features/:id
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "description": "Updated description",
  "rolloutPercentage": 75
}
```

#### Delete Feature (Admin Only)
```http
DELETE /api/features/:id
Authorization: Bearer <admin-token>
```

### Rate Guard Endpoints

#### Get All Rate Guards
```http
GET /api/rate-guards
Authorization: Bearer <token>
```

#### Create Rate Guard (Admin Only)
```http
POST /api/rate-guards
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "routePath": "/api/upload",
  "method": "POST",
  "enabled": true,
  "limits": {
    "admin": { "maxRequests": 100, "windowMs": 60000 },
    "user": { "maxRequests": 20, "windowMs": 60000 },
    "guest": { "maxRequests": 3, "windowMs": 60000 }
  }
}
```

### User Management (Admin Only)

#### Get All Users
```http
GET /api/users?page=1&limit=10
Authorization: Bearer <admin-token>
```

#### Update User Role
```http
PUT /api/users/:id/role
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "role": "admin"
}
```

#### Deactivate/Activate User
```http
PUT /api/users/:id/deactivate
Authorization: Bearer <admin-token>

PUT /api/users/:id/activate
Authorization: Bearer <admin-token>
```

#### Unlock User Account
```http
PUT /api/users/:id/unlock
Authorization: Bearer <admin-token>
```

### Audit Log Endpoints (Admin Only)

#### Get Audit Logs
```http
GET /api/audit?page=1&limit=50
Authorization: Bearer <admin-token>
```

#### Get Failed Actions
```http
GET /api/audit/failed?hours=24
Authorization: Bearer <admin-token>
```

### System Endpoints

#### Health Check
```http
GET /api/health
```

#### System Status
```http
GET /api/status
```

## File Locations

### Generated Test Reports

When you run the test documentation commands, files are saved in the `docs/` directory:

```bash
# Generate test documentation
npm run test:docs
# Creates: docs/TEST_RESULTS.md

# Generate Excel report
npm run test:excel
# Creates: docs/TEST_RESULTS.xlsx

# Generate both reports
npm run test:reports
# Creates both files in docs/ directory
```

**Output Files:**
- **Markdown Report**: `docs/TEST_RESULTS.md` - Human-readable test results
- **Excel Report**: `docs/TEST_RESULTS.xlsx` - Spreadsheet with detailed test cases, statistics, and failures

### Log Files

Application logs are stored in the `logs/` directory:
- `logs/app.log` - General application logs
- `logs/error.log` - Error-specific logs
- `logs/exceptions.log` - Uncaught exceptions
- `logs/rejections.log` - Unhandled promise rejections

### Coverage Reports

Test coverage reports are generated in the `coverage/` directory:
- `coverage/lcov-report/index.html` - HTML coverage report
- `coverage/coverage-final.json` - JSON coverage data

## Default Credentials

After running `npm run seed`, use these credentials for testing:

| Role  | Email              | Password      |
|-------|-------------------|---------------|
| Admin | admin@example.com | Admin@123456  |
| User  | user@example.com  | User@123456   |
| Guest | guest@example.com | Guest@123456  |

**⚠️ IMPORTANT: Change these credentials in production!**

## Configuration

### Environment Variables

Create a `.env` file in the project root with these variables:

```env
# Server
NODE_ENV=development
PORT=3000

# Database
MONGODB_URI=mongodb://localhost:27017/policy-toggle-service

# JWT
JWT_SECRET=your-secret-key-change-this
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Redis (Optional)
REDIS_HOST=localhost
REDIS_PORT=6379

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log

# Admin Credentials
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=Admin@123456
```

### Docker Environment

For Docker deployments, update the `docker-compose.yml` file or use environment variables:

```yaml
services:
  app:
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - MONGODB_URI=mongodb://mongodb:27017/policy-toggle-service
```

## Project Structure

```
policy-toggle-service/
├── src/
│   ├── config/              # Configuration files
│   │   ├── index.js         # Environment configuration
│   │   └── database.js      # Database connection
│   ├── middleware/          # Express middleware
│   │   ├── auth.js          # JWT authentication
│   │   ├── authorization.js # Role-based access control
│   │   ├── featureToggle.js # Feature toggle enforcement
│   │   ├── rateGuard.js     # Dynamic rate limiting
│   │   ├── validation.js    # Request validation
│   │   └── errorHandler.js  # Error handling
│   ├── models/              # Mongoose models
│   │   ├── User.js          # User model
│   │   ├── FeatureToggle.js # Feature toggle model
│   │   ├── RateGuard.js     # Rate guard model
│   │   └── AuditLog.js      # Audit log model
│   ├── routes/              # Express routes
│   │   ├── auth.routes.js
│   │   ├── users.routes.js
│   │   ├── features.routes.js
│   │   ├── rateGuards.routes.js
│   │   └── audit.routes.js
│   ├── services/            # Business logic
│   │   ├── authService.js
│   │   ├── userService.js
│   │   ├── featureToggleService.js
│   │   └── rateGuardService.js
│   ├── utils/
│   │   └── logger.js        # Winston logger
│   ├── app.js               # Express app setup
│   └── index.js             # Server entry point
├── tests/
│   ├── unit/                # Unit tests
│   ├── integration/         # Integration tests
│   ├── system/              # System/E2E tests
│   ├── setup.js             # Test environment setup
│   └── helpers.js           # Test utilities
├── scripts/
│   ├── seed.js              # Database seeding
│   ├── generate-test-docs.js   # Test documentation generator
│   └── generate-test-excel.js  # Excel report generator
├── docs/                    # Documentation and reports
│   ├── API.md
│   ├── QUICKSTART.md
│   ├── TEST_RESULTS.md      # Generated test report
│   └── TEST_RESULTS.xlsx    # Generated Excel report
├── logs/                    # Application logs
├── coverage/                # Test coverage reports
├── docker-compose.yml
├── Dockerfile
├── package.json
└── README.md
```

## Learning Outcomes

This project demonstrates:

✅ **Clean Architecture** - Separation of concerns across layers  
✅ **Middleware Patterns** - Request processing pipeline  
✅ **Policy-Driven Design** - Dynamic rule evaluation at runtime  
✅ **Role-Based Access Control** - Authorization patterns  
✅ **Comprehensive Testing** - Unit, integration, and system tests  
✅ **Automated Documentation** - Self-documenting test results  
✅ **Docker Containerization** - Consistent deployment environments  
✅ **Database Design** - Schema modeling with Mongoose  
✅ **API Design** - RESTful endpoint structure  
✅ **Security Best Practices** - JWT, password hashing, rate limiting  

## Troubleshooting

### Common Issues

**Database Connection Error:**
```bash
# Ensure MongoDB is running
mongod --dbpath /path/to/data

# Or use Docker
docker-compose up mongodb
```

**Port Already in Use:**
```bash
# Change PORT in .env file
PORT=3001
```

**Test Failures:**
```bash
# Clear test database
docker-compose -f docker-compose.test.yml down -v

# Rebuild and run tests
npm test
```

## Support

- **Documentation**: See `/docs` folder for detailed guides
- **API Reference**: See `docs/API.md`
- **Test Results**: Run `npm run test:docs` to generate latest results

## License

MIT License - See LICENSE file for details

---

**Built with Node.js, Express, and MongoDB** | **Tested with Jest and Supertest** | **Containerized with Docker**