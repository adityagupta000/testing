## Table of Contents

- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Docker Setup (Recommended)](#docker-setup-recommended)
  - [Local Development Setup](#local-development-setup)
- [Running Tests](#running-tests)
- [API Documentation](#api-documentation)
- [Default Credentials](#default-credentials)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Testing Strategy](#testing-strategy)
- [Docker Deployment](#docker-deployment)
- [Learning Outcomes](#learning-outcomes)
- [Contributing](#contributing)
- [License](#license)

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
│   ├── config/           # Configuration (env, database)
│   ├── middleware/       # Auth, authorization, feature toggle, rate guard
│   ├── models/           # Mongoose models (User, FeatureToggle, RateGuard, AuditLog)
│   ├── routes/           # Express routes
│   ├── services/         # Business logic layer
│   ├── utils/            # Logger and helpers
│   ├── app.js            # Express app setup
│   └── index.js          # Server entry point
├── tests/
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── system/           # End-to-end system tests
├── scripts/              # Seeding and utility scripts
├── docs/                 # Auto-generated documentation
└── docker-compose.yml    # Container orchestration
```

### Architecture Layers

```
Application Layer (Express)
    ↓
Route Layer (REST API)
    ↓
Middleware Layer (Auth, Rate Limit, Feature Toggle, Validation)
    ↓
Service Layer (Business Logic)
    ↓
Model Layer (Mongoose/MongoDB)
    ↓
Database Layer (MongoDB)
```

---

## Tech Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB 7.0+
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs
- **Validation**: Joi
- **Logging**: Winston
- **Testing**: Jest, Supertest

### DevOps
- **Containerization**: Docker
- **Orchestration**: Docker Compose
- **Environment**: dotenv

### Security
- **Helmet.js**: Security headers
- **CORS**: Cross-origin resource sharing
- **Express Rate Limit**: API rate limiting
- **Input Sanitization**: XSS protection

---

## Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **MongoDB** 7.0+
- **Docker & Docker Compose** (optional, but recommended)

### Docker Setup (Recommended)

1. **Clone the repository**
```bash
git clone <repository-url>
cd policy-toggle-service
```

2. **Start all services with Docker Compose**
```bash
docker-compose build
docker-compose up -d
```

3. **Verify the application is running**
```bash
curl http://localhost:3000/api/health
```

4. **Access the application**
- API: http://localhost:3000/api
- Health: http://localhost:3000/api/health

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

5. **Seed sample data** (optional)
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

---

## Running Tests

### Option 1: Docker Test Environment (Recommended)

#### Create Test Environment
```bash
# Build test Docker image
docker-compose -f docker-compose.test.yml build

# Start test containers
docker-compose -f docker-compose.test.yml up -d
```

#### Run Tests in Sequence
```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# System tests
npm run test:system
```

#### Or Run All Tests at Once
```bash
npm test
```

#### Alternative: Run Tests in Docker Container
```bash
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

#### Clean Up Test Environment
```bash
docker-compose -f docker-compose.test.yml down
```

### Option 2: Local Test Environment

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:system

# Generate test documentation
npm run test:docs
```

### Test Coverage

Coverage reports are generated in the `coverage/` directory after running tests.

**Coverage Goals:**
- Branches: 70%+
- Functions: 70%+
- Lines: 70%+
- Statements: 70%+

---

## API Documentation

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

**For complete API documentation, see [docs/API.md](docs/API.md)**

---

## Default Credentials

After running `npm run seed`, use these credentials:

| Role  | Email              | Password      |
|-------|-------------------|---------------|
| Admin | admin@example.com | Admin@123456  |
| User  | user@example.com  | User@123456   |
| Guest | guest@example.com | Guest@123456  |

**IMPORTANT: Change these in production!**

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

## Project Structure

```
src/
├── config/
│   ├── index.js              # Configuration loader
│   └── database.js           # Database connection
├── middleware/
│   ├── auth.js               # JWT authentication
│   ├── authorization.js      # Role-based access
│   ├── featureToggle.js      # Feature enforcement
│   ├── rateGuard.js          # Dynamic rate limiting
│   ├── validation.js         # Request validation
│   ├── errorHandler.js       # Error handling
│   └── requestLogger.js      # Request logging
├── models/
│   ├── User.js               # User model with auth
│   ├── FeatureToggle.js      # Feature toggle model
│   ├── RateGuard.js          # Rate guard model
│   └── AuditLog.js           # Audit logging model
├── routes/
│   ├── auth.routes.js        # Authentication routes
│   ├── users.routes.js       # User management
│   ├── features.routes.js    # Feature toggles
│   ├── rateGuards.routes.js  # Rate guards
│   └── audit.routes.js       # Audit logs
├── services/
│   ├── authService.js        # Auth business logic
│   ├── userService.js        # User management logic
│   ├── featureToggleService.js # Feature logic
│   └── rateGuardService.js   # Rate limiting logic
└── utils/
    └── logger.js             # Winston logger
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

### Test Commands

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:system

# Watch mode
npm run test:watch

# Generate test documentation
npm run test:docs
```

---

## Docker Deployment

### Production Deployment

```bash
docker-compose up -d
```

**Services:**
- **App**: Node.js application (port 3000)
- **MongoDB**: Database (port 27017)
- **Redis**: Caching/rate limiting (port 6379)

### Health Checks

All services include health checks for monitoring.

### Environment Variables

Set production environment variables in `.env` or docker-compose.yml:

```yaml
environment:
  NODE_ENV: production
  PORT: 3000
  MONGODB_URI: mongodb://mongodb:27017/policy-toggle-service
  JWT_SECRET: ${JWT_SECRET}
```

---

## Learning Outcomes

This project demonstrates:

- **Clean Architecture** - Separation of concerns across layers
- **Middleware Patterns** - Request processing pipeline
- **Policy-Driven Design** - Dynamic rule evaluation
- **Role-Based Access Control** - Authorization patterns
- **Comprehensive Testing** - Unit, integration, system tests
- **Automated Documentation** - Self-documenting test results
- **Docker Containerization** - Consistent environments
- **Database Design** - Schema modeling with Mongoose
- **API Design** - RESTful endpoint structure
- **Security Best Practices** - JWT, password hashing, rate limiting

---

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Code Quality

- Follow ESLint configuration
- Write tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## Project Metrics

- **Development Time**: Optimized for learning and demonstration
- **Code Quality**: Production-grade with best practices
- **Test Coverage**: 70%+ across all layers
- **Documentation**: Comprehensive and auto-generated
- **Dependencies**: Minimal and well-maintained
- **Docker Support**: Full containerization
- **Scalability**: Designed for horizontal scaling

---

## Support

- **Documentation**: See `/docs` folder for detailed guides
- **Quick Start**: See [docs/QUICKSTART.md](docs/QUICKSTART.md)
- **API Reference**: See [docs/API.md](docs/API.md)
- **Issues**: Open a GitHub issue for bugs or feature requests
- **Tests**: Run `npm test` for examples and validation

---

## Acknowledgments

Built with modern backend best practices and designed to showcase:
- Enterprise-grade authentication and authorization
- Dynamic feature management systems
- Intelligent API rate limiting
- Comprehensive audit logging
- Test-driven development
- Containerized deployment strategies