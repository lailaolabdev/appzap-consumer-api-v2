# API Feature 11: Live Events Feed & Expiration

## The Problem
A chronological marketing feed controlled entirely by the Admins via `appzap-dashboard-v2` indicating upcoming public festivals or parties. Events are explicitly bound to timeframes. Once an event concludes geographically, the Consumer Mobile app should categorically never see it natively again.

## Data Models & Schema
- `PublicEventModel`:
  - `title` (String)
  - `coverImage` (String)
  - `latitude`, `longitude` (Number)
  - `startDate`, `endDate` (Date)
  - `isDraft` (Boolean)

## Restful Endpoints
- **`GET /api/v1/discover/events`**
  - **Auth:** Public
  - **Action:** Queries MongoDB for explicitly published, non-expired active events.

## CQRS & Redis Strategy
- **MongoDB TTL Indexing:** Do not rely purely on application-level filtering (`date < Date.now()`). To guarantee zero dead data pollutes the Consumer feed, implement a native **MongoDB TTL (Time-To-Live) Index** strictly mapping onto the `endDate` field.
- **Automatic Pruning:** Using the TTL index, the secondary physical MongoDB cluster will automatically and invisibly delete the explicit document out of existence precisely 24 hours after the mathematical `endDate` passes, guaranteeing a flawlessly clean feed.

## Backend Implementation Checklist
- [ ] **Model Definition & TTL:** Define the `PublicEventModel`. Physically construct the `schema.index({ "endDate": 1 }, { expireAfterSeconds: 86400 })` block forcing MongoDB to automatically drop old rows into the void.
- [ ] **Sorting Logic:** The `/events` controller must aggressively enforce a `$match: { isDraft: false }` constraint to block Admin draft states, and execute a strict chronological ascending sort so the imminent closest events physically render first in the Flutter UI array.
