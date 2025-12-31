# Environment Configuration Guide

## Required External APIs

To make all tests pass and enable full functionality, you need to configure these external APIs in your `.env` file:

---

## 📝 **How to Set Up**

### Step 1: Create `.env` file

```bash
cp ENV_SETUP.md .env
# Then edit .env with your actual values
```

### Step 2: Configure External APIs

---

## 🔑 **Critical External APIs** (Currently causing test failures)

### 1. **Auth API** (GraphQL)
**Purpose:** User authentication, OTP verification

```bash
AUTH_API_URL=https://auth.lailaolab.com
```

**Where to get it:**
- Contact your backend/auth team
- Default: `https://auth.lailaolab.com`
- Current issue: GraphQL schema mismatch

**Tests affected:**
- ❌ `POST /api/v1/auth/request-otp`

---

### 2. **POS V2 API** (REST)
**Purpose:** Restaurant data, menus, order syncing

```bash
POS_V2_API_URL=http://localhost:8080
POS_V2_API_KEY=your-api-key-here
```

**Where to get it:**
- Contact POS API team
- If running locally: `http://localhost:8080`
- Production: Get from DevOps

**Tests affected:**
- ❌ `GET /api/v1/eats/restaurants`

---

### 3. **Supplier API** (REST)
**Purpose:** Market products, categories, inventory

```bash
SUPPLIER_API_URL=https://supplier-api.example.com
SUPPLIER_EXCHANGE_KEY=your-exchange-key-here
```

**Where to get it:**
- Contact Supplier API team
- Get exchange key from API documentation

**Tests affected:**
- ❌ `GET /api/v1/market/products`
- ❌ `GET /api/v1/market/categories`
- ❌ Performance: Product pagination test

---

## 📋 **Complete .env Template**

Create a `.env` file in the project root:

```bash
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

# ============================================================================
# JWT
# ============================================================================
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this
JWT_ACCESS_EXPIRY=24h
JWT_REFRESH_EXPIRY=30d

# ============================================================================
# EXTERNAL APIs (REQUIRED FOR TESTS TO PASS)
# ============================================================================

# Auth API
AUTH_API_URL=https://auth.lailaolab.com

# POS V2 API
POS_V2_API_URL=http://localhost:8080
POS_V2_API_KEY=your-pos-api-key

# Supplier API
SUPPLIER_API_URL=https://supplier-api.example.com
SUPPLIER_EXCHANGE_KEY=your-exchange-key

# ============================================================================
# OPTIONAL (For full feature support)
# ============================================================================

# Payment Gateway
PHAPAY_MERCHANT_ID=your-merchant-id
PHAPAY_SECRET_KEY=your-secret-key
PHAPAY_WEBHOOK_SECRET=your-webhook-secret
PHAPAY_API_URL=https://payment.phapay.com

# Firebase (Push notifications & Deep links)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_API_KEY=your-api-key
FIREBASE_DYNAMIC_LINK_DOMAIN=https://appzap.page.link

# Security
ENCRYPTION_KEY=your-32-char-encryption-key

# Monitoring
SENTRY_DSN=https://your-dsn@sentry.io/project
LOG_LEVEL=info
```

---

## 🔍 **How to Get API Credentials**

### Auth API
1. Contact: **Backend Team / Auth Service Team**
2. Ask for: GraphQL endpoint URL
3. Documentation: Check Auth API GraphQL schema

### POS V2 API
1. Contact: **POS API Team**
2. Ask for: REST API URL + API Key
3. Check: `appzap-pos-api-v2` repository

### Supplier API
1. Contact: **Supplier Integration Team**
2. Ask for: API URL + Exchange Key
3. Documentation: Supplier API docs

---

## 🧪 **Testing Without External APIs**

If you don't have access to external APIs yet:

**Current Status:**
- ✅ **27/32 tests passing** (84% pass rate)
- ❌ 5 tests failing (all external API related)

**Working Features:**
- ✅ All internal endpoints
- ✅ Database operations
- ✅ Redis caching
- ✅ Authentication middleware
- ✅ Rate limiting
- ✅ Error handling
- ✅ Live product (meal plans, supplements)
- ✅ Deep links & gamification
- ✅ Bookings
- ✅ Identity linking

**Failing Features** (need external APIs):
- ❌ OTP authentication (Auth API)
- ❌ Restaurant listings (POS API)
- ❌ Market products (Supplier API)

---

## 🚀 **Quick Start**

1. **Copy this template to `.env`**
2. **Fill in at minimum:**
   - `MONGODB_URI`
   - `REDIS_URL`
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`

3. **Add external APIs as you get credentials:**
   - Start with `AUTH_API_URL`
   - Then `POS_V2_API_URL`
   - Finally `SUPPLIER_API_URL`

4. **Run tests:**
   ```bash
   npm test
   ```

---

## 📞 **Who to Contact**

| API | Team | Slack Channel | Priority |
|-----|------|---------------|----------|
| Auth API | Backend Team | `#backend-auth` | High |
| POS V2 API | POS Team | `#pos-integration` | High |
| Supplier API | Supply Chain | `#supplier-api` | High |
| Phapay | Finance | `#payments` | Medium |
| Firebase | DevOps | `#firebase-setup` | Medium |

---

## ✅ **Verification**

After adding credentials, verify:

```bash
# Run tests
npm test

# Expected: All 32 tests should pass
# Tests: 32 passed, 32 total
```

---

## 🔒 **Security Notes**

1. ⚠️ **NEVER commit `.env` to git**
2. ✅ `.env` is in `.gitignore`
3. 🔐 Use different credentials for dev/staging/prod
4. 🔑 Rotate secrets regularly
5. 📝 Document API access in your team wiki

---

## Need Help?

- Check existing APIs: `/Users/maxbookpro/workspace/project/appzap-project-premium/appzap-pos-api-v2`
- Review POS API config for reference
- Ask in `#appzap-dev` Slack channel

