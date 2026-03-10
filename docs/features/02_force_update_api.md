# API Feature 02: Force Update Boot Payload

## The Problem
When the AppZap Mobile app boots, it needs an ultra-fast, unauthenticated API endpoint to query the globally required `minimum_version`. The backend must serve this variable instantaneously without overloading the MongoDB cluster when 10,000 users open the app simultaneously.

## Data Models & Schema
- `SystemConfigModel`: A single monolithic MongoDB document containing properties:
  - `ios_latest_version` (String)
  - `ios_minimum_version` (String)
  - `android_latest_version` (String)
  - `android_minimum_version` (String)
  - `is_maintenance_mode` (Boolean)

## Restful Endpoints
- **`GET /api/v1/config/boot`**
  - **Auth:** Public (Unauthenticated)
  - **Response (200 OK):** JSON rigidly matching the `SystemConfigModel`.

## CQRS & Redis Strategy
- **High-Velocity Caching:** Because this endpoint is hit every single time *any* user opens the app, reading directly from MongoDB is lethal. 
- The controller *must* retrieve the payload from a Redis key (e.g., `CACHE:SYSTEM_CONFIG`).
- **Cache Invalidation:** The Admin Dashboard (`appzap_statistic`) simply updates the MongoDB string and flushes the Redis key, forcing the API to cache the new version string on the next read.

## Backend Implementation Checklist
- [ ] **Define Schema:** Create `src/models/SystemConfig.ts` mapped to the Mongoose collection.
- [ ] **Controller Logic:** Create `src/controllers/config.controller.ts`. Program it to `await redis.get('CACHE:SYSTEM_CONFIG')`.
- [ ] **Mongo Fallback:** If the Redis key is `null`, execute the standard `SystemConfigModel.findOne()`, write the result to Redis with a 24-hour TTL, and return the payload to the user.
- [ ] **Benchmark:** Run artillery/load-testing on this endpoint. Ensure it maintains a `< 25ms` response time under heavy concurrent load.
