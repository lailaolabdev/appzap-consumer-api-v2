# API Feature 27: WebSockets In-Restaruant Chat & Live Gifting

## The Problem
Restaurants are extremely social venues in Laos. AppZap's most viral growth loop will happen if Table A can use the mobile app to send a physical bucket of Beerlao to Table B, accompanied by a dynamic Chat message visible to everyone currently checked into that Restaurant's Table QR system.

## Data Models & Schema
- `InAppMessageTracker`:
  - `restaurantId` (Ref)
  - `senderId` (Ref)
  - `targetTableId` (Ref - Optional, for direct gifts)
  - `messageString` (String)
  - `giftPayloadId` (Ref - Attached Order ID)
  - `timestamp` (Date)

## Socket Architecture
- **Namespaces:** Extremely aggressive scoping. A user is only connected to the Chat if they have an active Table Session (Feature 12).
- **Socket Authentication Verification:** The `io.use()` handshake must query the active `CartSessionModel` to mathematically prove the consumer's JWT is physically anchored to a Table ID physically inside that Restaurant, preventing random teenagers from logging onto the app at home and spamming a bar's live chat feed.

## CQRS & Distributed Gifting Mechanics
- **The Hybrid REST/Socket Loop:**
  1. User at Table 4 selects "Bucket of Heineken", types a message "Cheers!", and selects Table 12.
  2. Flutter app calls standard `POST /api/v1/checkout/generate-qr` and pays BCEL (Features 14/15).
  3. The BCEL Webhook hits the API marking the order `PAID`.
  4. The Payment Controller recognizes the `targetTableId` parameter. It injects the physical order to the legacy POS Kitchen (so the waiter brings the beer to Table 12, not Table 4).
  5. The Payment Controller then fires the internal `EventEmitter: "GIFT_SENT"`.
  6. The separate Socket.io Controller intercepts `GIFT_SENT`, and broadcasts an explosive JSON payload onto the Redis Channel explicitly targeting the entire `restaurantId` room.
  7. All 500 people inside the bar see an animation overlay on their phone: `"Table 4 just bought Table 12 a Bucket of Heineken!"`

## Backend Implementation Checklist
- [ ] **Moderation RegEx:** Implement a strict pre-flight parser stripping illegal Lao, English, or Thai profanity strings out of any Chat/Gift payload before it is socket-broadcast.
- [ ] **POS Target Re-routing:** Safely adjust the `POSDeliveryService` so that when injecting an order into POS V1 or V2, the physical printed kitchen slip explicitly declares the Table ID of the *receiving* table, not the *paying* table.
- [ ] **Global Broadcast Adapter:** Program the massive Redis socket broadast event triggering the Flutter Lottie animations.
