# API Feature 09: POS Reviews & Moderation Sync

## The Problem
Consumers submit 1-to-5 star reviews on their AppZap orders. These must be permanently attached to the specific Restaurant Profile. However, if a review contains abusive language, the AppZap Admin must have the power to "Hide" it via the dashboard, instantly erasing it from the public Consumer API feed while keeping the factual data in MongoDB.

## Data Models & Schema
- `ReviewModel`:
  - `orderId` (Ref - Unique)
  - `userId` (Ref)
  - `restaurantId` (Ref)
  - `rating` (Number 1-5)
  - `comment` (String)
  - `isHidden` (Boolean - Default: false)
  - `createdAt` (Date)

## Restful Endpoints
- **`POST /api/v1/review/submit`**
  - **Auth:** Bearer Token
  - **Payload:** `{ "orderId": "abc1234", "rating": 5, "comment": "Amazing." }`
- **`GET /api/v1/restaurant/:id/reviews`**
  - **Auth:** Public
  - **Action:** Fetches the paginated history of public reviews.

## CQRS & Security Strategy
- **Validation Locks:** The `/submit` endpoint contains critical validation logic. It must verify the `orderId` actively belongs to the requester's `userId`, the order status strictly equals `DELIVERED`, and a review does not already exist matching that `orderId`. This prevents bot-spamming 5-star reviews on a restaurant.
- **Moderation Filter:** The `/reviews` endpoint must aggressively force `{ isHidden: false }` onto the MongoDB query payload, ensuring any review flagged by the Admin Dashboard never leaks to the public client.

## Backend Implementation Checklist
- [ ] **Submission Controller:** Write the robust validation barriers preventing duplicate or illegitimate review submissions natively.
- [ ] **Math Aggregation:** Instead of dynamically calculating a restaurant's 4.8 star average on every single read request, attach a Mongoose Post-Save Hook to `ReviewModel`. When a new review is inserted, automatically trigger an aggregation pipeline that mathematically recalculates the `averageRating` scalar and updates it directly onto the targeted `ConsumerRestaurantCache` document.
