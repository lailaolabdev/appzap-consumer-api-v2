# API Feature 15: Cross-Cluster SSO (AppZap Market Integration)

## The Problem
AppZap Eat consumers also need to buy groceries on AppZap Market (a physically separate backend codebase running on `appzap-supplier-api-prod`). 
The Consumer API must securely proxy their authenticated session across the cluster without forcing the user to log in twice.

## CQRS & Distributed Authentication Strategy
- **Symmetric Keys:** Both `appzap_consumer_api_v2` and `appzap-supplier-api-prod` must share a highly protected `INTERNAL_CLUSTER_SECRET` inside their `.env` files. 
- **The SSO Handshake:** When the user enters their OTP successfully on AppZap Eat, the Eat API uses the `INTERNAL_CLUSTER_SECRET` to sign a specialized Server-to-Server Header. It sends an HTTP POST containing the user's `{ phone, nickname }` to the Supplier API instance.
- **The Mint:** The Supplier API sees the verified cluster secret, trusts the payload, instantly upserts the User into its own database, mints a fresh Market JWT, and returns it to the Eat API.
- **The Handback:** The Eat API returns the final hybrid payload to the Flutter Application: `{"tokens": {"eat": "ey...", "market": "ey..."}}`.

## Backend Implementation Checklist
- [ ] **Consumer API OTP Upgrades:** Modify `src/controllers/auth.controller.ts` to execute the outbound Axios/Fetch request to the Supplier API strictly *before* returning the final response to the mobile client.
- [ ] **Supplier API Webhook:** In the Market codebase (`appzap-supplier-api-prod`), create a totally private endpoint explicitly rejecting all traffic *unless* the strict `X-Cluster-Auth` header matches the `.env` scalar.
- [ ] **Failure Handling:** If the Supplier API is down (returns 500), the Consumer API must gracefully catch the error, log it to Google Analytics (Feature 01), but *still allow the user to log into AppZap Eat*. The Flutter app simply hides the "Switch to Market" button for that session.
