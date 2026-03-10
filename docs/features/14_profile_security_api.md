# API Feature 14: Profile Integrity & Account Deletion

## The Problem
Apple App Store Review Guidelines strictly mandate that any app with an account creation flow must have an in-app Account Deletion flow. The backend API must handle this deletion explicitly without destroying the relational integrity of thousands of historical restaurant orders.

## Data Models & Schema
- `UserModel` explicitly requires:
  - `isDeleted` (Boolean - Default: false)
  - `deletedAt` (Date)
  - `languagePref` (Enum: 'lo', 'en', 'th')

## Restful Endpoints
- **`POST /api/v1/user/security/logout`**
  - **Auth:** Bearer Token
  - **Action:** Strips the explicit Redis session payload, invalidating the refresh token.
- **`DELETE /api/v1/user/security/account`**
  - **Auth:** Bearer Token
  - **Action:** Triggers the atomic anonymization script.
- **`PATCH /api/v1/user/settings`**
  - **Payload:** `{ "languagePref": "lo" }`

## CQRS & Security Strategy
- **Token Blacklisting:** Standard JWTs cannot be natively destroyed. To safely execute a Logout, the API must use a Redis Blacklist. When a user hits `/logout`, their specific `jwt_id` (JTI) is pushed onto Redis with an expiration matching the JWT's lifespan. The global Auth Middleware explicitly checks this Redis array on every single request.
- **The Anonymizer:** The `/account` deletion logic must overwrite PII (Personally Identifiable Information). 
  - `phone` becomes `DELETED_` + random UUID.
  - `nickname` becomes `AppZap User`.
  - The JWT is pushed to the Blacklist.

## Backend Implementation Checklist
- [ ] **Redis Blacklist Middleware:** Program the high-velocity interceptor in `src/middleware/auth.ts` to actively check Redis for revoked tokens.
- [ ] **Atomic Anonymization Controller:** Write the explicit `$set` operations mutating the User document safely, preserving the `_id` so relational Order data doesn't collapse.
- [ ] **Push Notification Pruning:** When a user deletes their account, the backend must execute an explicit Firebase Admin SDK call to forcefully revoke and delete all physical `fcmTokens` mapped to that User ID, ensuring AppZap Admins cannot accidentally spam their phone in the future.
