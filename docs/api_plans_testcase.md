# AppZap Consumer API V2 - Test Cases & Testing Plan

> **Document Version:** 1.0  
> **Last Updated:** February 2026  
> **Status:** Ready for Testing

---

## Table of Contents

1. [Testing Overview](#testing-overview)
2. [Test Environment Setup](#test-environment-setup)
3. [Phase 1: Core Value (Launch) Test Cases](#phase-1-core-value-launch-test-cases)
4. [Phase 2: Viral Growth Test Cases](#phase-2-viral-growth-test-cases)
5. [Phase 3: Retention Test Cases](#phase-3-retention-test-cases)
6. [Phase 4: Ecosystem Expansion Test Cases](#phase-4-ecosystem-expansion-test-cases)
7. [Integration Test Scenarios](#integration-test-scenarios)
8. [End-to-End Test Flows](#end-to-end-test-flows)
9. [Performance & Load Testing](#performance--load-testing)
10. [Test Data Requirements](#test-data-requirements)

---

## Testing Overview

### Test Types

| Type | Purpose | Tools |
|------|---------|-------|
| **Unit Tests** | Test individual functions/services | Jest, Supertest |
| **Integration Tests** | Test API endpoints with DB | Jest, Supertest, MongoDB Memory Server |
| **E2E Tests** | Full user flows | Postman, Newman |
| **Load Tests** | Performance under stress | k6, Artillery |

### Test Naming Convention

```
[Phase]_[Feature]_[Scenario]_[Expected]
```

Example: `P1_AUTH_ValidOTP_ReturnsToken`

### Test Priority Levels

| Priority | Description |
|----------|-------------|
| **P0** | Critical - Must pass before any deployment |
| **P1** | High - Core functionality |
| **P2** | Medium - Important features |
| **P3** | Low - Edge cases |

---

## Test Environment Setup

### Prerequisites

```bash
# Install dependencies
npm install --save-dev jest supertest @types/jest ts-jest mongodb-memory-server

# Environment variables for testing
NODE_ENV=test
MONGODB_URI=mongodb://localhost:27017/appzap_test
REDIS_URL=redis://localhost:6379/1
JWT_SECRET=test-jwt-secret-key
```

### Test Database Setup

```typescript
// tests/setup.ts
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
```

---

## Phase 1: Core Value (Launch) Test Cases

### 1.1 Authentication - OTP Request

#### TC-P1-AUTH-001: Request OTP with Valid Phone
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `POST /api/v1/auth/request-otp` |
| **Preconditions** | None |

**Request:**
```json
{
  "phone": "+8562012345678"
}
```

**Expected Response (200):**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "otpId": "uuid-here",
    "expiresIn": 300,
    "retryAfter": 60
  }
}
```

**Assertions:**
- [ ] Status code is 200
- [ ] `otpId` is a valid UUID
- [ ] `expiresIn` is 300 seconds
- [ ] OTP is stored in Redis

---

#### TC-P1-AUTH-002: Request OTP with Invalid Phone Format
| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Endpoint** | `POST /api/v1/auth/request-otp` |

**Request:**
```json
{
  "phone": "12345"
}
```

**Expected Response (400):**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid phone number format",
    "statusCode": 400
  }
}
```

---

#### TC-P1-AUTH-003: Request OTP Rate Limited
| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Endpoint** | `POST /api/v1/auth/request-otp` |
| **Preconditions** | 5 OTP requests within 1 minute |

**Expected Response (429):**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many OTP requests. Please try again later.",
    "statusCode": 429
  }
}
```

---

### 1.2 Authentication - OTP Verification

#### TC-P1-AUTH-004: Verify OTP - Valid Code
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `POST /api/v1/auth/verify-otp` |
| **Preconditions** | Valid OTP requested |

**Request:**
```json
{
  "phone": "+8562012345678",
  "otp": "123456"
}
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "user-id",
      "phone": "+8562012345678",
      "profile": "personal",
      "loyaltyPoints": 0
    },
    "accessToken": "jwt-token",
    "refreshToken": "refresh-token",
    "expiresIn": 86400
  }
}
```

**Assertions:**
- [ ] Access token is valid JWT
- [ ] User is created if new
- [ ] Welcome bonus points awarded for new users

---

#### TC-P1-AUTH-005: Verify OTP - Invalid Code
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `POST /api/v1/auth/verify-otp` |

**Request:**
```json
{
  "phone": "+8562012345678",
  "otp": "000000"
}
```

**Expected Response (401):**
```json
{
  "error": {
    "code": "INVALID_OTP",
    "message": "Invalid or expired OTP",
    "statusCode": 401
  }
}
```

---

#### TC-P1-AUTH-006: Verify OTP - Expired Code
| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Endpoint** | `POST /api/v1/auth/verify-otp` |
| **Preconditions** | OTP requested > 5 minutes ago |

**Expected Response (401):**
```json
{
  "error": {
    "code": "OTP_EXPIRED",
    "message": "OTP has expired. Please request a new one.",
    "statusCode": 401
  }
}
```

---

### 1.3 Restaurant Discovery

#### TC-P1-EATS-001: Get Restaurants - No Filters
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `GET /api/v1/eats/restaurants` |

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "restaurants": [
      {
        "id": "v1_store123",
        "name": "Restaurant A",
        "image": "https://...",
        "rating": 4.5,
        "reviewCount": 120,
        "priceRange": "$$",
        "cuisineTypes": ["Lao", "Thai"],
        "isOpen": true,
        "distance": 1.2,
        "posVersion": "v1"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

**Assertions:**
- [ ] Returns restaurants from both POS V1 and V2
- [ ] Each restaurant has unified ID format (`v1_` or `v2_` prefix)
- [ ] Pagination is correct

---

#### TC-P1-EATS-002: Get Restaurants - With Location Filter
| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Endpoint** | `GET /api/v1/eats/restaurants?latitude=17.9667&longitude=102.6000&radius=5` |

**Assertions:**
- [ ] All returned restaurants within 5km radius
- [ ] Results sorted by distance (nearest first)

---

#### TC-P1-EATS-003: Get Restaurant by ID - POS V1
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `GET /api/v1/eats/restaurants/v1_store123` |

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "restaurant": {
      "id": "v1_store123",
      "name": "Restaurant A",
      "menu": {
        "categories": [
          {
            "id": "cat1",
            "name": "Main Dishes",
            "items": [...]
          }
        ]
      }
    }
  }
}
```

---

#### TC-P1-EATS-004: Get Restaurant by ID - POS V2
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `GET /api/v1/eats/restaurants/v2_rest456` |

**Assertions:**
- [ ] Returns restaurant from POS V2
- [ ] Menu items properly transformed to unified format

---

#### TC-P1-EATS-005: Get Restaurant by ID - Not Found
| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Endpoint** | `GET /api/v1/eats/restaurants/v1_invalid` |

**Expected Response (404):**
```json
{
  "error": {
    "code": "RESTAURANT_NOT_FOUND",
    "message": "Restaurant not found",
    "statusCode": 404
  }
}
```

---

### 1.4 Cart Management

#### TC-P1-CART-001: Create Cart
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `POST /api/v1/eats/cart` |
| **Auth Required** | Yes |

**Request:**
```json
{
  "restaurantId": "v1_store123",
  "orderType": "dine_in",
  "tableId": "table-5"
}
```

**Expected Response (201):**
```json
{
  "success": true,
  "data": {
    "cart": {
      "_id": "cart-id",
      "restaurantId": "v1_store123",
      "orderType": "dine_in",
      "tableId": "table-5",
      "items": [],
      "subtotal": 0,
      "total": 0,
      "status": "active"
    }
  }
}
```

---

#### TC-P1-CART-002: Add Item to Cart
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `POST /api/v1/eats/cart/:cartId/items` |
| **Auth Required** | Yes |

**Request:**
```json
{
  "menuItemId": "item123",
  "name": "Pad Thai",
  "price": 35000,
  "quantity": 2,
  "modifiers": [
    { "name": "Extra Spicy", "price": 2000 }
  ],
  "specialInstructions": "No peanuts"
}
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "cart": {
      "_id": "cart-id",
      "items": [
        {
          "_id": "item-uuid",
          "menuItemId": "item123",
          "name": "Pad Thai",
          "unitPrice": 35000,
          "quantity": 2,
          "modifiers": [...],
          "subtotal": 74000
        }
      ],
      "subtotal": 74000,
      "total": 74000
    }
  }
}
```

---

#### TC-P1-CART-003: Add Item to Cart - Invalid Cart
| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Endpoint** | `POST /api/v1/eats/cart/invalid-id/items` |

**Expected Response (404):**
```json
{
  "error": {
    "code": "CART_NOT_FOUND",
    "message": "Cart not found or expired",
    "statusCode": 404
  }
}
```

---

### 1.5 Checkout

#### TC-P1-CHECKOUT-001: Successful Checkout
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `POST /api/v1/eats/cart/:cartId/checkout` |
| **Auth Required** | Yes |
| **Preconditions** | Cart with items |

**Request:**
```json
{
  "paymentMethod": "phapay",
  "tipAmount": 10000,
  "customerInfo": {
    "name": "John Doe",
    "phone": "+8562012345678"
  }
}
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "order": {
      "_id": "order-id",
      "orderNumber": "ORD-20260206-001",
      "status": "pending_payment",
      "total": 84000
    },
    "payment": {
      "paymentUrl": "https://phapay.la/pay/...",
      "qrCode": "base64-encoded-qr"
    }
  }
}
```

**Assertions:**
- [ ] Order created in database
- [ ] Order synced to appropriate POS (V1 or V2)
- [ ] Payment URL generated

---

#### TC-P1-CHECKOUT-002: Checkout with Loyalty Points
| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Endpoint** | `POST /api/v1/eats/cart/:cartId/checkout` |
| **Preconditions** | User has 500 loyalty points |

**Request:**
```json
{
  "paymentMethod": "phapay",
  "pointsToRedeem": 500
}
```

**Assertions:**
- [ ] 500 points deducted (= 5,000 LAK discount)
- [ ] Loyalty transaction recorded
- [ ] Order total reduced

---

#### TC-P1-CHECKOUT-003: Checkout Empty Cart
| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Endpoint** | `POST /api/v1/eats/cart/:cartId/checkout` |
| **Preconditions** | Cart has no items |

**Expected Response (400):**
```json
{
  "error": {
    "code": "EMPTY_CART",
    "message": "Cannot checkout an empty cart",
    "statusCode": 400
  }
}
```

---

### 1.6 Deep Links

#### TC-P1-LINK-001: Create Deep Link for Order
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `POST /api/v1/deep-links` |
| **Auth Required** | Yes |

**Request:**
```json
{
  "targetType": "order",
  "targetId": "order-123",
  "campaignName": "web_to_app",
  "source": "web_ordering",
  "medium": "qr_code",
  "metadata": {
    "phone": "+8562012345678",
    "restaurantId": "v1_store123"
  },
  "expiresInDays": 30
}
```

**Expected Response (201):**
```json
{
  "success": true,
  "data": {
    "deepLink": {
      "shortCode": "abc123",
      "shortUrl": "https://appzap.la/links/abc123",
      "appUrl": "appzap://order/order-123?source=web_ordering",
      "expiresAt": "2026-03-08T00:00:00Z"
    }
  }
}
```

---

#### TC-P1-LINK-002: Redirect Deep Link - Mobile User
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `GET /links/abc123` |
| **User-Agent** | iPhone |

**Expected:**
- Redirect to `appzap://order/order-123?...`
- Track click event
- Fallback to App Store if app not installed

---

#### TC-P1-LINK-003: Redirect Deep Link - Desktop User
| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Endpoint** | `GET /links/abc123` |
| **User-Agent** | Chrome Desktop |

**Expected:**
- Show web download page with QR code
- Display order info preview
- Show app store links

---

### 1.7 Orders

#### TC-P1-ORDER-001: Get User Orders
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `GET /api/v1/eats/orders` |
| **Auth Required** | Yes |

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "_id": "order-id",
        "orderNumber": "ORD-20260206-001",
        "restaurant": {
          "id": "v1_store123",
          "name": "Restaurant A"
        },
        "items": [...],
        "total": 84000,
        "status": "completed",
        "createdAt": "2026-02-06T10:00:00Z"
      }
    ],
    "pagination": {...}
  }
}
```

**Assertions:**
- [ ] Returns orders from Consumer API database
- [ ] Can filter by status
- [ ] Properly paginated

---

## Phase 2: Viral Growth Test Cases

### 2.1 Spin-to-Win

#### TC-P2-SPIN-001: Execute Spin - Valid Reward
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `POST /api/v1/deep-links/spin-to-win/:rewardId/spin` |
| **Auth Required** | Yes |
| **Preconditions** | Valid unused reward ID |

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "result": {
      "prize": "10% Discount",
      "prizeType": "discount",
      "value": 10,
      "code": "SPIN10-ABC123",
      "expiresAt": "2026-02-20T23:59:59Z"
    },
    "animation": {
      "wheelPosition": 45,
      "duration": 3000
    }
  }
}
```

