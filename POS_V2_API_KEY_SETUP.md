# 🔐 POS V2 API Key Setup Guide

## ✅ Good News: Your Code is 100% CORRECT!

The Consumer API is correctly using `X-API-Key` header authentication for POS V2 API.

**Current Implementation** (posV2Api.service.ts line 20):
```typescript
headers: {
  'X-API-Key': config.posV2Api.apiKey
}
```

This matches the POS V2 API documentation perfectly! ✅

---

## ❌ Why the Test is Failing

**Error**: `401 Unauthorized - Please authenticate - missing or invalid authorization header`

**Root Cause**: You need to create and configure a **System-Wide/Master API Key** for the Consumer API.

---

## 🎯 How to Fix (2 Steps)

### Step 1: Create a System-Wide API Key in POS V2

You need to create a **SYSTEM-WIDE/MASTER API KEY** (not a regular restaurant key).

**API Call:**
```bash
curl -X POST http://localhost:80/api/v1/api-keys \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Consumer API - System Master Key",
    "keyType": "system",
    "scopes": [
      "read:all-restaurants",
      "read:restaurant-details",
      "write:reservations",
      "consumer:search",
      "consumer:book"
    ],
    "environment": "production",
    "rateLimit": 10000,
    "expiresIn": null,
    "description": "Master key for Consumer API to access all restaurants"
  }'
```

**Required Scopes for Consumer API:**
- ✅ `read:all-restaurants` - List and search all restaurants
- ✅ `read:restaurant-details` - Get any restaurant's details
- ✅ `write:reservations` - Create/manage reservations
- ✅ `consumer:search` - Search restaurants for consumer apps
- ✅ `consumer:book` - Create bookings for consumers

**Response:**
```json
{
  "success": true,
  "data": {
    "apiKey": "appzap_pos_live_sk_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "maskedKey": "appzap_pos_live_sk_****cdef",
    "name": "Consumer API - System Master Key",
    "scopes": ["read:all-restaurants", "read:restaurant-details", "write:reservations"],
    "environment": "production",
    "warning": "⚠️ Save this API key securely. It will not be shown again!"
  }
}
```

**⚠️ CRITICAL**: Copy the `apiKey` value immediately! You cannot retrieve it later!

---

### Step 2: Add API Key to `.env` File

Add the API key to your Consumer API `.env` file:

```bash
# POS V2 API Configuration
POS_V2_API_URL=http://localhost:80
POS_V2_API_KEY=appzap_pos_live_sk_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

**API Key Format:**
- Production: `appzap_pos_live_sk_{64_chars}`
- Testing: `appzap_pos_test_sk_{64_chars}`

---

## 🧪 Test Your API Key

After adding to `.env`, test it manually:

```bash
curl -X GET http://localhost:80/api/v1/restaurants \
  -H "X-API-Key: appzap_pos_live_sk_your_actual_key_here"
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "rest_001",
      "name": "Kong View Restaurant",
      ...
    }
  ]
}
```

**If you get 401**: Your API key is invalid or hasn't been approved yet.

---

## 🔒 Security Notes

### Key Types:
1. **Restaurant Keys** (`keyType: "restaurant"`)
   - Single restaurant access only
   - Created by restaurant owners
   - ❌ NOT suitable for Consumer API

2. **System Keys** (`keyType: "system"`) ✅
   - Access ALL restaurants system-wide
   - Created by super admins only
   - ✅ REQUIRED for Consumer API

### System Key Requirements:
- ✅ Super Admin JWT required to create
- ⚠️ May require approval before activation
- ✅ All actions are logged (audit trail)
- ✅ Rate limit: Max 50,000 requests/hour
- ✅ Can be permanent (no expiry)

---

## 📋 Troubleshooting

### Problem: "401 Unauthorized"
**Solutions:**
1. Check if API key is in `.env` file
2. Verify key starts with `appzap_pos_live_sk_` or `appzap_pos_test_sk_`
3. Ensure key has system-wide scopes (not restaurant-level)
4. Check if key requires approval (pending status)

### Problem: "403 Forbidden"
**Solution:** API key doesn't have required scopes. Recreate with proper scopes.

### Problem: "429 Too Many Requests"
**Solution:** You've exceeded rate limit. Wait or request higher limit.

---

## 🎉 After Setup

Once you add the API key, restart your Consumer API and run tests:

```bash
npm test
```

The POS V2 restaurants test should now pass! ✅

---

## 📝 Alternative: Use Existing API Key

If you already have a system-wide API key, just add it to `.env`:

```bash
POS_V2_API_KEY=appzap_pos_live_sk_your_existing_key
```

---

## 🔗 Related Files

- **Service**: `src/services/posV2Api.service.ts` (line 20)
- **Config**: `src/config/env.ts` (line 122-123)
- **Test**: `src/__tests__/api.test.ts` (line 147)

---

## 💡 Summary

**What you need:**
1. A **System-Wide API Key** (not a restaurant key)
2. With scopes: `read:all-restaurants`, `read:restaurant-details`, `write:reservations`
3. Added to `.env` as `POS_V2_API_KEY=appzap_pos_live_sk_...`

**Your code is already correct!** Just need to configure the API key. 🎯

