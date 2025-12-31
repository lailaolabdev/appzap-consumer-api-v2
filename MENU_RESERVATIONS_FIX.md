# Menu & Reservations Endpoint Fixes

## Date: 2025-12-31

## Summary
Fixed two critical API integration issues based on the updated POS V2 API documentation.

---

## Fix 1: Menu Endpoint ✅

### Problem
❌ Code was calling non-existent endpoint: `/api/menu/:restaurantId`

### Root Cause
The POS V2 API documentation explicitly states:
> **⚠️ IMPORTANT:** There is **NO** `/api/menu/:restaurantId` endpoint!

### Solution
✅ Updated to use TWO correct endpoints:
1. `GET /api/v1/menu-categories?restaurantId=xxx&isActive=true`
2. `GET /api/v1/menu-items?restaurantId=xxx&isActive=true`

### Changes Made
**File:** `src/services/posV2Api.service.ts` (lines 127-157)

```typescript
// OLD CODE (WRONG):
const menuResponse = await posV2Client.get(`/api/menu/${restaurantId}`);
restaurant.menu = menuResponse.data.data || menuResponse.data;

// NEW CODE (CORRECT):
// Fetch menu categories
const categoriesResponse = await posV2Client.get('/api/v1/menu-categories', {
  params: { restaurantId, isActive: true },
});
const categories = categoriesResponse.data.data || categoriesResponse.data || [];

// Fetch menu items
const itemsResponse = await posV2Client.get('/api/v1/menu-items', {
  params: { restaurantId, isActive: true },
});
const items = itemsResponse.data.data || itemsResponse.data || [];

// Combine into menu structure
restaurant.menu = {
  categories,
  items,
};
```

---

## Fix 2: Reservations List Endpoint ✅

### Problem
❌ Code was calling wrong endpoint: `/api/v1/reservations`
❌ Using `skip` parameter (API doesn't support this)
❌ Using `customerId` parameter (API doesn't support filtering by customer)

### Root Cause
Incorrect endpoint path and parameter mapping.

### Solution
✅ Updated to correct endpoint: `/api/v1/table-reservations`
✅ Convert `skip` to `page` parameter
✅ Added client-side filtering by `customerId` (workaround for API limitation)

### Changes Made
**File:** `src/services/posV2Api.service.ts` (lines 196-239)

```typescript
// Calculate page number from skip/limit
const page = params.skip ? Math.floor(params.skip / (params.limit || 20)) + 1 : 1;

// Use correct endpoint
const response = await posV2Client.get('/api/v1/table-reservations', {
  params: {
    status: params.status,
    limit: params.limit || 20,
    page: page,
  },
});

// Filter by customerId client-side (API doesn't support this filter)
const filteredReservations = reservations.filter((reservation: any) => {
  return reservation.customerId === params.customerId || 
         reservation.customerPhone === params.customerId ||
         reservation.userId === params.customerId;
});
```

---

## Fix 3: Get Reservation By ID ✅

### Problem
❌ Code was calling wrong endpoint: `/api/v1/reservations/:id`

### Solution
✅ Updated to correct endpoint: `/api/v1/table-reservations/:id`

### Changes Made
**File:** `src/services/posV2Api.service.ts` (lines 178-192)

```typescript
// OLD CODE:
const response = await posV2Client.get(`/api/v1/reservations/${reservationId}`);

// NEW CODE:
const response = await posV2Client.get(`/api/v1/table-reservations/${reservationId}`);
```

---

## Impact

### Before Fixes
- ❌ Menu endpoint: 404 Not Found
- ❌ Reservations list: 404 Not Found  
- ❌ Get reservation by ID: 404 Not Found
- **Test Results:** 30/32 passed (2 failures)

### After Fixes (Expected)
- ✅ Menu endpoint: Returns categories + items
- ✅ Reservations list: Returns filtered reservations
- ✅ Get reservation by ID: Returns reservation details
- **Test Results:** Expected 31-32/32 passed

---

## Notes

### Menu Data Structure
The menu is now returned as:
```json
{
  "categories": [...],
  "items": [...]
}
```

Instead of a single flat structure.

### Reservations Filtering
⚠️ **Important:** The POS V2 API doesn't support filtering reservations by `customerId` directly. We implemented client-side filtering as a workaround. 

**Future Consideration:** Consider storing reservations in the consumer API database for better querying capabilities.

---

## Testing Required

Run the full test suite to verify all fixes:

```bash
npm test
```

Expected passing tests:
- ✅ `GET /api/v1/eats/restaurants/:id` - should include menu data
- ✅ `GET /api/v1/eats/bookings` - should list user bookings

---

## References

- POS V2 API Documentation: `docs/[POS_API]appzap-api-doc.md`
- Menu endpoints: Lines 2494-2687
- Reservations endpoints: Lines 2761-2967

