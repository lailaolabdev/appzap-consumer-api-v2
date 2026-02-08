# AppZap Consumer API V2 - Mobile App Integration Guide

## Overview

This document provides complete API documentation for mobile app integration with AppZap Consumer API V2.

**Base URL (Development):** `http://localhost:9000/api/v1`  
**Base URL (Production):** `https://api.appzap.la/api/v1`

**Authentication:** Bearer Token (JWT)
```
Authorization: Bearer <access_token>
```

---

## Table of Contents

1. [Phase 1: Core Features (Launch)](#phase-1-core-features-launch)
   - [Authentication](#11-authentication)
   - [Restaurant Discovery](#12-restaurant-discovery)
   - [Cart Management](#13-cart-management)
   - [Checkout & Orders](#14-checkout--orders)
   - [Reviews & Ratings](#15-reviews--ratings)
   - [Deep Links](#16-deep-links)
   - [Spin to Win](#17-spin-to-win)

2. [Phase 2: Viral Growth](#phase-2-viral-growth)
   - [Social Gifting](#21-social-gifting)
   - [Bill Splitting](#22-bill-splitting)

3. [Phase 3: Retention](#phase-3-retention)
   - [Loyalty Program](#31-loyalty-program)
   - [Table Reservations](#32-table-reservations)
   - [Push Notifications](#33-push-notifications)

4. [Phase 4: Ecosystem Expansion](#phase-4-ecosystem-expansion)
   - [Market (B2C Products)](#41-market-b2c-products)
   - [Market Subscriptions](#42-market-subscriptions)
   - [Live (Health & Wellness)](#43-live-health--wellness)
   - [Identity Linking (B2B)](#44-identity-linking-b2b)

5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)

---

# Phase 1: Core Features (Launch)

## 1.1 Authentication

### Request OTP
```http
POST /api/v1/auth/request-otp
```

**Access:** Public

**Request Body:**
```json
{
  "phone": "8562055551234"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "expiresIn": 300
}
```

**Notes:**
- Phone format: `856XXXXXXXXX` (Lao number with country code, no `+`)
- OTP expires in 5 minutes
- Rate limited: 3 requests per minute

---

### Verify OTP & Login
```http
POST /api/v1/auth/verify-otp
```

**Access:** Public

**Request Body:**
```json
{
  "phone": "8562055551234",
  "otp": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "_id": "user_123",
    "phone": "8562055551234",
    "name": "John Doe",
    "email": "john@example.com",
    "loyaltyPoints": 1500,
    "tier": "silver"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 3600
  }
}
```

---

### Refresh Token
```http
POST /api/v1/auth/refresh
```

**Access:** Public

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600
}
```

---

### Get Current User
```http
GET /api/v1/auth/me
```

**Access:** Private (requires auth)

**Response (200):**
```json
{
  "user": {
    "_id": "user_123",
    "phone": "8562055551234",
    "name": "John Doe",
    "email": "john@example.com",
    "avatar": "https://...",
    "loyaltyPoints": 1500,
    "tier": "silver",
    "activeProfile": "personal"
  }
}
```

---

### Switch Profile
```http
POST /api/v1/auth/switch-profile
```

**Access:** Private

**Request Body:**
```json
{
  "targetProfile": "merchant"
}
```

**Response (200):**
```json
{
  "success": true,
  "activeProfile": "merchant"
}
```

---

### Logout
```http
POST /api/v1/auth/logout
```

**Access:** Private

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 1.2 Restaurant Discovery

### Get Restaurants
```http
GET /api/v1/eats/restaurants
```

**Access:** Public (optional auth for personalization)

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `mode` | string | `eats` or `live` (default: `eats`) |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |
| `search` | string | Search by name |
| `cuisine` | string | Filter by cuisine type |
| `latitude` | number | User's latitude (for distance) |
| `longitude` | number | User's longitude (for distance) |
| `radius` | number | Search radius in km (default: 5) |
| `isReservable` | boolean | Filter reservable restaurants |

**Response (200):**
```json
{
  "data": [
    {
      "_id": "v2_abc123",
      "posVersion": "v2",
      "posRestaurantId": "abc123",
      "name": "Coffee Prison",
      "nameEn": "Coffee Prison",
      "description": "Best coffee in town",
      "phone": "02055551234",
      "address": {
        "street": "123 Main St",
        "district": "Chanthabouly",
        "province": "Vientiane",
        "country": "laos",
        "latitude": 17.9757,
        "longitude": 102.6331
      },
      "image": "https://...",
      "coverImage": "https://...",
      "isOpen": true,
      "isActive": true,
      "isReservable": true,
      "rating": 4.5,
      "reviewCount": 128,
      "cuisine": ["coffee", "bakery"],
      "distanceKm": 1.2
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  },
  "mode": "eats",
  "sources": {
    "posV1": 100,
    "posV2": 50
  }
}
```

**Notes:**
- `_id` is prefixed with `v1_` or `v2_` to indicate source POS system
- Use `posVersion` to determine which POS system the restaurant belongs to

---

### Get Restaurant Details
```http
GET /api/v1/eats/restaurants/:restaurantId
```

**Access:** Public

**Response (200):**
```json
{
  "restaurant": {
    "_id": "v2_abc123",
    "name": "Coffee Prison",
    "description": "Best coffee in town",
    "address": {...},
    "phone": "02055551234",
    "businessHours": {
      "monday": { "open": "08:00", "close": "22:00" },
      "tuesday": { "open": "08:00", "close": "22:00" }
    },
    "rating": 4.5,
    "reviewCount": 128
  },
  "menu": {
    "categories": [
      {
        "id": "cat_1",
        "name": "Coffee",
        "nameEn": "Coffee",
        "items": [
          {
            "id": "item_1",
            "name": "Americano",
            "price": 25000,
            "description": "Classic black coffee",
            "image": "https://..."
          }
        ]
      }
    ]
  }
}
```

---

## 1.3 Cart Management

### Create Cart
```http
POST /api/v1/eats/cart
```

**Access:** Private

**Request Body:**
```json
{
  "restaurantId": "v2_abc123",
  "orderType": "dine_in",
  "tableId": "table_5"
}
```

**Response (201):**
```json
{
  "cart": {
    "_id": "cart_xyz",
    "restaurantId": "v2_abc123",
    "orderType": "dine_in",
    "tableId": "table_5",
    "items": [],
    "subtotal": 0,
    "tax": 0,
    "total": 0,
    "createdAt": "2026-02-08T12:00:00Z",
    "expiresAt": "2026-02-08T14:00:00Z"
  }
}
```

---

### Add Item to Cart
```http
POST /api/v1/eats/cart/:cartId/items
```

**Access:** Private

**Request Body:**
```json
{
  "menuItemId": "item_1",
  "name": "Americano",
  "price": 25000,
  "quantity": 2,
  "modifiers": [
    { "name": "Extra shot", "price": 5000 }
  ],
  "specialInstructions": "No sugar"
}
```

**Response (200):**
```json
{
  "cart": {
    "_id": "cart_xyz",
    "items": [
      {
        "_id": "cartitem_1",
        "menuItemId": "item_1",
        "name": "Americano",
        "price": 25000,
        "quantity": 2,
        "modifiers": [...],
        "itemTotal": 60000
      }
    ],
    "subtotal": 60000,
    "tax": 6000,
    "total": 66000
  }
}
```

---

### Update Cart Item
```http
PUT /api/v1/eats/cart/:cartId/items/:itemId
```

**Access:** Private

**Request Body:**
```json
{
  "quantity": 3
}
```

---

### Remove Cart Item
```http
DELETE /api/v1/eats/cart/:cartId/items/:itemId
```

**Access:** Private

---

## 1.4 Checkout & Orders

### Checkout Cart
```http
POST /api/v1/eats/cart/:cartId/checkout
```

**Access:** Private

**Request Body:**
```json
{
  "paymentMethod": "cash",
  "tipAmount": 5000,
  "pointsToRedeem": 100,
  "customerInfo": {
    "name": "John Doe",
    "phone": "8562055551234"
  }
}
```

**Response (201):**
```json
{
  "order": {
    "_id": "order_abc123",
    "orderCode": "A1B2C3",
    "status": "pending",
    "items": [...],
    "subtotal": 60000,
    "tax": 6000,
    "tip": 5000,
    "pointsDiscount": 5000,
    "total": 66000,
    "paymentMethod": "cash",
    "paymentStatus": "pending",
    "restaurantId": "v2_abc123",
    "restaurantName": "Coffee Prison",
    "createdAt": "2026-02-08T12:30:00Z"
  },
  "loyaltyPointsEarned": 66
}
```

---

### Get User Orders
```http
GET /api/v1/eats/orders
```

**Access:** Private

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status |
| `limit` | number | Items per page (default: 20) |
| `skip` | number | Pagination offset |

**Response (200):**
```json
{
  "orders": [
    {
      "_id": "order_abc123",
      "orderCode": "A1B2C3",
      "status": "completed",
      "total": 66000,
      "restaurantName": "Coffee Prison",
      "createdAt": "2026-02-08T12:30:00Z",
      "posVersion": "v2"
    }
  ],
  "pagination": {
    "total": 50,
    "limit": 20,
    "skip": 0
  }
}
```

---

### Get Order Details
```http
GET /api/v1/eats/orders/:orderId
```

**Access:** Private

---

## 1.5 Reviews & Ratings

### Get Store Reviews
```http
GET /api/v1/reviews
```

**Access:** Public

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `storeId` | string | Yes | Restaurant ID |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 10) |

**Response (200):**
```json
{
  "reviews": [
    {
      "_id": "review_123",
      "userId": "user_456",
      "userName": "John D.",
      "userAvatar": "https://...",
      "star": 5,
      "comment": "Great coffee!",
      "images": ["https://..."],
      "createdAt": "2026-02-07T10:00:00Z"
    }
  ],
  "stats": {
    "averageRating": 4.5,
    "totalReviews": 128,
    "starCounts": {
      "5": 80,
      "4": 30,
      "3": 10,
      "2": 5,
      "1": 3
    }
  },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 128
  }
}
```

---

### Get Store Review Stats
```http
GET /api/v1/reviews/stats/:storeId
```

**Access:** Public

---

### Create Review
```http
POST /api/v1/reviews
```

**Access:** Private

**Request Body:**
```json
{
  "storeId": "v2_abc123",
  "star": 5,
  "comment": "Amazing coffee and service!",
  "images": ["https://..."]
}
```

**Response (201):**
```json
{
  "review": {
    "_id": "review_789",
    "star": 5,
    "comment": "Amazing coffee and service!",
    "createdAt": "2026-02-08T14:00:00Z"
  },
  "pointsEarned": 50,
  "message": "Thank you! You earned 50 ZapPoints!"
}
```

**Notes:**
- Users earn loyalty points for writing reviews

---

### Get My Reviews
```http
GET /api/v1/reviews/my-reviews
```

**Access:** Private

---

### Update Review
```http
PUT /api/v1/reviews/:id
```

**Access:** Private (owner only)

---

### Delete Review
```http
DELETE /api/v1/reviews/:id
```

**Access:** Private (owner only)

---

## 1.6 Deep Links

### Create Deep Link
```http
POST /api/v1/deep-links
```

**Access:** Private

**Request Body:**
```json
{
  "targetType": "order",
  "targetId": "order_abc123",
  "campaignName": "web_to_app_conversion",
  "source": "web_ordering",
  "medium": "qr_code",
  "metadata": {
    "phone": "8562055551234",
    "restaurantId": "v2_abc123",
    "orderAmount": 66000
  },
  "expiresInDays": 30
}
```

**Response (201):**
```json
{
  "deepLink": {
    "shortCode": "abc123",
    "shortUrl": "https://app.appzap.la/links/abc123",
    "firebaseDynamicLink": "https://appzap.page.link/abc123",
    "metadata": {
      "rewardId": "reward_xyz"
    }
  }
}
```

---

### Track Deep Link Open
```http
POST /api/v1/deep-links/:shortCode/track-open
```

**Access:** Public

---

### Track Deep Link Conversion
```http
POST /api/v1/deep-links/:shortCode/track-conversion
```

**Access:** Public

---

## 1.7 Spin to Win

### Execute Spin
```http
POST /api/v1/deep-links/spin-to-win/:rewardId/spin
```

**Access:** Private

**Response (200):**
```json
{
  "result": {
    "won": true,
    "prize": {
      "type": "discount",
      "value": 10000,
      "description": "₭10,000 off your next order",
      "expiresAt": "2026-03-08T00:00:00Z"
    }
  }
}
```

---

### Get User Rewards
```http
GET /api/v1/deep-links/spin-to-win/rewards
```

**Access:** Private

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `includeExpired` | boolean | Include expired rewards |

---

### Redeem Reward
```http
POST /api/v1/deep-links/spin-to-win/:rewardId/redeem
```

**Access:** Private

**Request Body:**
```json
{
  "orderId": "order_abc123"
}
```

---

# Phase 2: Viral Growth

## 2.1 Social Gifting

### Get Gift Templates
```http
GET /api/v1/gifts/templates
```

**Access:** Public

**Response (200):**
```json
{
  "templates": [
    {
      "id": "template_coffee",
      "type": "digital_coffee",
      "name": "Digital Coffee",
      "description": "Send a coffee to a friend",
      "amounts": [25000, 35000, 50000],
      "image": "https://..."
    },
    {
      "id": "template_meal",
      "type": "meal_voucher",
      "name": "Meal Voucher",
      "description": "Treat someone to a meal",
      "amounts": [50000, 100000, 200000],
      "image": "https://..."
    }
  ]
}
```

---

### Get Gift by Code
```http
GET /api/v1/gifts/code/:code
```

**Access:** Public

**Response (200):**
```json
{
  "gift": {
    "code": "GIFT-ABC123",
    "type": "digital_coffee",
    "amount": 35000,
    "senderName": "John D.",
    "message": "Enjoy your coffee! ☕",
    "status": "active",
    "expiresAt": "2026-03-08T00:00:00Z"
  }
}
```

---

### Create/Purchase Gift
```http
POST /api/v1/gifts
```

**Access:** Private

**Request Body:**
```json
{
  "type": "digital_coffee",
  "templateId": "template_coffee",
  "amount": 35000,
  "recipientPhone": "8562055559999",
  "recipientName": "Jane",
  "message": "Happy Birthday! 🎂",
  "paymentMethod": "wallet"
}
```

**Response (201):**
```json
{
  "gift": {
    "_id": "gift_xyz",
    "code": "GIFT-XYZ789",
    "amount": 35000,
    "status": "pending_payment",
    "shareUrl": "https://app.appzap.la/gift/GIFT-XYZ789"
  },
  "payment": {
    "amount": 35000,
    "status": "pending"
  }
}
```

---

### Claim Gift
```http
POST /api/v1/gifts/claim
```

**Access:** Private

**Request Body:**
```json
{
  "giftCode": "GIFT-XYZ789"
}
```

---

### Redeem Gift at Restaurant
```http
POST /api/v1/gifts/redeem
```

**Access:** Private

**Request Body:**
```json
{
  "giftCode": "GIFT-XYZ789",
  "restaurantId": "v2_abc123",
  "orderId": "order_def456",
  "amount": 35000
}
```

---

### Get Sent Gifts
```http
GET /api/v1/gifts/sent
```

**Access:** Private

---

### Get Received Gifts
```http
GET /api/v1/gifts/received
```

**Access:** Private

---

### Share Gift
```http
POST /api/v1/gifts/:giftId/share
```

**Access:** Private

**Request Body:**
```json
{
  "channel": "whatsapp",
  "recipientPhone": "8562055559999"
}
```

---

## 2.2 Bill Splitting

### Get Session by Code (Preview)
```http
GET /api/v1/bill-split/code/:code
```

**Access:** Public

**Response (200):**
```json
{
  "session": {
    "code": "SPLIT-ABC123",
    "hostName": "John D.",
    "restaurantName": "Coffee Prison",
    "totalAmount": 200000,
    "participantCount": 2,
    "maxParticipants": 6,
    "status": "active"
  }
}
```

---

### Create Split Session
```http
POST /api/v1/bill-split
```

**Access:** Private

**Request Body:**
```json
{
  "orderId": "order_abc123",
  "splitMethod": "equal",
  "maxParticipants": 4
}
```

**Response (201):**
```json
{
  "session": {
    "_id": "session_xyz",
    "code": "SPLIT-XYZ789",
    "orderId": "order_abc123",
    "totalAmount": 200000,
    "splitMethod": "equal",
    "participants": [
      {
        "userId": "user_123",
        "name": "John D.",
        "isHost": true,
        "shareAmount": 50000,
        "status": "confirmed"
      }
    ],
    "shareUrl": "https://app.appzap.la/split/SPLIT-XYZ789"
  }
}
```

**Split Methods:**
- `equal` - Split evenly among participants
- `by_items` - Each person pays for their items
- `percentage` - Custom percentage per person
- `custom` - Host sets custom amounts

---

### Join Split Session
```http
POST /api/v1/bill-split/join
```

**Access:** Private

**Request Body:**
```json
{
  "sessionCode": "SPLIT-XYZ789"
}
```

---

### Get Active Sessions
```http
GET /api/v1/bill-split/active
```

**Access:** Private

---

### Get Session Details
```http
GET /api/v1/bill-split/:sessionId
```

**Access:** Private (participants only)

---

### Assign Items (by_items method)
```http
POST /api/v1/bill-split/:sessionId/assign-items
```

**Access:** Private

**Request Body:**
```json
{
  "assignments": [
    { "itemId": "item_1", "userIds": ["user_123", "user_456"] },
    { "itemId": "item_2", "userIds": ["user_789"] }
  ]
}
```

---

### Calculate Shares
```http
POST /api/v1/bill-split/:sessionId/calculate
```

**Access:** Private (host only)

---

### Confirm My Share
```http
POST /api/v1/bill-split/:sessionId/confirm
```

**Access:** Private

---

### Pay My Share
```http
POST /api/v1/bill-split/:sessionId/pay
```

**Access:** Private

**Request Body:**
```json
{
  "paymentId": "payment_abc123",
  "amount": 50000,
  "paymentMethod": "wallet"
}
```

---

### Leave Session
```http
POST /api/v1/bill-split/:sessionId/leave
```

**Access:** Private

---

# Phase 3: Retention

## 3.1 Loyalty Program

### Get Loyalty Tiers
```http
GET /api/v1/loyalty/tiers
```

**Access:** Public

**Response (200):**
```json
{
  "tiers": [
    {
      "name": "Bronze",
      "minPoints": 0,
      "multiplier": 1,
      "benefits": ["1 point per ₭1,000 spent"]
    },
    {
      "name": "Silver",
      "minPoints": 2000,
      "multiplier": 1.5,
      "benefits": ["1.5x points", "Birthday bonus"]
    },
    {
      "name": "Gold",
      "minPoints": 5000,
      "multiplier": 2,
      "benefits": ["2x points", "Priority support"]
    },
    {
      "name": "Platinum",
      "minPoints": 10000,
      "multiplier": 3,
      "benefits": ["3x points", "VIP access", "Free delivery"]
    }
  ],
  "currentTier": "Silver",
  "currentPoints": 2500,
  "pointsToNextTier": 2500
}
```

---

### Get Earning Opportunities
```http
GET /api/v1/loyalty/earn
```

**Access:** Public

**Response (200):**
```json
{
  "opportunities": [
    { "action": "Order food", "points": "1 per ₭1,000" },
    { "action": "Write review", "points": 50 },
    { "action": "Refer friend", "points": 500 },
    { "action": "Claim gift", "points": 100 }
  ]
}
```

---

### Get Loyalty Balance
```http
GET /api/v1/loyalty/balance
```

**Access:** Private

**Response (200):**
```json
{
  "balance": {
    "points": 2500,
    "tier": "Silver",
    "tierMultiplier": 1.5,
    "lifetimePoints": 5000,
    "pointsValue": 125000,
    "pointsExpiringSoon": {
      "amount": 500,
      "expiresAt": "2026-03-01T00:00:00Z"
    }
  }
}
```

**Notes:**
- Points value: 10 points = ₭500 (configurable)

---

### Get Loyalty History
```http
GET /api/v1/loyalty/history
```

**Access:** Private

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | `earn`, `redeem`, `expire` |
| `limit` | number | Items per page (default: 20) |
| `skip` | number | Pagination offset |
| `startDate` | string | Filter from date |
| `endDate` | string | Filter to date |

---

### Preview Redemption
```http
POST /api/v1/loyalty/preview-redemption
```

**Access:** Private

**Request Body:**
```json
{
  "points": 100,
  "orderTotal": 100000
}
```

**Response (200):**
```json
{
  "preview": {
    "pointsToRedeem": 100,
    "discountAmount": 5000,
    "remainingTotal": 95000,
    "remainingPoints": 2400
  }
}
```

---

### Redeem Points
```http
POST /api/v1/loyalty/redeem
```

**Access:** Private

**Request Body:**
```json
{
  "points": 100,
  "orderId": "order_abc123",
  "orderTotal": 100000
}
```

---

## 3.2 Table Reservations

### Get Table Availability
```http
GET /api/v1/eats/bookings/availability
```

**Access:** Public

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `restaurantId` | string | Yes | Restaurant ID |
| `date` | string | Yes | Date (YYYY-MM-DD) |
| `guests` | number | Yes | Number of guests |

**Response (200):**
```json
{
  "availability": {
    "date": "2026-02-10",
    "restaurantId": "v2_abc123",
    "timeSlots": [
      { "time": "11:00", "available": true, "tables": 3 },
      { "time": "11:30", "available": true, "tables": 2 },
      { "time": "12:00", "available": false, "tables": 0 },
      { "time": "12:30", "available": true, "tables": 1 }
    ]
  }
}
```

---

### Create Reservation
```http
POST /api/v1/eats/bookings
```

**Access:** Private

**Request Body:**
```json
{
  "restaurantId": "v2_abc123",
  "date": "2026-02-10",
  "time": "12:30",
  "guests": 4,
  "customerName": "John Doe",
  "customerPhone": "8562055551234",
  "specialRequests": "Window seat please"
}
```

**Response (201):**
```json
{
  "reservation": {
    "_id": "reservation_xyz",
    "confirmationCode": "RES-ABC123",
    "restaurantId": "v2_abc123",
    "restaurantName": "Coffee Prison",
    "date": "2026-02-10",
    "time": "12:30",
    "guests": 4,
    "status": "confirmed",
    "tableNumber": "T5"
  }
}
```

---

### Get User Reservations
```http
GET /api/v1/eats/bookings
```

**Access:** Private

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | `upcoming`, `past`, `cancelled` |
| `limit` | number | Items per page |
| `skip` | number | Pagination offset |

---

### Get Reservation Details
```http
GET /api/v1/eats/bookings/:reservationId
```

**Access:** Private

---

### Update Reservation
```http
PUT /api/v1/eats/bookings/:reservationId
```

**Access:** Private

**Request Body:**
```json
{
  "date": "2026-02-11",
  "time": "13:00",
  "guests": 5
}
```

---

### Cancel Reservation
```http
DELETE /api/v1/eats/bookings/:reservationId
```

**Access:** Private

---

## 3.3 Push Notifications

### Update FCM Token
```http
POST /api/v1/notifications/fcm-token
```

**Access:** Private

**Request Body:**
```json
{
  "fcmToken": "dGVzdC1mY20tdG9rZW4..."
}
```

---

### Remove FCM Token
```http
DELETE /api/v1/notifications/fcm-token
```

**Access:** Private

---

# Phase 4: Ecosystem Expansion

## 4.1 Market (B2C Products)

### Get Products
```http
GET /api/v1/market/products
```

**Access:** Public (optional auth for personalized pricing)

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number |
| `limit` | number | Items per page |
| `category` | string | Filter by category |
| `search` | string | Search by name |

---

### Get Product Details
```http
GET /api/v1/market/products/:productId
```

**Access:** Public

---

### Get Categories
```http
GET /api/v1/market/categories
```

**Access:** Public

---

### Calculate Cart
```http
POST /api/v1/market/cart/calculate
```

**Access:** Private

**Request Body:**
```json
{
  "items": [
    { "productId": "prod_123", "quantity": 2 },
    { "productId": "prod_456", "quantity": 1 }
  ],
  "deliveryAddressId": "addr_xyz"
}
```

---

### Checkout
```http
POST /api/v1/market/checkout
```

**Access:** Private

**Request Body:**
```json
{
  "items": [
    { "productId": "prod_123", "quantity": 2 }
  ],
  "deliveryAddressId": "addr_xyz",
  "deliveryMethod": "express",
  "paymentMethod": "cod",
  "pointsToRedeem": 50,
  "notes": "Leave at door"
}
```

---

### Get Orders
```http
GET /api/v1/market/orders
```

**Access:** Private

---

### Cancel Order
```http
POST /api/v1/market/orders/:orderId/cancel
```

**Access:** Private

---

## 4.2 Market Subscriptions

### Create Subscription
```http
POST /api/v1/market/subscriptions
```

**Access:** Private

**Request Body:**
```json
{
  "items": [
    { "productId": "prod_coffee", "quantity": 2 }
  ],
  "deliveryAddressId": "addr_xyz",
  "deliverySchedule": {
    "frequency": "weekly",
    "dayOfWeek": "monday",
    "timeSlot": "morning"
  },
  "paymentMethod": "auto_charge",
  "autoPayment": true
}
```

---

### Get Subscriptions
```http
GET /api/v1/market/subscriptions
```

**Access:** Private

---

### Pause Subscription
```http
POST /api/v1/market/subscriptions/:subscriptionId/pause
```

**Access:** Private

---

### Resume Subscription
```http
POST /api/v1/market/subscriptions/:subscriptionId/resume
```

**Access:** Private

---

### Cancel Subscription
```http
POST /api/v1/market/subscriptions/:subscriptionId/cancel
```

**Access:** Private

---

## 4.3 Live (Health & Wellness)

### Get Health Profile
```http
GET /api/v1/live/health-profile
```

**Access:** Private

---

### Update Health Profile
```http
PUT /api/v1/live/health-profile
```

**Access:** Private

**Request Body:**
```json
{
  "age": 30,
  "gender": "male",
  "height": 175,
  "weight": 70,
  "targetWeight": 68,
  "dietaryRestrictions": ["vegetarian"],
  "allergies": ["peanuts"],
  "healthGoals": ["weight_loss", "muscle_gain"],
  "activityLevel": "moderate"
}
```

---

### Get Meal Plans
```http
GET /api/v1/live/meal-plans
```

**Access:** Public

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `dietaryTags` | string | Filter by dietary tags |
| `healthGoals` | string | Filter by health goals |
| `minPrice` | number | Minimum price |
| `maxPrice` | number | Maximum price |

---

### Get Supplements
```http
GET /api/v1/live/supplements
```

**Access:** Public

---

### Create Meal Subscription
```http
POST /api/v1/live/subscriptions
```

**Access:** Private

---

## 4.4 Identity Linking (B2B)

### Link to Supplier System
```http
POST /api/v1/identity/link-supplier
```

**Access:** Private

**Request Body:**
```json
{
  "linkCode": "MERCHANT-ABC123",
  "businessInfo": {
    "businessName": "My Restaurant",
    "businessType": "restaurant"
  }
}
```

---

### Verify Restaurant Code
```http
POST /api/v1/identity/verify-restaurant-code
```

**Access:** Private

**Request Body:**
```json
{
  "linkCode": "REST-XYZ789"
}
```

---

### Get Profile Context
```http
GET /api/v1/identity/profile-context
```

**Access:** Private

**Response (200):**
```json
{
  "activeProfile": "personal",
  "profiles": {
    "personal": {
      "name": "John Doe",
      "phone": "8562055551234"
    },
    "merchant": {
      "businessName": "My Restaurant",
      "linkedAt": "2026-01-15T00:00:00Z"
    }
  }
}
```

---

### Switch Profile
```http
POST /api/v1/identity/switch-profile
```

**Access:** Private

**Request Body:**
```json
{
  "targetProfile": "merchant"
}
```

---

## 4.5 Delivery Addresses

### Get Addresses
```http
GET /api/v1/market/addresses
```

**Access:** Private

---

### Create Address
```http
POST /api/v1/market/addresses
```

**Access:** Private

**Request Body:**
```json
{
  "label": "Home",
  "recipientName": "John Doe",
  "phone": "8562055551234",
  "addressLine1": "123 Main Street",
  "district": "Chanthabouly",
  "city": "Vientiane",
  "province": "Vientiane",
  "postalCode": "01000",
  "latitude": 17.9757,
  "longitude": 102.6331,
  "isDefault": true
}
```

---

### Update Address
```http
PUT /api/v1/market/addresses/:addressId
```

**Access:** Private

---

### Delete Address
```http
DELETE /api/v1/market/addresses/:addressId
```

**Access:** Private

---

### Set Default Address
```http
POST /api/v1/market/addresses/:addressId/set-default
```

**Access:** Private

---

# Error Handling

All API errors follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "statusCode": 400
  }
}
```

**Common Error Codes:**

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

# Rate Limiting

| Endpoint Category | Limit |
|-------------------|-------|
| OTP Request | 3 per minute |
| OTP Verify | 5 per minute |
| Payment/Checkout | 10 per minute |
| General API | 100 per minute |

When rate limited, response includes:
```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests",
    "retryAfter": 60
  }
}
```

---

# WebSocket Events

**Connection:**
```javascript
const socket = io('wss://api.appzap.la', {
  auth: { token: 'Bearer <access_token>' }
});
```

**Events:**

| Event | Direction | Description |
|-------|-----------|-------------|
| `order:status` | Server → Client | Order status update |
| `split:update` | Server → Client | Bill split update |
| `split:payment` | Server → Client | Participant paid |
| `notification` | Server → Client | Push notification |

---

# Quick Reference

## Authentication Header
```
Authorization: Bearer <access_token>
```

## Restaurant ID Format
- POS V1: `v1_<mongodb_id>`
- POS V2: `v2_<mongodb_id>`

## Phone Number Format
- Lao number with country code: `856XXXXXXXXX`
- No `+` prefix

## Currency
- All amounts in LAK (Lao Kip)
- Integer values (no decimals)

## Dates
- ISO 8601 format: `2026-02-08T12:30:00Z`
- Date only: `2026-02-08`
- Time only: `12:30`

---

*Document Version: 1.0*  
*Last Updated: February 8, 2026*  
*API Version: v1*
