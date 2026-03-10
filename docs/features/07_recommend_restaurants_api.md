# API Feature 07: Admin Promoted Restaurants Feed

## The Problem
The Dashboard needs the ability to force specific V1/V2 restaurants to the absolute top of the Consumer Mobile App homescreen. Standard organic ranking logic must be violently overridden by these explicit Admin priority commands.

## Data Models & Schema
- `PinnedPlacementModel`:
  - `restaurantId` (Ref)
  - `startDate` (Date)
  - `endDate` (Date)
  - `priorityRank` (Number: 1, 2, 3)
  - `customBannerUrl` (Optional String)

## Restful Endpoints
- **`GET /api/v1/discover/home-feed`**
  - **Action:** The core endpoint powering the Mobile App's first screen. It must stitch together the active "Promoted" restaurants followed by the organic algorithmic restaurants.

## CQRS & Redis Strategy
- **Pre-Compilation:** Calculating the exact home feed for every single user hitting the API concurrently is expensive. 
- The backend should use node-cron to pre-compile the `/home-feed` JSON payload every 5 minutes and store the entire stringified array into Redis `CACHE:HOME_FEED:VIENTIANE`.
- When users open the app, the API simply dumps that pre-baked Redis string directly to the client in < 15ms.

## Backend Implementation Checklist
- [ ] **Dashboard CRUD API:** Build the secure `appzap_statistic` routes allowing Admins to create, edit, and delete `PinnedPlacementModel` documents.
- [ ] **Feed Stitching Algorithm:** Implement the logic that merges active Pins (where `Current Date` is between `startDate` and `endDate`) with organic data.
- [ ] **Redis Cron Job:** Stand up the background worker that pre-calculates the ultimate Home Feed JSON array every 5 minutes, relieving almost all structural load off the MongoDB cluster.
