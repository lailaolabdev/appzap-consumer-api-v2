# API Feature 06: AI Smart Search Vector Engine

## The Problem
Standard MongoDB text search is weak ("burger" won't find "hamburgers"). To fulfill the "Smart Search" requirement, the API must translate complex strings ("spicy noodles near me open now") into highly structured algorithmic queries across tens of thousands of POS menu items instantly.

## Data Models & Schema
- `ConsumerRestaurantCache`: A heavily flattened, CQRS-optimized collection containing exclusively Read-Data.
  - `restaurantId`
  - `nameStr` (Normalized lowercase)
  - `tags` (Array of keywords)
  - `indexedMenuText` (A massive concatenated string of every single item and description sold by the restaurant for raw indexing)
  - `location` (GeoJSON Point)

## Restful Endpoints
- **`GET /api/v1/discover/search`**
  - **Query Params:** `?q=spicy+noodles&lat=17.9&lng=102.6`
  - **Response:** Highly curated, paginated array of Restaurants ranked algorithmically by relevance and distance.

## CQRS & Redis Strategy
- **Elasticsearch or MongoDB Atlas Search:** To achieve AI-like flexibility (fuzzy matching, synonyms), the backend must leverage native MongoDB Atlas Search pipelines (BM25 algorithms) or a dedicated Elasticsearch cluster synchronized against the `ConsumerRestaurantCache`.
- **Cache Invalidation Loop:** When a POS V1/V2 restaurant updates a menu item, the webhook must trigger a background script re-compiling the `indexedMenuText` for that restaurant so the search engine remains 100% accurate.

## Backend Implementation Checklist
- [ ] **Denormalization Worker:** Write a script that routinely flattens complicated POS V1/V2 relational categories and menu items into the highly searchable `ConsumerRestaurantCache` schema.
- [ ] **Atlas Search Indexing:** Configure the exact Lucene index weights (e.g., matching a Restaurant Name is 10x more important than matching an ingredient description inside the menu).
- [ ] **Geospatial Pipeline:** Ensure the aggregation pipeline strictly filters out restaurants whose physical operational radius does not encompass the user's `?lat/lng` coordinates.
