# API Feature 20: Peer-to-Peer Wallet Transfers

## The Problem
Ecosystem users want to send AppZap Wallet balances directly to their friends' phone numbers. The API must execute this transfer instantly, but more crucially, it must act like a Federal Bank. If the server crashes mid-transfer, it absolutely cannot deduct funds from Sender A without crediting Receiver B, or accidentally duplicate the money.

## Data Models & Schema
- `P2PTransferLogModel`:
  - `senderId` (Ref)
  - `receiverId` (Ref)
  - `fiatAmount` (Number)
  - `status` (Enum: 'SUCCESS', 'CANCELLED_NSF')

## Restful Endpoints
- **`POST /api/v1/wallet/transfer/execute`**
  - **Auth:** Bearer Token (Must require an explicit secondary PIN string if Wallet Security is enabled).
  - **Payload:** `{ "targetPhone": "+85620...", "amount": 50000 }`

## Atomic Transaction Strategy (CRITICAL)
- **The Deadlock Problem:** You cannot use standard Mongoose `findByIdAndUpdate()`. If User A is sending 50k to User B, but User B is simultaneously sending 10k to User C, a race condition will corrupt the balance scalar.
- **The Only Valid Syntax:** The backend explicit must declare a `mongoose.startSession()`, execute `session.startTransaction()`, perform exact `$inc` operations against both Wallets simultaneously natively inside the transaction wrapper, and execute `await session.commitTransaction()`. If any single node in the replica set drops during this millisecond window, MongoDB automatically fires `session.abortTransaction()`, permanently protecting both balances.

## Backend Implementation Checklist
- [ ] **Replica Set Configuration:** MongoDB *strictly requires* standard Replica Sets (not standalone single-node deployments) to perform ACID Multi-Document Transactions. Verify the `MONGODB_URI` string correctly points to a replica cluster.
- [ ] **Transactional Controller:** Write the explicit `session.withTransaction()` block.
- [ ] **Velocity Fraud Checks:** Hardcode an implicit barrier into the controller preventing a single user from executing more than 5 transfers per 60 seconds, thwarting algorithmic P2P spam scripts designed to test the database lock constraints.
