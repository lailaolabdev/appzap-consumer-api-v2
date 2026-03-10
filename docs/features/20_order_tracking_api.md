# API Feature 14: Socket.io Restaurant Status Tracking

## The Problem
Once an order is paid and injected into the POS kitchen (Feature 13), the Consumer App needs a live, zero-latency visual pipeline indicating when the Chef clicks "Accept" or "Cooking" on the iPad. 

## Data Models & Schema
- `OrderStatusTimeline`: (Embedded within the Order document)
  - `status` (Enum: 'PENDING', 'COOKING', 'READY', 'COMPLETED')
  - `timestamp` (Date)

## Socket Architecture
- **Namespace:** `/api/v1/live/orders`
- **Rooms:** When a Consumer successfully completes checkout (Feature 13), the Flutter App automatically emits `.join('ORDER_ROOM:12345')` on the socket connection.
- **Reverse Ping:** The `appzap_consumer_api_v2` backend must establish a private listener explicitly tuned to the `appzap-pos-api-v1` and `v2` event buses.

## CQRS & Redis Strategy
- **Redis Socket Adapter:** If `appzap_consumer_api_v2` is running on 4 load-balanced PM2 Node instances (Cluster Mode), a socket connection on Instance A cannot natively broadcast to someone connected on Instance B.
- **The Fix:** The backend MUST initialize `@socket.io/redis-adapter` natively. This allows Server A to push a message into Redis, which instantly routes it to Server B's connected client.

## Backend Implementation Checklist
- [ ] **Socket Cluster Configuration:** Install and configure the Redis Adapter in `server.ts` to guarantee horizontal scalability.
- [ ] **Authentication Handshake:** The Socket listener must intercept the `io.use()` middleware to strictly validate the user's JWT *before* allowing them to subscribe to an `ORDER_ROOM`, preventing bad actors from mass-subscribing to other peoples' order IDs.
- [ ] **POS Webhook Aggregator:** Build the internal route `POST /api/v1/internal/pos-update`. This is where `appzap-pos-api-v2` fires an HTTP ping declaring `Order 12345 = COOKING`. The Consumer API intercepts this, updates MongoDB, and executes `io.to('ORDER_ROOM:12345').emit('status_update', { status: 'COOKING' })`.