---

#### TC-P2-SPIN-002: Execute Spin - Already Used
| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Endpoint** | `POST /api/v1/deep-links/spin-to-win/:rewardId/spin` |
| **Preconditions** | Reward already spun |

**Expected Response (400):**
```json
{
  "error": {
    "code": "REWARD_ALREADY_CLAIMED",
    "message": "This reward has already been claimed",
    "statusCode": 400
  }
}
```

---

#### TC-P2-SPIN-003: Redeem Spin Reward
| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Endpoint** | `POST /api/v1/deep-links/spin-to-win/:rewardId/redeem` |
| **Preconditions** | Reward won but not redeemed |

**Request:**
```json
{
  "orderId": "order-123"
}
```

**Assertions:**
- [ ] Reward marked as redeemed
- [ ] Discount applied to order if applicable
- [ ] Cannot redeem twice

---

### 2.2 Social Gifting

#### TC-P2-GIFT-001: Get Gift Templates
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `GET /api/v1/gifts/templates` |
| **Auth Required** | No |

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "id": "coffee",
        "name": "Digital Coffee",
        "description": "Buy a coffee for your friend",
        "defaultAmount": 25000,
        "image": "https://...",
        "type": "digital_coffee"
      },
      {
        "id": "meal",
        "name": "Meal Voucher",
        "description": "Treat someone to a meal",
        "defaultAmount": 100000,
        "image": "https://...",
        "type": "meal_voucher"
      }
    ]
  }
}
```

---

#### TC-P2-GIFT-002: Create Gift - Pay with Cash
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `POST /api/v1/gifts` |
| **Auth Required** | Yes |

**Request:**
```json
{
  "type": "digital_coffee",
  "templateId": "coffee",
  "amount": 25000,
  "recipientPhone": "+8562098765432",
  "recipientName": "Jane Doe",
  "message": "Happy Birthday! ☕",
  "paymentMethod": "phapay"
}
```

**Expected Response (201):**
```json
{
  "success": true,
  "data": {
    "gift": {
      "_id": "gift-id",
      "giftCode": "GIFT-ABC123",
      "shortCode": "abc123",
      "status": "pending_payment",
      "amount": 25000
    },
    "payment": {
      "paymentUrl": "https://phapay.la/pay/...",
      "amount": 25000
    }
  }
}
```

---

#### TC-P2-GIFT-003: Create Gift - Pay with Loyalty Points
| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Endpoint** | `POST /api/v1/gifts` |
| **Preconditions** | User has 5000 points (= 50,000 LAK) |

**Request:**
```json
{
  "type": "digital_coffee",
  "amount": 25000,
  "paymentMethod": "loyalty_points"
}
```

**Assertions:**
- [ ] 2500 points deducted
- [ ] Gift immediately activated
- [ ] Loyalty transaction recorded

---

#### TC-P2-GIFT-004: Claim Gift
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `POST /api/v1/gifts/claim` |
| **Auth Required** | Yes |
| **Preconditions** | Gift exists and is active |

**Request:**
```json
{
  "giftCode": "GIFT-ABC123"
}
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "gift": {
      "_id": "gift-id",
      "status": "claimed",
      "recipientId": "user-id",
      "claimedAt": "2026-02-06T12:00:00Z"
    },
    "message": "Gift claimed successfully! You can now redeem it at any AppZap restaurant."
  }
}
```

---

#### TC-P2-GIFT-005: Redeem Gift at Restaurant
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `POST /api/v1/gifts/redeem` |
| **Auth Required** | Yes |
| **Preconditions** | Gift claimed by user |

**Request:**
```json
{
  "giftCode": "GIFT-ABC123",
  "restaurantId": "v1_store123",
  "orderId": "order-456",
  "amount": 20000
}
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "redemption": {
      "redeemedAmount": 20000,
      "remainingAmount": 5000,
      "giftStatus": "partially_used"
    }
  }
}
```

**Assertions:**
- [ ] Partial redemption works
- [ ] Remaining balance tracked
- [ ] Redemption history recorded

---

#### TC-P2-GIFT-006: Redeem Gift - Expired
| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Endpoint** | `POST /api/v1/gifts/redeem` |
| **Preconditions** | Gift expired |

**Expected Response (400):**
```json
{
  "error": {
    "code": "GIFT_EXPIRED",
    "message": "This gift has expired",
    "statusCode": 400
  }
}
```

---

#### TC-P2-GIFT-007: Cancel Gift Before Claim
| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Endpoint** | `DELETE /api/v1/gifts/:giftId` |
| **Preconditions** | Gift active but not claimed |

**Assertions:**
- [ ] Gift cancelled
- [ ] Refund initiated
- [ ] Cannot cancel already claimed gift

---

### 2.3 Bill Splitting

#### TC-P2-SPLIT-001: Create Split Session
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `POST /api/v1/bill-split` |
| **Auth Required** | Yes |
| **Preconditions** | Valid order exists |

**Request:**
```json
{
  "orderId": "order-123",
  "splitMethod": "equal",
  "maxParticipants": 4
}
```

**Expected Response (201):**
```json
{
  "success": true,
  "data": {
    "session": {
      "_id": "session-id",
      "sessionCode": "SPLIT-ABC123",
      "orderId": "order-123",
      "splitMethod": "equal",
      "hostId": "user-id",
      "participants": [
        {
          "userId": "user-id",
          "name": "John",
          "isHost": true,
          "status": "joined"
        }
      ],
      "shareUrl": "https://appzap.la/split/SPLIT-ABC123"
    }
  }
}
```

---

#### TC-P2-SPLIT-002: Join Split Session
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `POST /api/v1/bill-split/join` |
| **Auth Required** | Yes |

**Request:**
```json
{
  "sessionCode": "SPLIT-ABC123"
}
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "session": {
      "_id": "session-id",
      "participants": [
        { "userId": "host-id", "name": "John", "isHost": true },
        { "userId": "user-id", "name": "Jane", "isHost": false }
      ]
    }
  }
}
```

---

#### TC-P2-SPLIT-003: Calculate Equal Split
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `POST /api/v1/bill-split/:sessionId/calculate` |
| **Auth Required** | Yes (Host only) |
| **Preconditions** | 4 participants, order total 200,000 LAK |

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "shares": [
      { "userId": "user1", "name": "John", "amount": 50000 },
      { "userId": "user2", "name": "Jane", "amount": 50000 },
      { "userId": "user3", "name": "Bob", "amount": 50000 },
      { "userId": "user4", "name": "Alice", "amount": 50000 }
    ],
    "totalAmount": 200000
  }
}
```

