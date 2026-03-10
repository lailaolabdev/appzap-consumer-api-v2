# API Feature 17: Ecosystem Loyalty Points Math

## The Problem
Whenever an AppZap user successfully completes a purchase, the system must automatically calculate a fractional percentage of the total fiat spent, explicitly map it into "AppZap Loyalty Points", and credit the user's Points balance in MongoDB for future redemption.

## Data Models & Schema
- `LoyaltyProfileModel`: (Can be embedded in `UserModel` or separated)
  - `userId` (Ref)
  - `totalPoints` (Number)
  - `pointsHistory`: Array of `{ orderId, pointsEarned, timestamp }`

## Restful Endpoints
- **Internal Event Listener:** The generation of points does *not* happen via a direct mobile app HTTP request (this would allow users to just infinitely call the endpoint and give themselves 1 Million points). It happens natively inside the Backend Event Loop.
- **`POST /api/v1/loyalty/redeem`**
  - **Payload:** `{ "pointsToSpend": 500 }`
  - **Response:** Generates a temporary Coupon payload (Feature 16) securely bound to that User ID equivalent to the fiat conversion rate of those points.

## CQRS & Security Strategy
- **WebHooks & Background Events:** In Feature 13 (Payments), when the `/webhooks/bcel/callback` verifies `status: PAID`, the payment controller must emit an internal Node.js event like `eventEmitter.emit('loyalty_accrue', { userId, fiatTotal })`. 
- An entirely separate, decoupled Loyalty Service listens for this event and executes the math, guaranteeing that Point Generation logic never blocks or slows down the critical POS Injection loop.
- **Rounding Math:** The system must utilize explicit `Math.floor()` rounding strategies to never artificially inject infinite floating point decimals into the database (e.g., `100 LAK = 1 Point`, `15,550 LAK` earns exactly `155 Points`, not `155.5`).

## Backend Implementation Checklist
- [ ] **Decoupled Accrual Listener:** Set up the Node.js `EventEmitter` hook cleanly inside `appzap_consumer_api_v2/src/services/loyalty.service.ts` to listen for `ORDER_PAID` payloads.
- [ ] **Redemption Math:** Code the `/redeem` endpoint. It must aggressively use `$inc: { totalPoints: -500 }` natively inside a MongoDB atomic transaction to ensure the points are permanently destroyed *before* the temporary Coupon is generated.
