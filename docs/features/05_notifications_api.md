# API Feature 05: FCM Notification Target Dispatcher

## The Problem
The AppZap Admin Dashboard needs to execute demographic-targeted Push Notifications (e.g., sending a BeerLao promo *only* to Male users born before 2006). The Backend API must process these complex Admin queries, aggregate the matching FCM device tokens, and dispatch them to Google Firebase.

## Data Models & Schema
- `DeviceTokenModel`:
  - `userId` (ObjectId Ref)
  - `fcmToken` (String)
  - `deviceOS` (Enum: 'iOS', 'Android')
  - `lastActive` (Date)
- `BroadcastHistoryModel`: (For Admin Dashboard Analytics)
  - `adminId` (ObjectId)
  - `payload` (JSON)
  - `targetAudienceSize` (Number)
  - `successCount` (Number)

## Restful Endpoints
- **`POST /api/v1/notifications/device/register`**
  - **Auth:** Bearer Token
  - **Action:** The Flutter app calls this silently on boot to bind its physical device token to the active User ID.
- **`POST /api/v1/admin/broadcast/dispatch`**
  - **Auth:** SuperAdmin Token Only
  - **Payload:** `{ "title": "...", "body": "...", "filters": { "minAge": 18, "sex": "M" }, "deepLinkUrl": "appzap://promo/123" }`

## CQRS & Redis Strategy
- **Background Workers:** Sending 50,000 pushes synchronously via Node.js will block the event loop and crash the API. 
- The `/dispatch` endpoint must instantly return a `202 Accepted` to the Admin Dashboard and hand the target query off to a **BullMQ / Redis Background Worker**. The worker handles querying MongoDB, chunking the 50,000 tokens into arrays of 500, and firing them at Firebase asynchronously.

## Backend Implementation Checklist
- [ ] **Device Registration:** Build the endpoint allowing the mobile app to flawlessly update its FCM token (preventing duplicate tokens per user).
- [ ] **Firebase SDK Initialization:** Integrate `firebase-admin` into the backend cluster securely using the Google Service Account JSON.
- [ ] **BullMQ Queue Setup:** Stand up a dedicated Redis Queue exactly processing massive target audiences in chunks of 500 (Firebase's multicast limit) to ensure zero dropped packets during massive broadcasts.
