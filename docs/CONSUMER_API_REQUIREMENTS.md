# 📋 Consumer API Requirements for Backend Team

## 📌 Overview

**Document Version:** 1.0  
**Date:** January 2026  
**Purpose:** Define API requirements for the AppZap Consumer Mobile App  
**Priority:** HIGH - Required for Phase 1 Launch

---

## 🎯 Problem Statement

### Current Architecture (NOT Recommended ❌)

```
┌─────────────────────────────────────────────────────────────────┐
│                     Mobile App (Flutter)                        │
└─────────────────────────────────────────────────────────────────┘
           │                                    │
           │ Direct Connection                  │ Direct Connection
           ▼                                    ▼
┌─────────────────────────┐      ┌─────────────────────────────────┐
│  Auth Service           │      │  AppZap API                     │
│  auth.lailaolab.com     │      │  app-api.appzap.la/app          │
│  (GraphQL)              │      │  (REST)                         │
└─────────────────────────┘      └─────────────────────────────────┘
```

### Issues with Current Architecture:
1. ❌ **Security Risk**: Mobile app has direct access to internal auth service
2. ❌ **Multiple Endpoints**: App must manage 2+ different API connections
3. ❌ **Mixed Protocols**: GraphQL (auth) + REST (profile) = complexity
4. ❌ **No Abstraction**: Changes to auth service require app updates
5. ❌ **Inconsistent Errors**: Different error formats from different services
6. ❌ **Hard to Monitor**: Traffic scattered across multiple services

---

## ✅ Proposed Architecture (Recommended)

```
┌─────────────────────────────────────────────────────────────────┐
│                     Mobile App (Flutter)                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Single Connection (REST)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Consumer API Gateway                         │
│                  api.appzap.la/consumer/v1                      │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Auth Module │  │ User Module │  │ Order Module│             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
           │                │                    │
           │ Internal       │ Internal           │ Internal
           ▼                ▼                    ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Auth Service   │ │  User Database  │ │  Order Service  │
│  (Internal)     │ │  (Internal)     │ │  (Internal)     │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Benefits:
1. ✅ **Single Entry Point**: Mobile app connects to ONE API only
2. ✅ **Security**: Internal services hidden from mobile app
3. ✅ **Consistency**: All responses use same format
4. ✅ **Flexibility**: Backend can change internal services without app updates
5. ✅ **Monitoring**: All traffic goes through one gateway
6. ✅ **Rate Limiting**: Central control of API usage

---

## 🔐 Authentication API Requirements

### Base URL
```
https://api.appzap.la/consumer/v1
```

### 1. Request OTP

**Endpoint:** `POST /auth/request-otp`

**Description:** Send OTP to user's phone number for verification

**Request:**
```json
{
  "phoneNumber": "+8562012345678"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "phoneNumber": "+8562012345678",
    "expiresIn": 300,
    "retryAfter": 60
  }
}
```

**Response (Error - 429 Rate Limited):**
```json
{
  "success": false,
  "error": {
    "code": "OTP_RATE_LIMITED",
    "message": "Too many OTP requests. Please try again later.",
    "retryAfter": 3600
  }
}
```

**Response (Error - 400 Bad Request):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PHONE_NUMBER",
    "message": "Phone number format is invalid"
  }
}
```

**Business Rules:**
- Phone number must be in E.164 format (+856XXXXXXXXX)
- OTP expires after 5 minutes (300 seconds)
- Max 5 OTP requests per phone per hour
- Daily limit: 10 OTP requests per phone

---

### 2. Verify OTP

**Endpoint:** `POST /auth/verify-otp`

**Description:** Verify OTP and authenticate user

**Request:**
```json
{
  "phoneNumber": "+8562012345678",
  "otp": "123456"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Authentication successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400,
    "tokenType": "Bearer",
    "user": {
      "id": "user_abc123",
      "phoneNumber": "+8562012345678",
      "name": null,
      "email": null,
      "profileImageUrl": null,
      "isNewUser": true,
      "createdAt": "2026-01-06T10:00:00Z",
      "lastLoginAt": "2026-01-06T10:00:00Z"
    }
  }
}
```

**Response (Error - 401 Invalid OTP):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_OTP",
    "message": "OTP is invalid or expired",
    "attemptsRemaining": 2
  }
}
```

**Response (Error - 429 Too Many Attempts):**
```json
{
  "success": false,
  "error": {
    "code": "TOO_MANY_ATTEMPTS",
    "message": "Too many failed attempts. Please request a new OTP.",
    "lockoutDuration": 300
  }
}
```

**Business Rules:**
- OTP is 6 digits
- OTP expires after 5 minutes
- Max 3 failed verification attempts per OTP
- After 3 failed attempts, user must request new OTP
- If user doesn't exist, create new user account
- Access token expires in 24 hours
- Refresh token expires in 30 days

---

### 3. Refresh Token

**Endpoint:** `POST /auth/refresh`

**Description:** Get new access token using refresh token

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400,
    "tokenType": "Bearer"
  }
}
```

