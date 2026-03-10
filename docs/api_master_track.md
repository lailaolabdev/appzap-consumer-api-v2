# AppZap Consumer API V2 - Master Implementation Tracking

This document serves as the master tracking hub for backend engineering on `appzap_consumer_api_v2`. Every feature mirrors the Consumer Mobile App requirements but is strictly focused on Database schemas, CQRS routing, Redis caching, and POS synchronization.

---

## 🚀 PHASE 1: Acquisition, Tracking, & Discovery (Read-Heavy)
_Focus: Building the robust MongoDB/Redis caching layers to handle massive consumer read traffic without touching the physical POS APIs._

- [ ] **[Feature 01: Telemetry & Crash Logging](features/01_google_analytics_api.md)**
- [ ] **[Feature 02: Force Update Boot payload](features/02_force_update_api.md)**
- [ ] **[Feature 03: Web-to-Native Cart Hydration](features/03_web_mobile_connect_api.md)**
- [ ] **[Feature 04: OTP Authentication & Demographic Profiles](features/04_authentication_api.md)**
- [ ] **[Feature 05: FCM Notification Target Dispatcher](features/05_notifications_api.md)**
- [ ] **[Feature 06: AI Smart Search Vector Engine](features/06_restaurant_browse_api.md)**
- [ ] **[Feature 07: Admin Promoted Restaurants Feed](features/07_recommend_restaurants_api.md)**
- [ ] **[Feature 08: Global POS Promotions Aggregator](features/08_promotions_api.md)**
- [ ] **[Feature 09: POS Reviews & Moderation Sync](features/09_ratings_reviews_api.md)**
- [ ] **[Feature 10: Ad Delivery & Tracking Engine](features/10_ads_management_api.md)**
- [ ] **[Feature 11: Live Events Feed & Expiration](features/11_live_events_api.md)**
- [ ] **[Feature 12: Core Cart Math & Session Memory](features/12_core_ordering_api.md)**
- [ ] **[Feature 13: QR Payload Resolver & POS Routing](features/13_qr_menu_scan_api.md)**
- [ ] **[Feature 14: Profile Integrity & Account Deletion](features/14_profile_security_api.md)**
- [ ] **[Feature 15: Cross-Cluster SSO (AppZap Market Integration)](features/15_appzap_market_sso_api.md)**
- [ ] **[Feature 16: Live Song Request Protocol & Socket Injector](features/16_song_requests_api.md)**

---

## 💳 PHASE 2: Transactions, Payments & Peripheral Services (Write-Heavy)
_Focus: The rigid CQRS injection of finalized data into the POS V1/V2 systems natively, strict math validation, and BCEL Webhook security._

- [ ] **[Feature 17: Payments, BCEL Webhooks, & POS Injection](features/17_payments_api.md)**
- [ ] **[Feature 18: Socket.io Restaurant Status Tracking](features/18_order_tracking_api.md)**
- [ ] **[Feature 19: AppZap Virtual Wallet Ledger](features/19_wallet_top_up_api.md)**
- [ ] **[Feature 20: Cryptographic Coupon Validation](features/20_coupons_api.md)**
- [ ] **[Feature 21: Loyalty Point Math Generics](features/21_loyalty_points_api.md)**
- [ ] **[Feature 22: Bill Splitting Logic & Fractional Carts](features/22_bill_split_api.md)**
- [ ] **[Feature 23: Geospatial Delivery Distance Math](features/23_market_api.md)**
- [ ] **[Feature 24: P2P Atomic Wallet Transfers](features/24_gifting_api.md)**
- [ ] **[Feature 25: RNG Gamification Algorithms](features/25_gamification_api.md)**
- [ ] **[Feature 26: POS V1/V2 Reservation Queuing](features/26_reservations_api.md)**
- [ ] **[Feature 27: 3rd Party Hotel API Aggregation](features/27_hotel_booking_api.md)**
- [ ] **[Feature 28: Event Ticket QR Validation Tool](features/28_event_ticketing_api.md)**
- [ ] **[Feature 29: WebSockets In-Restaruant Chat & Live Gifting](features/29_in_app_chat_api.md)**
