# API Feature 19: Geospatial Delivery Distance Math

## The Problem
Instead of Restaurant Orders, the AppZap user wants to command a Courier rider to pick up a physical inventory package and deliver it from Point A to Point B. The Backend must calculate the exact spatial distance natively to determine the Rider Delivery Fee instantaneously.

## Data Models & Schema
- `UserAddressBookModel`:
  - `userId` (Ref)
  - `label` (String: 'Home')
  - `location` (GeoJSON: `{ type: 'Point', coordinates: [lng, lat] }`)
  - `isDefault` (Boolean)

## Restful Endpoints
- **`POST /api/v1/delivery/calculate-route`**
  - **Payload:** `{ originLngLat: [102.6, 17.9], destinationLngLat: [102.7, 18.0] }`
  - **Response:** The exact mathematically calculated Route distance and the resulting LAK currency `deliveryFee`.
- **`POST /api/v1/profile/addresses`**
  - **Action:** Simple CRUD array management allowing a user to permanently cache multiple verified GeoJSON points.

## Backend Math Strategy
- **Haversine vs OpenRouteService:** Calculating standard "as the crow flies" straight-line math (Haversine Formula) via MongoDB's `$geoNear` is not accurate for Rider Fees because Vientiane streets curve.
- The `calculate-route` endpoint MUST execute an internal proxy request to a native OpenStreetMap (OSM) routing engine (or Google Maps Distance Matrix API) to fetch the actual *drivable route kilometers*, multiply by the `PricePerKilometer` admin setting, and return the true cost.

## Backend Implementation Checklist
- [ ] **GeoJSON Mapping Validation:** When a user saves an explicit Address, strictly validate that `coordinates[0]` is Longitude and `coordinates[1]` is Latitude, or standard MongoDB `$geoIntersects` spatial indexes will catastrophically implode.
- [ ] **Distance Proxy Controller:** Wire the `/calculate-route` backend API securely to an explicit Maps Routing provider, caching frequent identical PointA->PointB routes silently in Redis for 24 hours to aggressively minimize Map API billing costs.