---

#### TC-P2-SPLIT-004: Calculate By-Item Split
| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Endpoint** | `POST /api/v1/bill-split/:sessionId/calculate` |
| **Preconditions** | Items assigned to participants |

**Request (beforehand):**
```json
// POST /:sessionId/assign-items
{
  "assignments": [
    { "itemId": "item1", "userIds": ["user1"] },
    { "itemId": "item2", "userIds": ["user2", "user3"] }
  ]
}
```

**Assertions:**
- [ ] Item1 cost fully to user1
- [ ] Item2 cost split between user2 and user3

---

#### TC-P2-SPLIT-005: Record Payment
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `POST /api/v1/bill-split/:sessionId/pay` |
| **Auth Required** | Yes |

**Request:**
```json
{
  "paymentId": "phapay-txn-123",
  "amount": 50000,
  "paymentMethod": "phapay"
}
```

**Assertions:**
- [ ] Participant marked as paid
- [ ] When all paid, session status = completed
- [ ] POS synced with split info

---

#### TC-P2-SPLIT-006: Leave Session Before Payment
| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Endpoint** | `POST /api/v1/bill-split/:sessionId/leave` |
| **Preconditions** | User has not paid yet |

**Assertions:**
- [ ] User removed from participants
- [ ] Shares recalculated
- [ ] Cannot leave if already paid

