# Policy-Driven Feature Toggle & Rate Guard Service

A **backend-focused full-stack application** that demonstrates modern systems for dynamically controlling **feature access** and **API usage limits** using **policy rules** instead of hard-coded logic.

## Project Overview

This system allows administrators to define **rules** that decide:
- Which features are accessible to which users
- How frequently certain APIs can be accessed
- Who is authorized to change system behavior

All rules are enforced **at runtime** using middleware, fully **tested using Jest and Supertest**, and executed in **Dockerized environments** for consistency and reliability.

**Goal**: Demonstrate backend correctness, testability, and clarity—not UI complexity.

---

## Key Features

### 1. **Authentication & Role-Based Authorization**
- JWT-based authentication
- Three user roles: **Admin**, **User**, **Guest**
- Role validation through middleware
- Account locking after failed login attempts
- Password change and profile management

### 2. **Dynamic Feature Toggle Management**
- Admin-defined feature access rules
- Role-based feature availability
- Environment-specific settings (dev/staging/prod)
- Percentage-based rollout (gradual feature deployment)
- Feature dependencies support

### 3. **Dynamic API Rate Limiting (Rate Guard)**
- Route-specific rate limiting rules
- Role-based limit differentiation
- IP-based or user-based tracking
- Whitelist support for exempt users/IPs
- Real-time rule updates without restart

### 4. **Comprehensive Audit Logging**
- Every system change is recorded
- Includes: who, what, when
- Failed action tracking
- Security event monitoring
- Export capabilities (JSON/CSV)

---

## Architecture

```
policy-toggle-service/
├── src/
│   ├── config/          # Configuration (env, database)
│   ├── middleware/      # Auth, authorization, feature toggle, rate guard
│   ├── models/          # Mongoose models (User, FeatureToggle, RateGuard, AuditLog)
│   ├── routes/          # Express routes
│   ├── services/        # Business logic layer
│   ├── utils/           # Logger and helpers
│   ├── app.js           # Express app setup
│   └── index.js         # Server entry point
├── tests/
│   ├── unit/            # Unit tests
│   ├── integration/     # Integration tests
│   └── system/          # End-to-end system tests
├── scripts/             # Seeding and utility scripts
├── docs/                # Auto-generated documentation
└── docker-compose.yml   # Container orchestration
```

---

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
   # Using local MongoDB
   mongod --dbpath /path/to/data
   ```

5. **Run the application**
   ```bash
   # Development mode with auto-reload
   npm run dev

   # Production mode
   npm start
   ```

6. **Seed sample data** (optional)
   ```bash
   npm run seed
   ```

### Docker Setup

1. **Start all services with Docker Compose**
   ```bash
   # Build and start
   npm run docker:build
   npm run docker:up

   # Stop services
   npm run docker:down
   ```

2. **Access the application**
   - API: http://localhost:3000/api
   - Health: http://localhost:3000/api/health

---

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
npm run test:docs
```

This creates `docs/TEST_RESULTS.md` with:
- Total tests executed
- Pass/fail summary
- Test grouping (Unit/Integration/System)
- Coverage metrics
- Execution timestamp

### Code Coverage
Coverage reports are generated in the `coverage/` directory after running tests.

---

## 📡 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication Endpoints

#### Register
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

Response:
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

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

### Feature Toggle Endpoints

#### Create Feature (Admin only)
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

### Rate Guard Endpoints

#### Create Rate Limit Rule (Admin only)
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

#### Get All Rate Guard Rules
```http
GET /api/rate-guards
Authorization: Bearer <token>
```

### User Management Endpoints (Admin only)

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

### Audit Log Endpoints (Admin only)

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

---

## Default Credentials

After running `npm run seed`, use these credentials:

| Role  | Email              | Password      |
|-------|-------------------|---------------|
| Admin | admin@example.com | Admin@123456  |
| User  | user@example.com  | User@123456   |
| Guest | guest@example.com | Guest@123456  |

** Change these in production!**

---

## Configuration

Key environment variables (`.env`):

```env
# Server
NODE_ENV=development
PORT=3000

# Database
MONGODB_URI=mongodb://localhost:27017/policy-toggle-service

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# Admin Credentials
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=Admin@123456
```

---

## Testing Strategy

### Test Types

1. **Unit Tests** (`tests/unit/`)
   - Model validation
   - Business logic
   - Utility functions
   - Edge cases

2. **Integration Tests** (`tests/integration/`)
   - API endpoints
   - Middleware chains
   - Database operations
   - Authentication flows

3. **System Tests** (`tests/system/`)
   - Complete workflows
   - Multi-step processes
   - Role-based access
   - Feature toggle lifecycle

### Coverage Goals

- Branches: 70%+
- Functions: 70%+
- Lines: 70%+
- Statements: 70%+

---

## Docker Deployment

### Production Deployment
```bash
docker-compose up -d
```

Services:
- **App**: Node.js application (port 3000)
- **MongoDB**: Database (port 27017)
- **Redis**: Caching/rate limiting (port 6379)

### Health Checks
All services include health checks for monitoring.

---

## Project Structure

```
src/
├── config/
│   ├── index.js         # Configuration loader
│   └── database.js      # Database connection
├── middleware/
│   ├── auth.js          # JWT authentication
│   ├── authorization.js # Role-based access
│   ├── featureToggle.js # Feature enforcement
│   ├── rateGuard.js     # Dynamic rate limiting
│   ├── validation.js    # Request validation
│   ├── errorHandler.js  # Error handling
│   └── requestLogger.js # Request logging
├── models/
│   ├── User.js          # User model with auth
│   ├── FeatureToggle.js # Feature toggle model
│   ├── RateGuard.js     # Rate guard model
│   └── AuditLog.js      # Audit logging model
├── routes/
│   ├── auth.routes.js   # Authentication routes
│   ├── users.routes.js  # User management
│   ├── features.routes.js # Feature toggles
│   ├── rateGuards.routes.js # Rate guards
│   └── audit.routes.js  # Audit logs
├── services/
│   ├── authService.js   # Auth business logic
│   ├── userService.js   # User management logic
│   ├── featureToggleService.js # Feature logic
│   └── rateGuardService.js # Rate limiting logic
└── utils/
    └── logger.js        # Winston logger
```

---

## Learning Outcomes

This project demonstrates:

 **Clean Architecture** - Separation of concerns  
 **Middleware Patterns** - Request processing pipeline  
 **Policy-Driven Design** - Dynamic rule evaluation  
 **Role-Based Access Control** - Authorization patterns  
 **Comprehensive Testing** - Unit, integration, system tests  
 **Automated Documentation** - Self-documenting test results  
 **Docker Containerization** - Consistent environments  
 **Database Design** - Schema modeling with Mongoose  
 **API Design** - RESTful endpoint structure  
 **Security Best Practices** - JWT, password hashing, rate limiting  
