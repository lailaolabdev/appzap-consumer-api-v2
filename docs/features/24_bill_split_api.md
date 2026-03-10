# API Feature 18: Bill Splitting Engine & Fractional Logic

## The Problem
A user has 150,000 LAK inside their Cart. They want to split it with 2 other users on their Contacts list. The Backend API must intercept the gigantic 150,000 LAK Cart, fracture it into three mathematically perfect 50,000 LAK sub-carts, and generate 3 explicit BCEL QR codes. It cannot inject the Order into the POS system until all 3 sub-QR codes return `status: PAID` from the Bank.

## Data Models & Schema
- `SplitGroupSessionModel`:
  - `hostUserId` (Ref)
  - `parentOrderId` (Ref)
  - `totalCartOriginal` (Number)
  - `participants`: [ `{ userId, assignedFraction, subOrderId, status: 'PENDING' }` ]
  - `globalStatus` (Enum: 'AWAITING_FUNDS', 'FULLY_FUNDED')

## Restful Endpoints
- **`POST /api/v1/cart/split/initiate`**
  - **Action:** Creates the `SplitGroupSessionModel` and distributes Push Notifications (Feature 05) to the participants via the Consumer API.
- **`GET /api/v1/cart/split/:sessionId`**
  - **Action:** Allows participants to poll the real-time funding status of the group.

## CQRS & Math Strategy
- **Penny Math Division Rounding:** 100,000 divided by 3 is `33,333.33`. Laos fiat (LAK) does not have fractional pennies. The API *must* contain an explicit "Split Math" engine that automatically rounds `User 1` and `User 2` to `33,333` and dynamically maps the remainder exclusively to the `Host User` (`33,334`) to ensure the mathematical sums precisely equal the `parentOrderId` cost.
- **Timeout Cleanup:** If User 3 never pays their fraction, the Parent Order is never injected into the restaurant POS. The API must run a `node-cron` clearing script every 60 seconds destroying any `SplitGroupSessions` older than 15 minutes and refunding the AppZap wallets of Users 1 and 2 automatically.

## Backend Implementation Checklist
- [ ] **Precision Division Generator:** Write the robust math script guaranteeing fractional LAK amounts never leak into the BCEL payloads.
- [ ] **Multi-Webhook Aggregate Listener:** Refactor Feature 13's Webhook Receiver. When a `/bcel/callback` hits, it must check if the `orderId` is a `subOrderId`. If yes, it updates the `SplitGroupSession`, checks if all participants are `PAID`, and if true, flips the `globalStatus` and physically executes the POS injection for the gigantic Parent Order.
