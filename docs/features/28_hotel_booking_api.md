# API Feature 23: 3rd Party Hotel API Aggregation

## The Problem
The Super App allows booking accommodations. Mobile apps should *never* securely hold third-party API Keys (e.g., Booking.com, Agoda) in their compiled binaries. The Node.js backend must act as a seamless proxy, gathering AppZap's search parameters, attaching the secure server-side API keys, hitting the 3rd party, and returning the standardized JSON to the phone.

## CQRS & External Proxy Strategy
- **Normalization Middleware:** Different 3rd party hotel APIs return wildly different JSON structures. The Consumer API must write a "Normalization Interface" that forces Agoda payloads and [Insert generic API] payloads into the exact same unified `AppZapHotelObject` format so the Flutter app never has to write custom parsing logic for different API providers.
- **Response Caching (CRITICAL):** External APIs charge by the invocation. If 1,000 AppZap users search for "Hotels in Luang Prabang for Nov 14th", do not hit the external API 1,000 times.
- The `hotelSearch` controller must execute a SHA-256 hash on the Stringified Request Parameters (`Location + Date`).
- It checks Redis for that Hash. `await redis.get(HASH)`. If it exists, return the cached array instantly.
- If it misses, burn a paid API call to the 3rd party, normalize the response, save it to Redis with a `15-minute TTL`, and return the result.

## Restful Endpoints
- **`POST /api/v1/stays/search`**
  - **Payload:** `{ "locationStr": "Vientiane", "checkIn": "2026-10-01", "checkOut": "2026-10-05" }`
  - **Action:** Proxies the external API under the protection of Redis Caching.

## Backend Implementation Checklist
- [ ] **Redis Hash Generator:** Build the deterministic caching wrapper strictly generating cache keys based on identical user search parameters.
- [ ] **Provider Interfaces:** Write explicitly segregated classes (`AgodaService.ts`, `AppZapInternalHotelService.ts`) that strictly conform to a `StandardizedHotelAdapter` TypeScript interface.