---

### 2.4 Reviews

#### TC-P2-REVIEW-001: Create Review
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `POST /api/v1/reviews` |
| **Auth Required** | Yes |

**Request:**
```json
{
  "storeId": "v1_store123",
  "star": 5,
  "comment": "Amazing food and service!",
  "images": ["https://...image1.jpg", "https://...image2.jpg"]
}
```

**Expected Response (201):**
```json
{
  "success": true,
  "data": {
    "review": {
      "_id": "review-id",
      "storeId": "v1_store123",
      "star": 5,
      "comment": "Amazing food and service!"
    },
    "loyaltyPoints": {
      "awarded": 50,
      "reason": "Review submitted",
      "newBalance": 550
    }
  }
}
```

**Assertions:**
- [ ] Review created
- [ ] 50 loyalty points awarded
- [ ] Store average rating updated

---

#### TC-P2-REVIEW-002: Get Store Reviews with Stats
| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Endpoint** | `GET /api/v1/reviews?storeId=v1_store123` |

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "reviews": [...],
    "stats": {
      "averageRating": 4.3,
      "totalReviews": 245,
      "distribution": {
        "5": 120,
        "4": 80,
        "3": 30,
        "2": 10,
        "1": 5
      }
    }
  }
}
```

---

## Phase 3: Retention Test Cases

### 3.1 Loyalty Program

#### TC-P3-LOYALTY-001: Get Loyalty Balance
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `GET /api/v1/loyalty/balance` |
| **Auth Required** | Yes |

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "balance": {
      "points": 2500,
      "tier": "silver",
      "tierProgress": 75,
      "pointsToNextTier": 500,
      "cashValue": 25000,
      "expiringPoints": {
        "amount": 200,
        "expiresAt": "2026-03-31T23:59:59Z"
      }
    }
  }
}
```

