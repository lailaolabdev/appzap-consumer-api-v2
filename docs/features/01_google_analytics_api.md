# API Feature 01: Telemetry & Crash Logging Routing

## The Problem
While the Flutter mobile app pushes data to Google Analytics (GA) and Crashlytics, the Backend API (`appzap_consumer_api_v2`) must also act as a resilient data pipeline to log critical system failures that prevent the consumer from checking out (e.g., BCEL timeouts, Redis crashes) so the Admin Dashboard can visualize platform health.

## Data Models & Schema
- No new MongoDB schemas required. Logs should be handled via ELK stack or purely transmitted to GCP/Firebase Logging.

## CQRS & Infrastructure Strategy
- **Logging Gateway:** The API must run a globally scoped Winston/Morgan logging middleware.
- **Error Injection:** Any `500 Internal Server Error` returned to the consumer *must* autonomously trigger an alert payload pushed to the system's observability tool (e.g., Sentry or direct GA Event) capturing the exact User ID and the failing stack trace.

## Backend Implementation Checklist
- [ ] **Global Error Handler:** Verify `src/middleware/errorHandler.ts` correctly pipes `err.stack` and `req.user.id` into the structured logging engine.
- [ ] **Sentry/GCP Integrations:** Ensure the environment variables (`SENTRY_DSN` or GCP Credentials) are cleanly loaded during PM2 cluster boot.
- [ ] **Sanitization:** Aggressively strip any PII (Passwords, OTPs, BCEL QR Strings) from the request body *before* the logger transmits the payload to external telemetry services.
