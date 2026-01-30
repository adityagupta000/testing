# API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## Authentication Endpoints

### Register New User
Creates a new user account.

**Endpoint:** `POST /api/auth/register`  
**Access:** Public

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "_id": "user-id",
      "email": "user@example.com",
      "role": "user",
      "firstName": "John",
      "lastName": "Doe"
    },
    "tokens": {
      "accessToken": "jwt-access-token",
      "refreshToken": "jwt-refresh-token"
    }
  }
}
```

### Login
Authenticates a user and returns JWT tokens.

**Endpoint:** `POST /api/auth/login`  
**Access:** Public

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { ... },
    "tokens": {
      "accessToken": "jwt-access-token",
      "refreshToken": "jwt-refresh-token"
    }
  }
}
```

**Error Responses:**
- `401` - Invalid credentials
- `403` - Account deactivated
- `423` - Account locked

### Get Current User
Retrieves the authenticated user's profile.

**Endpoint:** `GET /api/auth/me`  
**Access:** Private

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "user-id",
      "email": "user@example.com",
      "role": "user",
      "firstName": "John",
      "lastName": "Doe",
      "isActive": true,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

### Update Profile
Updates the authenticated user's profile.

**Endpoint:** `PUT /api/auth/profile`  
**Access:** Private

**Request Body:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith"
}
```

**Response:** `200 OK`

### Change Password
Changes the authenticated user's password.

**Endpoint:** `PUT /api/auth/change-password`  
**Access:** Private

**Request Body:**
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456"
}
```

**Response:** `200 OK`

### Logout
Logs out the current user.

**Endpoint:** `POST /api/auth/logout`  
**Access:** Private

**Response:** `200 OK`

---

## Feature Toggle Endpoints

### Get All Features
Retrieves all feature toggles.

**Endpoint:** `GET /api/features`  
**Access:** Private

**Query Parameters:**
- `enabled` (boolean) - Filter by enabled status
- `search` (string) - Search by name or description

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "features": [
      {
        "_id": "feature-id",
        "featureName": "premium-features",
        "description": "Premium features",
        "enabled": true,
        "allowedRoles": ["admin", "user"],
        "rolloutPercentage": 100,
        "environments": {
          "development": { "enabled": true },
          "production": { "enabled": false }
        }
      }
    ],
    "count": 1
  }
}
```

### Get Enabled Features
Retrieves features enabled for the current user's role.

**Endpoint:** `GET /api/features/enabled`  
**Access:** Private

**Response:** `200 OK`

### Check Feature Access
Checks if a specific feature is enabled for the current user.

**Endpoint:** `POST /api/features/check`  
**Access:** Private

**Request Body:**
```json
{
  "featureName": "premium-features"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "featureName": "premium-features",
    "enabled": true,
    "role": "user",
    "environment": "development"
  }
}
```

### Create Feature (Admin)
Creates a new feature toggle.

**Endpoint:** `POST /api/features`  
**Access:** Admin Only

**Request Body:**
```json
{
  "featureName": "new-feature",
  "description": "Description of the feature",
  "enabled": true,
  "allowedRoles": ["admin", "user"],
  "rolloutPercentage": 50,
  "environments": {
    "development": { "enabled": true },
    "production": { "enabled": false }
  }
}
```

**Response:** `201 Created`

### Update Feature (Admin)
Updates an existing feature toggle.

**Endpoint:** `PUT /api/features/:id`  
**Access:** Admin Only

**Request Body:**
```json
{
  "description": "Updated description",
  "rolloutPercentage": 75
}
```

**Response:** `200 OK`

### Toggle Feature (Admin)
Enables or disables a feature.

**Endpoint:** `PUT /api/features/:id/toggle`  
**Access:** Admin Only

**Request Body:**
```json
{
  "enabled": false
}
```

**Response:** `200 OK`

### Delete Feature (Admin)
Deletes a feature toggle.

**Endpoint:** `DELETE /api/features/:id`  
**Access:** Admin Only

**Response:** `200 OK`

### Get Feature Statistics (Admin)
Retrieves feature toggle statistics.

**Endpoint:** `GET /api/features/stats`  
**Access:** Admin Only

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "total": 10,
    "enabled": 7,
    "disabled": 3,
    "byEnvironment": {
      "development": 10,
      "production": 5
    }
  }
}
```

---

## Rate Guard Endpoints

### Get All Rate Guards
Retrieves all rate guard rules.

**Endpoint:** `GET /api/rate-guards`  
**Access:** Private

**Query Parameters:**
- `enabled` (boolean) - Filter by enabled status
- `method` (string) - Filter by HTTP method
- `search` (string) - Search by route path

**Response:** `200 OK`

### Create Rate Guard (Admin)
Creates a new rate limiting rule.

**Endpoint:** `POST /api/rate-guards`  
**Access:** Admin Only