**Response (Error - 401 Invalid Token):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REFRESH_TOKEN",
    "message": "Refresh token is invalid or expired"
  }
}
```

**Business Rules:**
- Refresh token can only be used once
- New refresh token issued with each refresh
- Old refresh token is invalidated after use

---

### 4. Logout

**Endpoint:** `POST /auth/logout`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Business Rules:**
- Invalidate all tokens for this session
- Optional: Invalidate all sessions for user (if `allDevices: true`)

---

## 👤 User Profile API Requirements

### 5. Get Current User (Me)

**Endpoint:** `GET /auth/me`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "id": "user_abc123",
    "phoneNumber": "+8562012345678",
    "name": "John Doe",
    "email": "john@example.com",
    "profileImageUrl": "https://cdn.appzap.la/profiles/user_abc123.jpg",
    "dateOfBirth": "1990-01-15",
    "gender": "male",
    "address": {
      "village": "Ban Phontan",
      "district": "Chanthabuly",
      "province": "Vientiane Capital"
    },
    "points": 1500,
    "level": {
      "current": 2,
      "name": "Silver",
      "pointsToNext": 500,
      "progressPercentage": 75.0
    },
    "preferences": {
      "language": "lo",
      "notifications": {
        "push": true,
        "sms": false,
        "email": true
      }
    },
    "createdAt": "2026-01-06T10:00:00Z",
    "lastLoginAt": "2026-01-06T15:30:00Z"
  }
}
```

**Response (Error - 401 Unauthorized):**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Access token is invalid or expired"
  }
}
```

---

### 6. Update Profile

**Endpoint:** `PUT /auth/me`

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "dateOfBirth": "1990-01-15",
  "gender": "male",
  "address": {
    "village": "Ban Phontan",
    "district": "Chanthabuly",
    "province": "Vientiane Capital"
  },
  "preferences": {
    "language": "lo",
    "notifications": {
      "push": true,
      "sms": false,
      "email": true
    }
  }
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": "user_abc123",
    "phoneNumber": "+8562012345678",
    "name": "John Doe",
    "email": "john@example.com",
    "profileImageUrl": null,
    "dateOfBirth": "1990-01-15",
    "gender": "male",
    "address": {
      "village": "Ban Phontan",
      "district": "Chanthabuly",
      "province": "Vientiane Capital"
    },
    "updatedAt": "2026-01-06T16:00:00Z"
  }
}
```

**Validation Rules:**
- `name`: 1-100 characters
- `email`: Valid email format (optional)
- `gender`: "male", "female", or "other"
- `dateOfBirth`: ISO 8601 date format

---

### 7. Upload Profile Image

**Endpoint:** `POST /auth/me/avatar`

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: multipart/form-data
```

**Request:**
```
Form Data:
- image: (file) JPEG, PNG, or WebP, max 5MB
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Profile image uploaded successfully",
  "data": {
    "profileImageUrl": "https://cdn.appzap.la/profiles/user_abc123.jpg"
  }
}
```

**Validation Rules:**
- Max file size: 5MB
- Allowed formats: JPEG, PNG, WebP
- Image will be resized to 400x400px
- Old image will be deleted

---

## 🎯 Points API Requirements

### 8. Get User Points

**Endpoint:** `GET /users/me/points`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "totalPoints": 1500,
    "availablePoints": 1200,
    "pendingPoints": 300,
    "expiringPoints": {
      "amount": 100,
      "expiresAt": "2026-02-28T23:59:59Z"
    },
    "level": {
      "current": 2,
      "name": "Silver",
      "pointsToNext": 500,
      "benefits": [
        "5% cashback on all orders",
        "Free delivery on orders over 100K"
      ]
    },
    "history": {
      "totalEarned": 2000,
      "totalSpent": 500,
      "lastTransaction": {
        "type": "earn",
        "amount": 50,
        "description": "Order #12345",
        "date": "2026-01-05T14:30:00Z"
      }
    }
  }
}
```

---

### 9. Get Points History

