# Quick Start Guide

Get the Policy Toggle Service running in 5 minutes!

## Option 1: Docker (Recommended)

### Step 1: Prerequisites
- Docker and Docker Compose installed

### Step 2: Start Services
```bash
# Clone repository
git clone <repo-url>
cd policy-toggle-service

# Start all services
docker compose up -d
```

### Step 3: Verify
```bash
# Check health
curl http://localhost:3000/api/health

# Expected response:
# {"success":true,"status":"healthy", ...}
```

### Step 4: Login
```bash
# Login as admin
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin@123456"}'
```

**Done!** 

---

## Option 2: Local Development

### Step 1: Prerequisites
- Node.js 18+
- MongoDB 7.0+

### Step 2: Install
```bash
# Clone repository
git clone <repo-url>
cd policy-toggle-service

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

### Step 3: Start MongoDB
```bash
# Start MongoDB (in separate terminal)
mongod --dbpath /path/to/data
```

### Step 4: Start Application
```bash
# Seed sample data
npm run seed

# Start development server
npm run dev
```

### Step 5: Verify
```bash
# Check health
curl http://localhost:3000/api/health
```

**Done!** 

---

## Quick Test Commands

### 1. Register a New User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

Save the `accessToken` from the response!

### 3. Get Your Profile
```bash
TOKEN="your-access-token-here"

curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Check Feature Access
```bash
curl -X POST http://localhost:3000/api/features/check \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"featureName": "premium-features"}'
```

### 5. Get Available Features
```bash
curl http://localhost:3000/api/features/enabled \
  -H "Authorization: Bearer $TOKEN"
```

---

## Admin Actions

### Login as Admin
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Admin@123456"
  }'
```

### Create a New Feature Toggle
```bash
ADMIN_TOKEN="your-admin-token"

curl -X POST http://localhost:3000/api/features \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "featureName": "new-feature",
    "description": "My new feature",
    "enabled": true,
    "allowedRoles": ["admin", "user"],
    "rolloutPercentage": 100
  }'
```

### Create a Rate Limit Rule
```bash
curl -X POST http://localhost:3000/api/rate-guards \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "routePath": "/api/test",
    "method": "POST",
    "enabled": true,
    "limits": {
      "admin": {"maxRequests": 100, "windowMs": 60000},
      "user": {"maxRequests": 20, "windowMs": 60000},
      "guest": {"maxRequests": 5, "windowMs": 60000}
    }
  }'
```

### View Audit Logs
```bash
curl http://localhost:3000/api/audit \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# System tests
npm run test:system

# Generate test documentation
npm run test:docs
```

---

## Default Credentials

| Role  | Email              | Password      |
|-------|-------------------|---------------|
| Admin | admin@example.com | Admin@123456  |
| User  | user@example.com  | User@123456   |
| Guest | guest@example.com | Guest@123456  |

---

## Common Issues

### MongoDB Connection Error
```bash
# Make sure MongoDB is running
mongod --version

# Check MongoDB is accessible
mongo --eval "db.version()"
```

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Permission Denied (Docker)
```bash
# Run with sudo or add user to docker group
sudo docker-compose up -d
```

---

## Next Steps

1. Read [API Documentation](docs/API.md)
2. Explore the codebase structure
3. Run the test suite
4. Try modifying feature toggles
5. Create custom rate limiting rules

---

## Support

- **Documentation**: See `/docs` folder
- **Issues**: Open a GitHub issue
- **Tests**: Run `npm test` for examples