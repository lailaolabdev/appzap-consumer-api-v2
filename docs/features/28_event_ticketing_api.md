# API Feature 24: Event Ticket QR Validation Tool

## The Problem
Consumers buy Live Event Tickets (Feature 11). They show up at the physical festival gates. A completely separate iPad app (AppZap Scanner V1) scans the Consumer's QR code. The Backend API must intercept this scan, mathematically verify the QR integrity, and perfectly prevent duplicate entries (two people sharing screenshots of the same QR code).

## Data Models & Schema
- `EventTicketModel`:
  - `userId` (Ref)
  - `eventId` (Ref)
  - `ticketUuid` (Unique String ID - The core of the QR payload)
  - `isScanned` (Boolean - Default: false)
  - `scannedAt` (Date)

## Restful Endpoints
- **`POST /api/v1/tickets/validate-scan`**
  - **Auth:** Scanner App API Token (Not a Consumer Token)
  - **Payload:** `{ "qrPayload": "[Base64/UUID String]", "gateContext": "Gate A" }`

## Atomic Integrity Strategy
- **The Screenshot Exploit:** Two users with the exact same screenshot of `Ticket A` are standing in two different lines (`Gate A` and `Gate B`). They hand their phones to staff simultaneously. Both Scanner iPads hit `/validate-scan` at the exact same millisecond.
- **The Solution:** The backend *cannot* do `const ticket = findById(); if(!ticket.isScanned){ save() }`. It will fail the concurrency race condition.
- The endpoint must execute a singular atomic MongoDB Write: `const result = await EventTicketModel.findOneAndUpdate({ ticketUuid: payload, isScanned: false }, { $set: { isScanned: true, scannedAt: Date.now() } })`.
- If `result` returns `null`, the ticket was ALREADY scanned, and the API instantly returns a `403 Duplicate Entry / Action Denied` to explicitly blare a red siren on the iPad.

## Backend Implementation Checklist
- [ ] **Scanner API Route Group:** Create a logically isolated router exclusively for the physical gate hardware devices to authenticate cleanly against.
- [ ] **Atomic Verification Controller:** Write the robust `findOneAndUpdate` logic definitively preventing duplicate admittance exploits.