**Request Body:**
```json
{
  "routePath": "/api/upload",
  "method": "POST",
  "description": "Upload rate limiting",
  "enabled": true,
  "limits": {
    "admin": {
      "maxRequests": 100,
      "windowMs": 60000
    },
    "user": {
      "maxRequests": 20,
      "windowMs": 60000
    },
    "guest": {
      "maxRequests": 3,
      "windowMs": 60000
    }
  },
  "errorMessage": "Rate limit exceeded. Please try again later."
}
```

**Response:** `201 Created`

### Test Rate Limit
Tests the rate limit for a specific route.

**Endpoint:** `POST /api/rate-guards/test`  
**Access:** Private

**Request Body:**
```json
{
  "routePath": "/api/upload",
  "method": "POST"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "hasRule": true,
    "enabled": true,
    "limit": {
      "maxRequests": 20,
      "windowMs": 60000
    }
  }
}
```

---

## User Management Endpoints (Admin Only)

### Get All Users
Retrieves a paginated list of users.

**Endpoint:** `GET /api/users`  
**Access:** Admin Only

**Query Parameters:**
- `page` (number) - Page number (default: 1)
- `limit` (number) - Items per page (default: 10)
- `role` (string) - Filter by role
- `isActive` (boolean) - Filter by active status
- `search` (string) - Search by email or name

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "users": [ ... ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 50,
      "pages": 5
    }
  }
}
```

### Update User
Updates a user's information.

**Endpoint:** `PUT /api/users/:id`  
**Access:** Admin Only

**Request Body:**
```json
{
  "firstName": "Updated",
  "role": "admin",
  "isActive": true
}
```

**Response:** `200 OK`

### Change User Role
Changes a user's role.

**Endpoint:** `PUT /api/users/:id/role`  
**Access:** Admin Only

**Request Body:**
```json
{
  "role": "admin"
}
```

**Response:** `200 OK`

### Deactivate User
Deactivates a user account.

**Endpoint:** `PUT /api/users/:id/deactivate`  
**Access:** Admin Only

**Response:** `200 OK`

### Activate User
Activates a user account.

**Endpoint:** `PUT /api/users/:id/activate`  
**Access:** Admin Only

**Response:** `200 OK`

### Delete User
Permanently deletes a user.

**Endpoint:** `DELETE /api/users/:id`  
**Access:** Admin Only

**Response:** `200 OK`

---

## Audit Log Endpoints (Admin Only)

### Get Audit Logs
Retrieves audit logs with filtering.

**Endpoint:** `GET /api/audit`  
**Access:** Admin Only

**Query Parameters:**
- `action` (string) - Filter by action type
- `resourceType` (string) - Filter by resource type
- `userId` (string) - Filter by user ID
- `success` (boolean) - Filter by success status
- `startDate` (ISO date) - Start date for range
- `endDate` (ISO date) - End date for range
- `page` (number) - Page number
- `limit` (number) - Items per page

**Response:** `200 OK`

### Get User Audit Logs
Retrieves audit logs for a specific user.

**Endpoint:** `GET /api/audit/user/:userId`  
**Access:** Admin Only

**Response:** `200 OK`

### Get Failed Actions
Retrieves recent failed actions.

**Endpoint:** `GET /api/audit/failed`  
**Access:** Admin Only

**Query Parameters:**
- `hours` (number) - Look back period in hours (default: 24)

**Response:** `200 OK`

### Get Audit Statistics
Retrieves audit log statistics.

**Endpoint:** `GET /api/audit/stats`  
**Access:** Admin Only

**Query Parameters:**
- `startDate` (ISO date) - Start date
- `endDate` (ISO date) - End date

**Response:** `200 OK`

---

## System Endpoints

### Health Check
Basic health check endpoint.

**Endpoint:** `GET /api/health`  
**Access:** Public

**Response:** `200 OK`
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-01-30T10:00:00.000Z",
  "uptime": 12345
}
```

### System Status
Detailed system status.

**Endpoint:** `GET /api/status`  
**Access:** Public

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "service": "Policy Toggle Service",
    "version": "1.0.0",
    "environment": "development",
    "status": "operational",
    "database": "connected",
    "timestamp": "2025-01-30T10:00:00.000Z"
  }
}
```

---

## Error Responses

All endpoints may return these error responses:

### 400 Bad Request
Invalid request data or validation error.
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Please provide a valid email"
    }
  ]
}
```

### 401 Unauthorized
Missing or invalid authentication token.
```json
{
  "success": false,
  "message": "Authentication required"
}
```

### 403 Forbidden
Insufficient permissions.
```json
{
  "success": false,
  "message": "Insufficient permissions"
}
```

### 404 Not Found
Resource not found.
```json
{
  "success": false,
  "message": "Resource not found"
}
```

### 429 Too Many Requests
Rate limit exceeded.
```json
{
  "success": false,
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 60
}
```

### 500 Internal Server Error
Server error.
```json
{
  "success": false,
  "message": "Something went wrong. Please try again later."
}
```

---

## Rate Limiting

Rate limits are applied based on user role and route configuration. Headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

---

## Pagination

Paginated endpoints return data in this format:

```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "pages": 10
    }
  }
}
```