---

#### TC-P3-LOYALTY-002: Get Transaction History
| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Endpoint** | `GET /api/v1/loyalty/history?type=earn&limit=10` |

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "txn-1",
        "type": "earn",
        "source": "order",
        "points": 100,
        "description": "Order at Restaurant A",
        "createdAt": "2026-02-06T10:00:00Z"
      }
    ]
  }
}
```

---

#### TC-P3-LOYALTY-003: Redeem Points - Valid
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `POST /api/v1/loyalty/redeem` |
| **Preconditions** | User has 1000 points |

**Request:**
```json
{
  "points": 500,
  "orderId": "order-123",
  "orderTotal": 100000
}
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "redemption": {
      "pointsRedeemed": 500,
      "discountAmount": 5000,
      "newBalance": 500
    }
  }
}
```

---

#### TC-P3-LOYALTY-004: Redeem Points - Insufficient Balance
| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Endpoint** | `POST /api/v1/loyalty/redeem` |
| **Preconditions** | User has 100 points |

**Request:**
```json
{
  "points": 500,
  "orderId": "order-123"
}
```

**Expected Response (400):**
```json
{
  "error": {
    "code": "INSUFFICIENT_POINTS",
    "message": "Not enough points. You have 100 points.",
    "statusCode": 400
  }
}
```

---

### 3.2 Table Reservations

#### TC-P3-BOOKING-001: Check Availability
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `GET /api/v1/eats/bookings/availability?restaurantId=v2_rest456&date=2026-02-10&guests=4` |

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "availableSlots": [
      { "time": "11:00", "available": true, "tables": ["A1", "A2"] },
      { "time": "11:30", "available": true, "tables": ["A1"] },
      { "time": "12:00", "available": false, "tables": [] },
      { "time": "12:30", "available": true, "tables": ["B1"] }
    ]
  }
}
```