**Endpoint:** `GET /users/me/points/history`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `type` (optional): Filter by type (earn, redeem, expire)

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "txn_001",
        "type": "earn",
        "amount": 50,
        "balance": 1500,
        "description": "Order #12345 - Market",
        "orderId": "order_12345",
        "createdAt": "2026-01-05T14:30:00Z"
      },
      {
        "id": "txn_002",
        "type": "redeem",
        "amount": -100,
        "balance": 1450,
        "description": "Redeemed for 10% discount",
        "createdAt": "2026-01-04T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

---

## 🔒 Security Requirements

### JWT Token Structure

**Access Token Claims:**
```json
{
  "sub": "user_abc123",
  "iat": 1704542400,
  "exp": 1704628800,
  "type": "access",
  "roles": ["consumer"]
}
```

**Refresh Token Claims:**
```json
{
  "sub": "user_abc123",
  "iat": 1704542400,
  "exp": 1707134400,
  "type": "refresh",
  "jti": "unique-token-id"
}
```

### Security Best Practices

1. **Token Storage:**
   - Access tokens stored in memory only
   - Refresh tokens stored in secure storage (Keychain/Keystore)

2. **HTTPS Only:**
   - All API calls must use HTTPS
   - Reject HTTP connections

3. **Rate Limiting:**
   - Auth endpoints: 10 requests/minute per IP
   - Protected endpoints: 100 requests/minute per user
   - OTP requests: 5/hour per phone number

4. **Input Validation:**
   - Sanitize all input
   - Validate phone number format (E.164)
   - Limit string lengths

5. **Headers Required:**
   ```
   User-Agent: AppZap-Consumer/1.0.0 (iOS/17.0; iPhone14,2)
   X-App-Version: 1.0.0
   X-Platform: ios|android
   Accept-Language: lo|en
   ```

---

## 📱 Mobile App Integration

### API Client Configuration

```dart
// Base configuration for mobile app
const String consumerApiBaseUrl = 'https://api.appzap.la/consumer/v1';

// Headers for all requests
Map<String, String> getHeaders(String? accessToken) {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'AppZap-Consumer/1.0.0',
    'X-App-Version': '1.0.0',
    'X-Platform': Platform.isIOS ? 'ios' : 'android',
    'Accept-Language': 'lo',
    if (accessToken != null) 'Authorization': 'Bearer $accessToken',
  };
}
```

### Error Handling

All error responses follow this format:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {} // Optional additional details
  }
}
```

**Common Error Codes:**
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Access token invalid/expired |
| `FORBIDDEN` | 403 | User doesn't have permission |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `RATE_LIMITED` | 429 | Too many requests |
| `SERVER_ERROR` | 500 | Internal server error |
| `INVALID_OTP` | 401 | OTP is wrong or expired |
| `OTP_RATE_LIMITED` | 429 | Too many OTP requests |
| `PHONE_BLOCKED` | 403 | Phone number is blocked |

---

## 📊 Implementation Priority

### Phase 1 (Launch Requirements) ⭐
| Endpoint | Priority | Status |
|----------|----------|--------|
| `POST /auth/request-otp` | P0 | Required |
| `POST /auth/verify-otp` | P0 | Required |
| `POST /auth/refresh` | P0 | Required |
| `POST /auth/logout` | P0 | Required |
| `GET /auth/me` | P0 | Required |
| `PUT /auth/me` | P1 | Required |
| `GET /users/me/points` | P1 | Required |

### Phase 2 (Post-Launch)
| Endpoint | Priority | Status |
|----------|----------|--------|
| `POST /auth/me/avatar` | P2 | Optional |
| `GET /users/me/points/history` | P2 | Optional |
| `DELETE /auth/sessions` | P2 | Optional |

---

## 🧪 Testing Requirements

### Test Accounts
Please provide test phone numbers that work in development:
- `+856 20 99999991` - Standard user
- `+856 20 99999992` - User with points
- `+856 20 99999993` - New user (first login)

### Test OTP
- In development/staging: Any 6-digit OTP should work
- Or use fixed OTP: `123456` for test accounts

---

## 📅 Timeline

| Milestone | Target Date | Description |
|-----------|-------------|-------------|
| API Design Review | Week 1 | Review and finalize this document |
| Development Start | Week 1 | Begin implementation |
| Auth Endpoints Ready | Week 2 | OTP + Login working |
| Profile Endpoints Ready | Week 2 | Profile CRUD working |
| Integration Testing | Week 3 | Mobile app integration |
| Production Deploy | Week 3 | Go live |

---

## 📞 Contact

**Backend Team Lead:** [Your Name]  
**Mobile Team Lead:** [Your Name]  
**Project Manager:** [Your Name]

---

## 📝 Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 2026 | Initial document |

---

**Note:** Once the Consumer API is ready, the mobile app will need to update its API client to point to the new endpoint. All existing direct connections to `auth.lailaolab.com` and `app-api.appzap.la` should be removed.

