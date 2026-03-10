# API Feature 22: POS Reservation Integration

## The Problem
Consumers want to book tables. The Consumer API must map the Date/Time parameters and push an explicit push-notification-like prompt into the merchant's physical `appzap-pos-api-v1` or `v2` hardware for manual Staff approval.

## Data Models & Schema
- `ReservationQueueModel`:
  - `userId` (Ref)
  - `restaurantId` (Ref)
  - `dateTime` (Date)
  - `partySize` (Number)
  - `status` (Enum: 'PENDING_MERCHANT', 'CONFIRMED', 'DECLINED')

## Restful Endpoints
- **`POST /api/v1/reservations/request`**
  - **Payload:** `{ "restaurantId": "...", "date": "2026-04-15", "time": "19:30", "partySize": 4 }`
  - **Action:** Creates the MongoDB document and bridges out to the POS.

## CQRS & POS Bridging Strategy
- **WebSockets for Immediate Prompts:** If the target restaurant is on POS V2, the Consumer API must utilize its local Redis-Adapter to execute an outbound `Socket.emit` directly to the `POS_V2_RESTAURANT_ROOM`, triggering a ringing modal on the iPad instantly.
- **V1 Legacy Fallback:** If the target is POS V1, the Consumer API executes a secure REST `POST` into the legacy queue, relying on the V1 app's innate 30-second polling cycle to fetch the reservation.
- **The Callback Loop:** When the POS Staff clicks "Approve", the POS API fires a Webhook exactly back into the `appzap_consumer_api_v2`. The Consumer API intercepts this, updates MongoDB to `status: CONFIRMED`, and pushes an FCM Notification (Feature 05) to the Consumer's phone.

## Backend Implementation Checklist
- [ ] **POS Gateway Router:** Write the controller logic aggressively checking the target Restaurant's metadata to determine if it requires V1 REST injection or V2 Socket bridging.
- [ ] **Consumer Webhook Receiver:** Write `/api/v1/internal/pos/reservation-callback` strictly awaiting the merchant's final decision payload.
