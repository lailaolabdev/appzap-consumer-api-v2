# API Feature 12: Core Cart Engine & Price Mathematics

## The Problem
This is the most dangerous Read/Write overlap on the platform. The Flutter mobile app allows users to configure a Bowl of Noodles, select "Extra Meat" (+15,000 LAK), and dictate quantities. AppZap cannot trust the mobile app to perform checkout math. The backend must strictly intercept the raw nested Item payload, hit the Read-Cache for the exact validated Prices of those modifiers, re-calculate the massive floating-point total server side, and store the validated numeric outcome.

## Data Models & Schema
- `CartSessionModel`: (Heavily structured JSON mapping)
  - `userId` (Ref)
  - `restaurantId` (Ref)
  - `orderType` (Enum: 'DINE_IN', 'TAKEAWAY', 'DELIVERY')
  - `deliveryAddressId` (Ref - Required ONLY if `orderType === 'DELIVERY'`)
  - `items`: [ `{ menuItemId, quantity, selectedModifiers: [ { modifierGroupId, optionId } ] }` ]
  - `serverCalculatedTotal` (Number)

## Restful Endpoints
- **`POST /api/v1/cart/sync`**
  - **Auth:** Bearer Token
  - **Action:** Sent continuously by the Mobile App as the user modifies their active bag. Overwrites the previous session state.

## CQRS & Security Strategy
- **Blind Math Re-calculation:** The frontend payload will *not* contain prices. When the Node backend receives `item: 123` and `modifier: 456`, it must violently query `ConsumerRestaurantCache` to definitively determine the physical LAK cost of those explicit entity references.
- **Mandatory Constraint Checking:** The backend loop must structurally evaluate the nested arrays. If a `ModifierGroup` is flagged as `isRequired: true`, and the incoming JSON payload string omits selections for that group, the API must instantly return a `400 Bad Request`.
- **Order Type Validation:** The backend must explicitly reject the sync payload if `orderType` is missing, or if `orderType === 'DELIVERY'` but no `deliveryAddressId` is provided.

## Backend Implementation Checklist
- [ ] **Schema Rigidity:** Define the intricate schemas required to hold the deeply nested `MenuItem -> Group -> ChildModifiers` hierarchical structures safely.
- [ ] **The Math Engine:** Write the `calculateCartTotal(items)` architectural service that structurally compares incoming IDs against the Read-Only Cache to establish the numeric truth.
- [ ] **Sync Controller:** Build the `/cart/sync` route securely executing atomic Upsert actions mapped identically against the requester's active User ID.
