# API Feature 13: QR Payload Resolver & POS Routing

## The Problem
Restaurants across Vientiane have printed thousands of physical QR codes on their tables. Some are running Legacy AppZap POS V1, others are running the new POS V2. The Consumer App will scan these raw strings via the camera. The API must act as a Rosetta Stone, instantly deciphering the string, identifying the Restaurant, and returning the structured Menu ID regardless of which POS system generated the QR code.

## Data Models & Schema
- No new schemas required. This relies on the core `ConsumerRestaurantCache`.

## Restful Endpoints
- **`POST /api/v1/scan/resolve`**
  - **Auth:** Public
  - **Payload:** `{ "rawString": "https://order.appzap.la/... or custom payload" }`

## CQRS & Routing Strategy
- **Regex Interpreters:** The `/resolve` controller must run a gauntlet of Regular Expressions designed explicitly to catch known V1 URL structures and known V2 UUID structures.
- **Instant Hydration:** Once the explicit `restaurantId` and `tableId` are mathematically extracted from the raw string, the API immediately hits Redis (`CACHE:RESTAURANT:ID`) to fetch the menu structure and returns it to the phone. The physical POS databases are never touched during a scan.

## Backend Implementation Checklist
- [ ] **V1 Parser Logic:** Write the script capable of extracting query parameters from legacy V1 generated URLs.
- [ ] **V2 Parser Logic:** Write the script capable of extracting encoded UUIDs generated natively by the new POS V2 systems.
- [ ] **Validation Rejection:** If a consumer scans a random QR code (e.g., a boarding pass or a website URL), the API must safely catch the Regex failure and return a clean `400 Bad Request: Invalid AppZap QR Code` error JSON payload, preventing the Node server from crashing on malformed inputs.
