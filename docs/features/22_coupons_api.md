# API Feature 16: Cryptographic Coupon Validation 

## The Problem
AppZap admins will generate text strings ("PI-MAI-2026") that instantly wipe out 50,000 LAK from a Cart. The Consumer API must relentlessly interrogate the validation engine before applying the math, checking for expiration dates, minimum cart thresholds, and "single-use per user" exploitation bypasses.

## Data Models & Schema
- `PromoCodeModel`:
  - `code` (String - Uppercase Unique)
  - `discountType` (Enum: 'PERCENTAGE', 'FLAT_LAK')
  - `discountValue` (Number)
  - `minimumSpend` (Number)
  - `maxGlobalUses` (Number)
  - `currentUses` (Number)
  - `expiresAt` (Date)
- `PromoRedemptionLog`:
  - `userId` (Ref)
  - `codeId` (Ref)

## Restful Endpoints
- **`POST /api/v1/coupon/validate`**
  - **Payload:** `{ "code": "PI-MAI-2026", "cartTotal": 150000 }`
  - **Response:** Mathematical recalculation (`{ valid: true, newTotal: 100000 }`) or a violent rejection (`{ valid: false, reason: "MINIMUM_SPEND_NOT_MET" }`).

## Validation Logic Strategy
- The endpoint must execute a waterfall of explicit failure checks:
  1. `isValid()`: Does the string exist?
  2. `isExpired()`: Is `Date.now() > expiresAt`?
  3. `isDepleted()`: Is `currentUses >= maxGlobalUses`?
  4. `isThresholdMet()`: Is `cartTotal >= minimumSpend`?
  5. `hasUserRedeemedAlready()`: Check `PromoRedemptionLog` for `userId`. (Crucial for "One Time Use" codes).

## Backend Implementation Checklist
- [ ] **Validation Waterfall Controller:** Write the explicit 5-step interrogation logic returning distinct, human-readable error JSON payloads to the Flutter app if validation fails.
- [ ] **Atomic Redemption Mapping:** When a user physically successfully checks out using a coupon, the API must perform two identical atomic operations: `$inc: { currentUses: 1 }` on the `PromoCodeModel`, and `insertOne()` onto `PromoRedemptionLog` locking their User ID out of future uses.
