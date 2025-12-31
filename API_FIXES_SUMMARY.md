# API Integration Fixes Summary

## ✅ Fixed Issues

### 1. POS V2 API Endpoints ✅
**Changed:**
- ❌ Old: `/api/stores`
- ✅ New: `/api/v1/restaurants`

**Files Modified:**
- `src/services/posV2Api.service.ts` (lines 92, 124)

### 2. Auth API - Request OTP ✅
**Changed:**
- Updated GraphQL mutation from `CreateOtpProviderInput` to `OtpInput`
- Changed variable key from `phoneNumber` to `phone`
- Added `success: true` to controller response

**Files Modified:**
- `src/services/authApi.service.ts` (REQUEST_OTP_MUTATION)
- `src/controllers/auth.controller.ts` (line 45)

### 3. Supplier API (Ingredients API) Endpoints ✅
**Changed:**
- ❌ Old: `/api/products`
- ✅ New: `/mobile/product/get/skip/{skip}/limit/{limit}`
- ❌ Old: `/api/products/categories`
- ✅ New: `/v6/supplier-categories`

**Files Modified:**
- `src/services/supplierApi.service.ts` (getProducts, getProductCategories)

---

## ❌ Remaining Issues (Action Required)

### ~~1. Auth API - PhoneLogin Mutation~~ ✅ FIXED
**This issue has been resolved!** Updated to use the correct `verifyOtp` mutation as shown in Postman.

### 1. Auth API - Verify OTP Mutation ✅ FIXED

**Problem:**
Documentation showed `phoneLogin` mutation, but the actual API uses `verifyOtp` mutation with a different structure.

**Documentation was wrong - it showed:**
```graphql
mutation PhoneLogin($where: PhoneLoginInput!) {
  phoneLogin(where: $where) {
    accessToken
    refreshToken
    data { ... }
  }
}
```

**Actual API (from Postman):**
```graphql
mutation VerifyOtp($data: VerifyOtpInput!, $where: VerifyOtpWhereInput!) {
  verifyOtp(data: $data, where: $where) {
    message
  }
}

Variables: {
  "data": { "code": "123456" },
  "where": { "phone": "8562099999999" }
}
```

**Fix Applied:**
- Updated mutation to use `verifyOtp` instead of `phoneLogin`
- OTP is sent in `$data.code` (not `$where.otp`)
- Phone is sent in `$where.phone`
- Auth API only returns a message, Consumer API generates its own JWT tokens

**Files Updated:** `src/services/authApi.service.ts`

---

### 1. POS V2 API - Missing API Key 🔴

**Problem:**
POS API returns `401 Unauthorized: Please authenticate - missing or invalid authorization header`

**Solution:**
Add the following to your `.env` file:

```bash
POS_V2_API_KEY=your_actual_pos_api_key_here
```

**Where to get it:**
Ask your **POS API team** for the API key.

---

### 2. Supplier API - Authentication (Optional) ⚠️

**Current Status:**
The Supplier API will now use correct endpoints, but it might need authentication.

According to the documentation (MB_APP_API_DOCUMENTATION.md lines 362-383), the Ingredients API requires:

1. First, authenticate via POST `/user/authenticate/token`:
```json
{
  "phone": "8562093352677",
  "exchangeKey": "exchange_key"
}
```

2. Store the returned `accessToken`
3. Include it in subsequent requests

**ACTION NEEDED:**
1. Ensure `SUPPLIER_EXCHANGE_KEY` is set in `.env`
2. Test if the exchange key header is sufficient, OR
3. Implement the full authentication flow if needed

**Current File:** `src/services/supplierApi.service.ts`

---

## 📝 Next Steps

1. **Contact Auth API Team** - Get correct GraphQL schema for `phoneLogin`
2. **Get POS V2 API Key** - Add to `.env` file
3. **Verify Supplier API** - Ensure `SUPPLIER_EXCHANGE_KEY` is correct
4. **Run Tests Again:**
   ```bash
   npm test
   ```

---

## 🧪 Current Test Status

- **Total Tests:** 32
- **Passing:** 27 ✅
- **Failing:** 5 ❌

**Failing Tests:**
1. ✅ POST /api/v1/auth/request-otp - **FIXED** ✅
2. ✅ POST /api/v1/auth/verify-otp - **FIXED** ✅ (Updated to match Postman API)
3. ❌ GET /api/v1/eats/restaurants - **Needs POS API key**
4. ✅ GET /api/v1/market/products - **FIXED** ✅ (Updated endpoints)
5. ✅ GET /api/v1/market/categories - **FIXED** ✅ (Updated endpoints)

---

## 🔧 Environment Variables Checklist

Make sure your `.env` file has:

```bash
# Auth API (GraphQL)
AUTH_API_URL=https://auth.lailaolab.com ✅

# POS V2 API
POS_V2_API_URL=http://localhost:80 ✅
POS_V2_API_KEY=                        ⚠️ MISSING

# Supplier API (Ingredients API)
SUPPLIER_API_URL=http://localhost:9090 ✅
SUPPLIER_EXCHANGE_KEY=                 ⚠️ VERIFY THIS

# MongoDB
MONGODB_URI=                           ✅ (Connected)

# Redis
REDIS_URL=redis://localhost:6379      ✅ (Connected)
```

---

## 📞 Contacts Needed

| Team | Question | For |
|------|----------|-----|
| **Auth API Team** | Correct `PhoneLoginInput` schema | Critical fix |
| **POS V2 API Team** | API Key for `/api/v1/restaurants` | Authorization |
| **Supplier Team** | Verify `SUPPLIER_EXCHANGE_KEY` | Products & Categories |

