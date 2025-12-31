# Supplier API Endpoint Fixes

## Date: 2025-12-31

## Summary
Fixed Supplier API endpoint paths based on the official Supplier API documentation.

---

## Key Finding from Documentation

**From `docs/[SUPPLIER_API]supplier_api_doc.md` (Line 615):**
> **No Version Prefix**: This API does not use version prefixes like `/v6/`. All endpoints start directly after the base URL.

---

## Fix 1: Get Product Categories ✅

### Problem
❌ Code was using incorrect endpoint: `/v6/supplier-categories`

### Root Cause
The Supplier API does **not** use version prefixes (e.g., `/v6/`, `/api/v1/`). All endpoints start directly after the base URL.

### Solution
✅ Updated to correct endpoint: `/supplier-categories`

### Changes Made
**File:** `src/services/supplierApi.service.ts` (line 85-89)

```typescript
// OLD CODE (WRONG):
const response = await supplierApiClient.get('/v6/supplier-categories');

// NEW CODE (CORRECT):
const response = await supplierApiClient.get('/supplier-categories');
```

**API Documentation Reference:**
- **Endpoint:** `GET /supplier-categories` (Line 76 in docs)
- **Authentication:** Not Required
- **Returns:** List of supplier categories with `_id`, `categoryName`, `description`, `image`

---

## Fix 2: Get Product By ID ✅

### Problem
❌ Code was using incorrect endpoint: `/api/products/${productId}`

### Root Cause
Incorrect endpoint path - not matching the Supplier API documentation.

### Solution
✅ Updated to correct endpoint: `/product/get/${productId}`

### Changes Made
**File:** `src/services/supplierApi.service.ts` (line 77-83)

```typescript
// OLD CODE (WRONG):
const response = await supplierApiClient.get(`/api/products/${productId}`, {
  params: { priceType },
});

// NEW CODE (CORRECT):
const response = await supplierApiClient.get(`/product/get/${productId}`);
```

**API Documentation Reference:**
- **Endpoint:** `GET /product/get/:id` (Line 370 in docs)
- **Authentication:** Not Required
- **Returns:** Full product details including pricing, units, categories, and promotions

**Note:** The `priceType` parameter was removed as the Supplier API returns all pricing information (retail and wholesale) in the product response.

---

## Verified Correct Endpoints ✅

### Get Products (Mobile - Infinite Scroll)
✅ **Already Correct:** `/mobile/product/get/skip/${skip}/limit/${limit}`

**File:** `src/services/supplierApi.service.ts` (line 71)

```typescript
const response = await supplierApiClient.get(`/mobile/product/get/skip/${skip}/limit/${limit}`, {
  params: queryParams,
});
```

**API Documentation Reference:**
- **Endpoint:** `GET /mobile/product/get/skip/:skip/limit/:limit` (Line 330 in docs)
- **Purpose:** Optimized for mobile apps with pagination using path parameters
- **Perfect for:** Infinite scroll implementations

---

## Additional Endpoints to Review

⚠️ **Note:** The following endpoints in `supplierApi.service.ts` are **not documented** in the official Supplier API documentation:

### Identity Linking
- `POST /api/identity/link`
- `POST /api/identity/verify-link-code`
- `GET /api/identity/profile/:supplierId`

### Pricing & Cart
- `POST /api/products/pricing`
- `POST /api/cart/calculate`

### Orders
- `POST /api/orders/create`
- `PUT /api/orders/:id/status`
- `GET /api/orders/:id`
- `POST /api/orders/:id/cancel`

### Subscriptions
- `POST /api/subscriptions/create`
- `PUT /api/subscriptions/:id`
- `POST /api/subscriptions/:id/cancel`

### Delivery
- `POST /api/delivery/calculate-fee`
- `GET /api/delivery/time-slots`

**Recommendation:** These endpoints may be:
1. **Planned but not yet implemented** by the Supplier API team
2. **Placeholder endpoints** for future integration
3. **Custom endpoints** that need to be added to the Supplier API

**Action Required:** Verify with the Supplier API team whether these endpoints exist or need to be implemented.

---

## Impact

### Before Fixes
- ❌ `GET /api/v1/market/categories` - 502 Bad Gateway (Supplier API returned 404)
- **Test Results:** 30/32 passed

### After Fixes (Expected)
- ✅ `GET /api/v1/market/categories` - 200 OK (Returns supplier categories)
- **Test Results:** Expected 31/32 passed

---

## Supplier API Response Formats

### Categories Response
```json
{
  "message": "SUCCESS",
  "data": [
    {
      "_id": "64a5f8c9e4b0d1234567890e",
      "categoryName": "Fresh Produce",
      "description": "Fresh vegetables and fruits from local suppliers",
      "image": "https://example.com/fresh-produce.jpg",
      "isDeleted": false,
      "createdBy": "64a5f8c9e4b0d1234567890f",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### Products Response
```json
{
  "message": "get successful",
  "total": 150,
  "data": [
    {
      "_id": "64a5f8c9e4b0d123456789bb",
      "productName": "Fresh Tomatoes",
      "productCode": "PRD-001234",
      "images": ["https://example.com/tomato1.jpg"],
      "categoryId": { ... },
      "priceRecords": [{ ... }],
      "promotionDetail": [{ ... }]
    }
  ]
}
```

---

## Testing Required

Run the full test suite to verify the fix:

```bash
npm test
```

Expected passing test:
- ✅ `GET /api/v1/market/categories - should list categories`

---

## Key Documentation Notes

From the Supplier API documentation:

1. **No Authentication Required** for product/category endpoints
2. **No Version Prefixes** - All endpoints start after base URL
3. **Pagination** uses `skip` and `limit` parameters
4. **Price Format**: Prices in smallest currency unit (e.g., cents)
5. **Soft Deletes**: Items with `isDeleted: true` are filtered out
6. **Population**: Related data (categories, suppliers, units) are auto-populated

---

## References

- Supplier API Documentation: `docs/[SUPPLIER_API]supplier_api_doc.md`
- Categories: Lines 70-168
- Products: Lines 171-408
- Important Notes: Lines 613-630

---

## Updated Files

1. `src/services/supplierApi.service.ts` - Fixed 2 endpoint paths
2. `SUPPLIER_API_FIX.md` - This documentation

---

**API Version:** 2.0.1  
**Last Updated:** December 31, 2025

