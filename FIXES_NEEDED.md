# 🔧 Fixes Needed to Pass All Tests

## Current Status: 29/32 Tests Passing ✅

### ❌ Failed Test 1: POS V2 API - 401 Unauthorized

**Error**: `POS V2 API error: Please authenticate - missing or invalid authorization header`

**Root Cause**: Missing or invalid API key

**Check These:**
1. Is `POS_V2_API_KEY` set in your `.env` file?
2. What header format does your POS V2 API expect?
   - Current code uses: `X-API-Key: your-key-here`
   - Does it need: `Authorization: Bearer your-key-here`?
   - Or something else?

**Your POS V2 API Settings:**
- URL: `http://localhost:80`
- Current Header: `X-API-Key` (line 20 in `posV2Api.service.ts`)

**Action Required:**
1. Check your POS V2 API documentation for the correct authentication header
2. Add `POS_V2_API_KEY=your-actual-key` to `.env`
3. Or update `posV2Api.service.ts` if it needs `Authorization: Bearer` instead

---

### ❌ Failed Test 2: Supplier API Categories - 404 Not Found

**Error**: `Cannot GET /v6/supplier-categories`

**Root Cause**: The endpoint doesn't exist on your running Supplier API instance

**Documentation Says:**
- Endpoint should be: `GET /v6/supplier-categories`
- Your URL: `http://localhost:9090`

**Possible Causes:**
1. Supplier API is not running on port 9090
2. The actual endpoint path is different (maybe `/api/v6/supplier-categories`?)
3. The version prefix is different

**Action Required:**
1. Check if Supplier API is running: `curl http://localhost:9090/health` or similar
2. Find the correct categories endpoint from your Supplier API
3. Update `src/services/supplierApi.service.ts` line with correct path

---

### ❌ Failed Test 3: Bookings Route - Test Design Issue

**Error**: Test calls `/api/v1/eats/bookings/my-bookings` but route treats `my-bookings` as a reservation ID

**Root Cause**: The test endpoint is wrong

**Fix**: Update the test to call the correct endpoint:
- ❌ Wrong: `GET /api/v1/eats/bookings/my-bookings`
- ✅ Correct: `GET /api/v1/eats/bookings` (this returns user's bookings)

**File to Fix**: `src/__tests__/api.test.ts` (around line 443)

---

## 🎯 Next Steps:

### For POS V2 API:
1. What authentication header does YOUR POS V2 API expect?
2. Do you have the API key?

### For Supplier API:
1. Is it running? Try: `curl http://localhost:9090/v6/supplier-categories`
2. What's the actual endpoint path?

### For Bookings Test:
- I can fix this immediately if you want

---

## 📊 Test Coverage:
- Overall: 38% statement coverage
- Most critical paths are covered
- All authentication flows work ✅
- All market features work ✅
- All health/live features work ✅

