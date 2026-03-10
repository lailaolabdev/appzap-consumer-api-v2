# API Feature 16: Live Song Request Protocol & Socket Injector

## The Problem
Restaurants utilizing POS V2 have live bands playing. Consumers want to request songs natively on their phones and tip the band using LAK. The backend must orchestrate this request seamlessly onto the band's physically separate iPad hardware running the POS software.

## Data Models & Schema
- `SongRequestModel`:
  - `restaurantId` (Ref)
  - `userId` (Ref)
  - `tableId` (Ref - To show the band who sent it)
  - `trackName` (String)
  - `tipAmount` (Number - Fiat)
  - `status` (Enum: 'QUEUE', 'PLAYING', 'COMPLETED', 'REJECTED')
  - `submittedAt` (Date)
- `EntertainmentConfigCache`: (Flattened schema)
  - `restaurantId` (Ref)
  - `hasLiveBandTonight` (Boolean)
  - `activeBandName` (String)

## Restful Endpoints
- **`GET /api/v1/entertainment/band-status?restaurantId=123`**
  - **Auth:** Public
  - **Response:** Reads the Redis cache to tell the Flutter app if it should render the "Song Request" UI tab.
- **`POST /api/v1/entertainment/request-song`**
  - **Auth:** Bearer Token
  - **Payload:** `{ trackName: "A Thousand Years", tipAmount: 50000, tableId: "A4" }`

## Escrow & Socket Strategy (CRITICAL)
- **The Pre-Authorization Escrow:** The `/request-song` controller CANNOT completely deduct the User's Wallet balance (Feature 17). What if the band rejects the song? 
  - Instead, the backend uses `session.startTransaction()`, drops the user's `Wallet.balance` by 50,000, and equally increments a temporary `Wallet.escrowLine` scalar by 50,000.
- **The Live Socket Injection:** Once the MongoDB `SongRequestModel` is created, the Node.js backend executes `redisSocketAdapter.to('POS_V2_REST_123').emit('SONG_REQUEST', { payload })`. This instantly rings the physical iPad.
- **The POS Callback Webhook:** The POS iPad hits a backend route: `POST /api/v1/internal/entertainment/resolve` with `{ requestId, action: 'ACCEPT' }`. 
  - If `ACCEPT`: Escrow translates to permanent deduction, funds move to Restaurant Ledger.
  - If `REJECT`: Escrow is reversed instantly into the consumer Wallet balance.

## Backend Implementation Checklist
- [ ] **Wallet Escrow Logic:** Expand the Wallet math engine to safely lock funds without destroying them permanently beforehand.
- [ ] **Socket Broadcaster:** Ensure the explicit `redisAdapter.emit` is perfectly scoped to the unique `restaurantId` so songs requested in Cafe A don't ring the iPad in Bar B.
- [ ] **Auto-Refund CronJob:** Write a script that runs every night at 4:00 AM. Any `SongRequestModel` still sitting in `status: QUEUE` because the band went home before clicking Accept must be forcefully resolved to `REJECTED`, refunding all users their escrowed money.
