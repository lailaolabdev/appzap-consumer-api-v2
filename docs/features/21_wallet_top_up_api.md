# API Feature 15: AppZap Virtual Wallet Ledger Engine

## The Problem
Users must be able to convert BCEL Fiat into native 'AppZap Credits' to avoid micro-transaction fees on future orders. The Backend API must act as an ironclad bank ledger. If a user tries to spend 50,000 LAK simultaneously on two different devices, the API must flawlessly block the race condition.

## Data Models & Schema
- `WalletModel`:
  - `userId` (Ref - Unique)
  - `balance` (Number)
  - `currency` (String: 'LAK')
- `WalletLedgerEntry`: (Immutable Audit Trail)
  - `walletId` (Ref)
  - `transactionType` (Enum: 'TOP_UP', 'PURCHASE', 'REFUND', 'ADMIN_ADJUST')
  - `amount` (Number - Positive or Negative)
  - `balanceAfter` (Number)

## Restful Endpoints
- **`POST /api/v1/wallet/topup/generate`**
  - **Action:** Generates a BCEL QR explicitly routed to a "Top Up" webhook handler, rather than a Restaurant Order handler.
- **`POST /api/v1/wallet/spend`**
  - **Action:** Directly deducts the user's explicit balance to finalize a Cart.

## Database Integrity Strategy
- **MongoDB Transactions (ACID):** Standard sequential code (`const user = await DB.find() ... user.balance -= 500 ... await user.save()`) is mathematically catastrophic under concurrency. 
- You MUST use MongoDB `$inc` operators. 
- Better yet, when executing a Wallet Spend simultaneously with a POS Injection (Feature 13), wrap both operations inside a `session.startTransaction()`. If the POS Injection fails, the Wallet Spend automatically rolls back, preventing lost money.

## Backend Implementation Checklist
- [ ] **Ledger Schema enforcement:** Build the immutable `WalletLedgerEntry`. Every single transaction modifying the explicit `WalletModel.balance` scalar *must* insert a log row describing the math.
- [ ] **Concurrency Locks:** Write the `/spend` controller. Use the explicit atomic query: `WalletModel.findOneAndUpdate({ userId: id, balance: { $gte: cartTotal } }, { $inc: { balance: -cartTotal } })`. If this returns `null`, the user does not have enough money—preventing race conditions instantly.
- [ ] **Admin Refund Tooling:** Expose a secure endpoint strictly for SuperAdmins granting access to execute `ADMIN_ADJUST` payloads to fix customer service disputes.
