# API Feature 04: OTP Authentication & Demographic Profiles

## The Problem
The mobile app relies strictly on SMS/WhatsApp OTP for login (no OAuth). The Backend must securely generate, dispatch, and mathematically verify these 6-digit payloads before issuing a JWT. Furthermore, the API must strictly enforce the collection of Demographic Data (Nickname, YOB, Sex) for the Admin Dashboard.

## Data Models & Schema
- `UserModel` requires exact fields:
  - `phone` (String, Unique)
  - `nickname` (String)
  - `yearOfBirth` (Number)
  - `sex` (Enum: 'M', 'F', 'O')
  - `role` (Enum: 'USER', 'ADMIN')
- `OtpSessionModel`:
  - `phone` (String)
  - `hash` (String - Bcrypt representation of the 6-digit pin)
  - `expiresAt` (Date - strictly 3 minutes from generation)

## Restful Endpoints
- **`POST /api/v1/auth/otp/request`**
  - Payload: `{ "phone": "+85620..." }`
  - Action: Generate a secure 6-digit PIN, hash it into MongoDB, and trigger the WhatsApp/SMS third-party provider API to dispatch the message.
- **`POST /api/v1/auth/otp/verify`**
  - Payload: `{ "phone": "+85620...", "pin": "123456" }`
  - Action: Bcrypt compare the PIN against the database. If successful, issue a secure JWT and delete the OTP session.
- **`PATCH /api/v1/user/demographics`**
  - Payload: `{ "nickname": "Alex", "yearOfBirth": 1995, "sex": "M" }`

## CQRS & Security Strategy
- **Rate Limiting:** Protect `/otp/request` with aggressive Redis-backed Rate Limiting (e.g., max 3 requests per 10 minutes per IP/Phone) to prevent SMS toll-fraud draining company funds.
- **Token Invalidation:** JWTs should have a short lifespan (1 hour) coupled with a Long-lived Refresh Token stored securely in HttpOnly cookies or the Flutter secure keystore.

## Backend Implementation Checklist
- [ ] **Twilio/Infobip Integration:** Set up the outbound HTTP wrapper connecting AppZap to the Lao telecom aggregator for SMS dispatch.
- [ ] **Auth Controllers:** Build the Generate, Verify, and Refresh mechanisms using `jsonwebtoken` and `bcryptjs`.
- [ ] **Demographic Enforcement Middleware:** Construct a middleware router that intercepts any request to `Phase 2` endpoints (like `/cart` or `/payment`) and violently rejects the request with a `403` if the User's `nickname`, `YOB`, or `sex` is currently `null`.