---

#### TC-P3-BOOKING-002: Create Reservation
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `POST /api/v1/eats/bookings` |
| **Auth Required** | Yes |

**Request:**
```json
{
  "restaurantId": "v2_rest456",
  "date": "2026-02-10",
  "time": "11:00",
  "guests": 4,
  "specialRequests": "Birthday celebration - can you prepare a cake?"
}
```

**Expected Response (201):**
```json
{
  "success": true,
  "data": {
    "reservation": {
      "_id": "reservation-id",
      "confirmationCode": "RES-ABC123",
      "restaurantId": "v2_rest456",
      "date": "2026-02-10",
      "time": "11:00",
      "guests": 4,
      "status": "confirmed",
      "tableAssigned": "A1"
    }
  }
}
```

**Assertions:**
- [ ] Reservation stored locally
- [ ] Synced to POS V2
- [ ] Table blocked for this time slot

---

#### TC-P3-BOOKING-003: Cancel Reservation
| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Endpoint** | `DELETE /api/v1/eats/bookings/:reservationId` |

**Assertions:**
- [ ] Reservation cancelled
- [ ] POS synced
- [ ] Table slot released

---

### 3.3 Push Notifications

#### TC-P3-NOTIF-001: Register FCM Token
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `POST /api/v1/notifications/fcm-token` |
| **Auth Required** | Yes |

