#!/bin/bash

# AppZap Consumer API - Environment File Generator
# Run this script to create your .env file

cat > .env << 'EOF'
# ============================================================================
# SERVER
# ============================================================================
PORT=9000
NODE_ENV=development
CONSUMER_API_URL=http://localhost:9000

# ============================================================================
# DATABASE
# ============================================================================
MONGODB_URI=mongodb://localhost:27017/appzap_consumer_dev

# ============================================================================
# REDIS
# ============================================================================
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_CACHE_TTL=300
REDIS_TOKEN_TTL=86400

# ============================================================================
# JWT
# ============================================================================
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
JWT_ACCESS_EXPIRY=24h
JWT_REFRESH_EXPIRY=30d

# ============================================================================
# EXTERNAL APIs - CONFIGURE THESE TO FIX FAILING TESTS
# ============================================================================

# Auth API (GraphQL) - Contact: Backend Team
AUTH_API_URL=https://auth.lailaolab.com

# POS V2 API (REST) - Contact: POS API Team
POS_V2_API_URL=http://localhost:8080
POS_V2_API_KEY=

# Supplier API (REST) - Contact: Supplier Team
SUPPLIER_API_URL=
SUPPLIER_EXCHANGE_KEY=

# ============================================================================
# PAYMENT GATEWAY (Optional)
# ============================================================================
PHAPAY_MERCHANT_ID=
PHAPAY_SECRET_KEY=
PHAPAY_WEBHOOK_SECRET=
PHAPAY_API_URL=https://payment.phapay.com

# ============================================================================
# FIREBASE (Optional - for push notifications & deep links)
# ============================================================================
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
FIREBASE_API_KEY=
FIREBASE_DYNAMIC_LINK_DOMAIN=https://appzap.page.link

# ============================================================================
# SECURITY
# ============================================================================
ENCRYPTION_KEY=your-32-character-encryption-key-here-change-me

# ============================================================================
# RATE LIMITING
# ============================================================================
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
OTP_RATE_LIMIT_MAX=3
OTP_RATE_LIMIT_WINDOW_MS=300000

# ============================================================================
# MONITORING & LOGGING
# ============================================================================
SENTRY_DSN=
LOG_LEVEL=info
EOF

echo "✅ .env file created successfully!"
echo ""
echo "⚠️  IMPORTANT: Edit .env and fill in these required values:"
echo "   1. POS_V2_API_URL and POS_V2_API_KEY (for restaurant data)"
echo "   2. SUPPLIER_API_URL and SUPPLIER_EXCHANGE_KEY (for market products)"
echo "   3. AUTH_API_URL (already set, but verify it's correct)"
echo ""
echo "📖 See ENV_SETUP.md for detailed instructions"
echo ""
echo "🧪 After configuring, run: npm test"

