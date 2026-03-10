# API Feature 08: Global POS Promotions Aggregator

## The Problem
Restaurants on POS V1 and V2 create localized discounts (e.g., "$2 off Chicken"). The Consumer App mobile homescreen needs a massive "Promotions Banner" displaying all active discounts globally across Vientiane. Querying thousands of POS systems dynamically to find these active deals is architecturally impossible.

## Data Models & Schema
- `ConsumerPromotionCache`: A flattened Read-Only duplicate mapping.
  - `restaurantId` (Ref)
  - `promoTitle` (String)
  - `promoImage` (String)
  - `discountType` (Enum)
  - `startDate` (Date)
  - `endDate` (Date)
  - `tags` (Array: 'Food', 'Drink')

## Restful Endpoints
- **`GET /api/v1/discover/promotions`**
  - **Auth:** Public
  - **Action:** Fetches the aggregated, active promotions for the consumer app's rotating Deals Carousel.

## CQRS & Redis Strategy
- **Webhook Aggregator:** When a merchant creates or edits a promotion inside the `appzap-pos-api-v1` or `v2` dashboards, the POS API *must* fire a webhook to `appzap_consumer_api_v2/api/v1/internal/promos/sync`.
- **Mongo Upsert:** The Consumer API receives this webhook and executes an atomic `findOneAndUpdate` inside `ConsumerPromotionCache`.
- **Redis Materialized View:** Every 15 minutes, a cron job on the backend queries `ConsumerPromotionCache` for deals where `Date.now() < endDate` and stringifies the result into `CACHE:GLOBAL_PROMOS`. The Consumer App instantly reads from this Redis bucket.

## Backend Implementation Checklist
- [ ] **Internal Sync Controller:** Build the secured webhook endpoint strictly capable of ingesting raw POS Promo payloads and transforming them into the flattened `ConsumerPromotionCache` format.
- [ ] **Redis Cron Aggregation:** Implement the background `node-cron` worker that builds the `CACHE:GLOBAL_PROMOS` array routinely.
- [ ] **Consumer Access Endpoint:** Build `GET /discover/promotions` pointing directly at the Redis array, returning the payload in under 20ms.