**Request:**
```json
{
  "fcmToken": "firebase-cloud-messaging-token-here"
}
```

**Expected Response (200):**
```json
{
  "success": true,
  "message": "FCM token updated successfully"
}
```

**Assertions:**
- [ ] Token stored in user record
- [ ] Old token replaced

---

## Phase 4: Ecosystem Expansion Test Cases

### 4.1 Market

#### TC-P4-MARKET-001: Get Products
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `GET /api/v1/market/products?category=beverages&limit=20` |

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "product-123",
        "name": "Lao Coffee Beans 250g",
        "price": 45000,
        "wholesalePrice": 38000,
        "category": "beverages",
        "inStock": true,
        "images": [...]
      }
    ]
  }
}
```

---

#### TC-P4-MARKET-002: Checkout Market Order
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `POST /api/v1/market/checkout` |
| **Auth Required** | Yes |

**Request:**
```json
{
  "items": [
    { "productId": "product-123", "quantity": 2 }
  ],
  "deliveryAddressId": "address-id",
  "deliveryMethod": "standard",
  "paymentMethod": "phapay"
}
```

---

### 4.2 Live (Healthy Meals)

#### TC-P4-LIVE-001: Get Meal Plans
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Endpoint** | `GET /api/v1/live/meal-plans?healthGoals=weight_loss` |

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "mealPlans": [
      {
        "id": "plan-123",
        "name": "Keto Weight Loss",
        "description": "Low-carb high-fat meal plan",
        "duration": "7_days",
        "pricePerDay": 75000,
        "calories": 1500,
        "dietaryTags": ["keto", "gluten_free"]
      }
    ]
  }
}
```

---

#### TC-P4-LIVE-002: Create Meal Subscription
| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Endpoint** | `POST /api/v1/live/subscriptions` |
| **Auth Required** | Yes |

**Request:**
```json
{
  "mealPlanId": "plan-123",
  "deliveryAddressId": "address-id",
  "deliverySchedule": {
    "frequency": "daily",
    "timeSlot": "morning"
  },
  "paymentMethod": "phapay"
}
```

---

### 4.3 Identity Linking

#### TC-P4-ID-001: Link to Supplier System
| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Endpoint** | `POST /api/v1/identity/link-supplier` |
| **Auth Required** | Yes |

**Request:**
```json
{
  "linkCode": "MERCHANT-XYZ123",
  "businessInfo": {
    "businessName": "Coffee Shop ABC",
    "businessType": "restaurant"
  }
}
```

**Assertions:**
- [ ] User linked to Supplier system
- [ ] Merchant profile created
- [ ] B2B pricing unlocked

---

## Integration Test Scenarios

### INT-001: Full Web-to-App Conversion Flow

**Scenario:** User orders via web, downloads app, sees their order

**Steps:**
1. Create order via POS V1 web ordering
2. POS calls Consumer API to create deep link
3. User clicks link on mobile
4. App opens (or redirects to store)
5. User logs in with phone
6. Orders endpoint returns the web order

**Assertions:**
- [ ] Deep link created with order context
- [ ] Phone-based matching works
- [ ] Order visible in app

---

### INT-002: Multi-POS Restaurant Discovery

**Scenario:** User searches restaurants, sees both V1 and V2 restaurants

**Steps:**
1. Call `GET /api/v1/eats/restaurants`
2. Verify V1 restaurants have `v1_` prefix
3. Verify V2 restaurants have `v2_` prefix
4. Get restaurant details for each type

**Assertions:**
- [ ] Both POS versions represented
- [ ] Unified data format consistent
- [ ] Menu items properly transformed

---

### INT-003: Gift with POS Redemption

**Scenario:** User A sends gift, User B redeems at restaurant

**Steps:**
1. User A creates gift (POST /api/v1/gifts)
2. User A pays (payment webhook)
3. User A shares (POST /gifts/:id/share)
4. User B claims (POST /gifts/claim)
5. User B orders at restaurant
6. User B redeems gift (POST /gifts/redeem)

