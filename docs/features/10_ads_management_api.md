# API Feature 10: Ad Delivery & Tracking Engine

## The Problem
AppZap Admins sell sponsored visual real estate (Banners, Splash Screens) directly to POS merchants. The Consumer app needs to fetch these Ad payloads instantly, but more critically, the backend must quietly track `Impressions` and `Clicks` for billing without slowing down the core API server.

## Data Models & Schema
- `CampaignModel`:
  - `title` (String)
  - `zone` (Enum: 'HOME_CAROUSEL', 'INTERSTITIAL')
  - `assetUrl` (String)
  - `linkPayload` (String - The target Restaurant ID)
  - `startDate`, `endDate` (Date)
- `AdMetricQueue`: (Temporary fast-write buffer)

## Restful Endpoints
- **`GET /api/v1/ads/delivery?zone=HOME_CAROUSEL`**
  - **Response:** Rapidly returns active Campaigns for that specific UI block.
- **`POST /api/v1/ads/track`**
  - **Action:** A lightweight, fire-and-forget ingestion ping from the mobile app marking an impression or an explicit tap.

## CQRS & Redis Strategy
- **Redis Queue Ingestion:** Forcing the `/track` endpoint to execute an `UPDATE` on MongoDB every single time an ad is swiped past on the mobile app will absolutely crash the database with lock contention. 
- **The Solution:** The `/track` route does absolutely nothing but push the `<CampaignId>_IMPRESSION` string onto a `redis.lpush` list mechanism. It takes <2ms and returns `204 No Content`.
- **Batch ProcessingWorker:** Every 60 seconds, a massive `node-cron` background worker drains the entire Redis List (e.g., 50,000 pings), mathematically aggregates the counts in NodeJS memory, and executes one single massively efficient `$inc` (Increment) atomic update block onto the `CampaignModel` documents inside MongoDB.

## Backend Implementation Checklist
- [ ] **Read Pipeline:** Write the `/delivery` endpoint strictly querying the active `startDate`/`endDate` window against MongoDB and dumping the payload out.
- [ ] **Redis Ingestion Controller:** Write the insanely lightweight `/track` controller that strictly dumps the analytics event payload onto an active Redis List.
- [ ] **Crontab Aggregation:** Code the background execution hook that safely drains the Redis `AdMetricQueue`, aggregates identically clustered Campaign ID pings, and executes the MongoDB batch `$inc` writes seamlessly.
