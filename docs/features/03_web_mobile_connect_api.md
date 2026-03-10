# API Feature 03: Web-to-Native Cart Hydration

## The Problem
A user at a restaurant scans a physical Table QR code, opens Safari, and builds a Cart with 4 items. They see a "Download App" banner, install the Native App, and log in. The Native App must *instantly* populate those 4 items into the Native Cart natively without the user losing their progress.

## Data Models & Schema
- `CartSessionModel`: Must be fundamentally decoupled from "Web vs Native".
  - `userId` (ObjectId) or `phone` (String)
  - `tableId` (String - Ref)
  - `items` (Array of menu variants and modifier selections)

## Restful Endpoints
- **`GET /api/v1/cart/hydrate`**
  - **Auth:** Bearer Token (Authenticated User)
  - **Logic:** Searches the active sessions for any dangling Cart objects linked to the user's verified Phone Number or Account ID.
  - **Response (200 OK):** The complete Cart array and current calculated total.

## CQRS & Redis Strategy
- **Session Migration:** When the Web Ordering application (`appzap-mobile-order-v2`) writes to the cart, it must save the state to Redis bound to the user's `phone` or `temp_uuid`.
- When the Native App logs in and hits `/hydrate`, the API checks Redis for that `phone`. If a cart exists, it immediately returns the JSON payload and seamlessly bonds the session into the Native JWT scope.

## Backend Implementation Checklist
- [ ] **Cart State Schema:** Design the JSON structure required to safely hold complex items, modifiers, sizes, and special instructions.
- [ ] **Redis Storage:** Bind the Cart array to a Redis Key like `CART:PHONE:205551234`.
- [ ] **Hydration Controller:** Write the controller logic for `GET /api/v1/cart/hydrate`. It must elegantly merge any existing local cart items the native app might have generated with the massive Web Cart payload stored in Redis.
- [ ] **Sanitization:** Automatically flush and delete the `CART:PHONE` Redis key once the user successfully completes the checkout process.