**Assertions:**
- [ ] Gift flows through all states
- [ ] Partial redemption works
- [ ] POS notified of redemption

---

### INT-004: Bill Split with Real-Time Updates

**Scenario:** 3 friends split a bill in real-time

**Steps:**
1. Host creates session
2. Host shares link
3. Friend 1 joins
4. Friend 2 joins
5. Host calculates shares
6. All confirm shares
7. Each pays their share
8. Session completes

**Assertions:**
- [ ] WebSocket updates work
- [ ] All participants see changes
- [ ] POS receives split payment info

---

## End-to-End Test Flows

### E2E-001: New User Journey

```
1. Open app for first time
2. Request OTP
3. Verify OTP (new user created)
4. Welcome bonus awarded
5. Browse restaurants
6. View menu
7. Add items to cart
8. Checkout
9. Pay
10. Rate & review
11. Earn loyalty points
```

**Expected Results:**
- 100 welcome bonus points
- 50 review points
- Order points based on amount
- Total points visible in balance

---

### E2E-002: Returning User from Web

```
1. Order via web (POS V1)
2. Click download banner
3. Open deep link
4. App opens spin-to-win
5. User spins and wins discount
6. User creates account with same phone
7. See previous web order
8. Use discount on next order
```

---

### E2E-003: Social Viral Loop

```
1. User A orders
2. User A sends gift to User B
3. User B claims gift
4. User B visits restaurant
5. User B uses gift
6. User B reviews restaurant
7. User B invites User C
8. User C joins via referral
```

---

## Performance & Load Testing

### Load Test Scenarios

#### LOAD-001: Peak Hours Simulation
| Metric | Target |
|--------|--------|
| **Concurrent Users** | 1,000 |
| **Requests/Second** | 500 |
| **Response Time (p95)** | < 500ms |
| **Error Rate** | < 0.1% |

**Test Script (k6):**
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up
    { duration: '5m', target: 500 },   // Peak
    { duration: '2m', target: 1000 },  // Spike
    { duration: '5m', target: 500 },   // Sustain
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get('https://api.appzap.la/api/v1/eats/restaurants');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
```

---

#### LOAD-002: Authentication Stress Test
| Endpoint | Target RPS |
|----------|------------|
| POST /auth/request-otp | 100 |
| POST /auth/verify-otp | 100 |

**Rate Limiter Verification:**
- Max 5 OTP requests per phone per minute
- Max 10 verification attempts per minute

---

## Test Data Requirements

### Test Users

| Phone | Name | Points | Tier | Notes |
|-------|------|--------|------|-------|
| +8562000000001 | Test User A | 0 | Bronze | New user |
| +8562000000002 | Test User B | 1000 | Silver | Has points |
| +8562000000003 | Test User C | 5000 | Gold | VIP user |
| +8562000000004 | Test Merchant | 0 | - | Linked to supplier |

### Test Restaurants

| ID | Name | POS Version | Features |
|----|------|-------------|----------|
| v1_test001 | Test Restaurant V1 | V1 | Basic menu |
| v2_test001 | Test Restaurant V2 | V2 | Full features |
| v2_test002 | Test Booking V2 | V2 | Table reservations |

### Test Products (Market)

| ID | Name | B2C Price | B2B Price |
|----|------|-----------|-----------|
| prod_001 | Test Coffee | 45000 | 38000 |
| prod_002 | Test Rice | 50000 | 42000 |

---

## Test Execution Checklist

### Pre-Deployment

- [ ] All P0 tests pass
- [ ] All P1 tests pass
- [ ] Integration tests pass
- [ ] Load tests meet targets
- [ ] Security scan clean

### Post-Deployment

- [ ] Smoke tests pass
- [ ] E2E flows work
- [ ] POS V1 integration works
- [ ] POS V2 integration works
- [ ] Real device testing complete

---

## Appendix: Test Environment URLs

| Environment | Base URL | Notes |
|-------------|----------|-------|
| Local | http://localhost:3000 | Development |
| Staging | https://staging-api.appzap.la | Pre-production |
| Production | https://api.appzap.la | Live |

---

*Document Version: 1.0*
*Last Updated: February 2026*
*Maintainer: Development Team*
