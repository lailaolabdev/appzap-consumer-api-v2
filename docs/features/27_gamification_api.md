# API Feature 21: Gamification (Spin-To-Win) RNG Engine

## The Problem
Users spend AppZap Points to spin a prize wheel. The API must cryptographically determine the winner natively using the Admin Dashboard's programmed float probabilities. It absolutely cannot trust the client to declare a 'win'.

## Data Models & Schema
- `GamificationEventModel`:
  - `title` (String)
  - `costInPoints` (Number)
  - `slices`: Array of `{ sliceId, title, probabilityPct (float), globalInventory (Number) }`
- `SpinHistoryLog`:
  - `userId` (Ref)
  - `sliceWonId` (Ref)
  - `timestamp` (Date)

## Restful Endpoints
- **`POST /api/v1/gamification/spin/execute`**
  - **Auth:** Bearer Token
  - **Action:** Deducts points, calculates RNG, decrements global inventory if the prize has limits, and returns the deterministic `sliceWonId` to the frontend app for animation.

## CQRS & Cryptography Strategy
- **Secure RNG Math:** Do not use `Math.random()`. Node.js natively supports `crypto.randomInt()`. The algorithm must sum the current active `probabilityPct` of all slices (which must equal 100.00), generate a vast cryptographic random integer, and iterate through the cumulative slice thresholds to determine the deterministic winner.
- **Inventory Depletion Lock:** If a user lands on the `0.001%` slice for an iPhone 16, and the `globalInventory` drops to `0`, the API must atomically execute an `$inc: { "slices.$.probabilityPct": -0.001 }` and dynamically re-allocate that `0.001%` back to the standard "Try Again" slice so the wheel mathematics never break mid-event.

## Backend Implementation Checklist
- [ ] **Cryptographic Algorithm:** Write `src/utils/secureSpinner.ts` mapping cumulative probability logic against native Node.js cryptography.
- [ ] **Transaction Guard:** Executing a Spin relies on two resources: The User's Point Balance, and the Prize Inventory. The controller must use `mongoose.startTransaction()` to safely deduct the points and decrement the global inventory simultaneously.
