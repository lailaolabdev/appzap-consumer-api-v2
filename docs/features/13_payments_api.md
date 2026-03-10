# API Feature 13: Payments, BCEL Webhooks & POS Injection

## The Problem
This is the heart of the Super App. The Consumer has finalized a Cart and requested payment. The Backend must generate a valid BCEL QR, wait for the callback, mathematically verify the fiat settlement amount, and critically—inject the finalized JSON payload physically into the target POS V1 or V2 database without crashing the restaurant.

## Data Models & Schema
- `TransactionModel`: 
  - `consumerOrderId` (Unique String)
  - `gatewayRef` (String)
  - `status` (Enum: 'PENDING', 'PAID', 'FAILED')
  - `fiatAmount` (Number)

## Restful Endpoints
- **`POST /api/v1/checkout/generate-qr`**
  - **Payload:** `{ "cartId": "...", "method": "BCEL" }`
  - **Action:** Requests the dynamic QR base64 string from the BCEL One Gateway locking the exact `OrderTotal`.
- **`POST /api/v1/webhooks/bcel/callback`**
  - **Auth:** BCEL IP Whitelisting + Signature Hash Validation
  - **Action:** Captures the instantaneous success ping from the bank.

## CQRS & POS Injection Strategy
- **Webhooks are Unstable:** BCEL might ping your server 3 times for the same transaction. The `/callback` route must be strictly **indempotent**. If the `consumerOrderId` is already `status: PAID`, it must instantly return `200 OK` and halt execution to prevent double-charging the internal wallet or sending 2 orders to the POS kitchen.
- **The POS Injection Event:** Once `status: PAID` is verified, the Consumer API must construct a standardized `ReceiptJSON` object and inject it explicitly into `appzap-pos-api-v1` (via HTTP POST) or `appzap-pos-api-v2` (via MongoDB `$insert` or Server-to-Server Socket).

## Backend Implementation Checklist
- [ ] **QR Service Class:** Build `BCELGenerateGateway.ts` mapped to BCEL's cryptographic generation specs.
- [ ] **Resilient Webhook Receiver:** Write `/webhooks/bcel/callback`. Implement a distributed lock (e.g., `redis.setnx()`) using the `transactionId` to absolutely guarantee two simultaneous concurrent webhook pings cannot both execute the POS injection logic.
- [ ] **POS Interpreter:** Build the `POSDeliveryService.js`. If the restaurant is V1, map the payload to the legacy V1 order schema. If V2, map seamlessly to the new unified order schema.
