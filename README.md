# 🚀 AppZap Consumer API - Phases 1, 2, & 3 Complete

**Production-ready Consumer API for AppZap Super App**

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-green.svg)](https://www.mongodb.com/)
[![Redis](https://img.shields.io/badge/Redis-7.x-red.svg)](https://redis.io/)
[![Bull](https://img.shields.io/badge/Bull-4.x-orange.svg)](https://github.com/OptimalBits/bull)

---

## 🎉 **Complete Feature Set**

### ✅ **Phase 1: Foundation & Authentication**

- OTP login (proxy to Auth API)
- JWT token generation (access + refresh with rotation)
- User management and profile switching (Personal/Merchant)
- Helmet.js security headers
- Rate limiting with Redis
- MongoDB with Mongoose ODM
- User model with loyalty points
- Redis for caching & sessions
- Socket.io infrastructure
- Structured logging with Winston
- Docker & Docker Compose setup

### ✅ **Phase 2: Eats Product**
- Restaurant discovery with filtering & search
- Shopping cart with auto-expiry (TTL)
- Order processing with POS V2 sync
- Phapay payment integration
- Loyalty points system (earn/redeem)
- WebSocket live bills with Redis adapter
- Table booking system
- Real-time order tracking
- Payment webhooks
- **17 Endpoints**

### ✅ **Phase 3: Market Product**
- Product catalog with B2C/B2B pricing
- Dynamic pricing (retail/wholesale)
- Market cart & checkout
- Market orders with supplier sync
- Recurring subscriptions (auto-generation)
- Identity linking (B2C ↔ B2B)
- Delivery address management
- Bull queue workers (subscription orders, supplier sync)
- Profile switching with instant price updates
- **34 Endpoints**

### ✅ **Phase 4: Live Product (Schema Ready)** 🍽️
- Health Profile with dietary preferences
- Meal Plan catalog with nutrition tracking
- Supplements catalog
- Meal Subscription with auto-generation
- BMI & calorie calculation
- Compatibility checking
- **13 Endpoints** (Basic CRUD)

### ✅ **Phase 5: Deep Linking & Gamification** 🎰
- Firebase Dynamic Links integration
- Beautiful web-to-app landing pages
- Spin-to-Win rewards system (beer, discounts, points)
- Push notifications (FCM)
- Attribution tracking & analytics
- Automatic deep link creation for all orders
- QR code generation
- Campaign management
- **12 Endpoints**

---

## 📊 **Project Stats**

- **Total API Endpoints:** 82
- **Database Models:** 16
- **External Integrations:** 5 (Auth API, POS V2, Supplier API, Phapay, Firebase)
- **Queue Workers:** 2 active (5 queues configured)
- **Products Supported:** Eats, Market, Live (schema ready)
- **User Types:** B2C (Personal), B2B (Merchant)
- **Gamification:** Spin-to-Win with 5 reward types
- **Health Features:** Profile, meal plans, supplements

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│     Flutter Mobile App (Client)        │
└──────────────┬──────────────────────────┘
               │ JWT Bearer Auth
               ▼
┌──────────────────────────────────────────┐
│  Consumer API (Express + TypeScript)     │
│  ┌────────────────────────────────────┐ │
│  │  Rate Limiting (Redis)             │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │  Authentication Controller         │ │
│  │  - OTP (proxy to Auth API)         │ │
│  │  - JWT tokens                      │ │
│  │  - Profile switching               │ │
│  └────────────────────────────────────┘ │
└─────┬──────────────┬─────────────────────┘
      │              │
      ▼              ▼
┌──────────┐    ┌──────────┐
│ MongoDB  │    │  Redis   │
│ (Data)   │    │ (Cache)  │
└──────────┘    └──────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20.x or higher
- Docker & Docker Compose (recommended)
- MongoDB 7.0+ (if not using Docker)
- Redis 7.x (if not using Docker)

### Option 1: Docker (Recommended)

```bash
# Clone the repository
cd /Users/maxbookpro/workspace/project/appzap-project-premium/appzap_consumer_api_v2

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env

# Start all services (API + MongoDB + Redis)
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

### Option 2: Local Development

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env

# Start MongoDB (separate terminal)
mongod

# Start Redis (separate terminal)
redis-server

# Run in development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

---

## 🔧 Environment Variables

Create a `.env` file in the root directory:

```env
# Server
PORT=9000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/appzap_consumer_dev
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Secrets (Generate with: openssl rand -hex 32)
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here

# External APIs
AUTH_API_URL=https://auth.lailaolab.com
POS_V2_API_URL=http://localhost:8080
SUPPLIER_API_URL=https://ry5bw19rok.execute-api.ap-southeast-1.amazonaws.com
SUPPLIER_EXCHANGE_KEY=your-exchange-key-here

# Base URL
CONSUMER_API_URL=http://localhost:9000
```

---

## 📡 API Endpoints

### Health Check

```bash
# Basic health check
curl http://localhost:9000/health

# Detailed health check (with dependencies)
curl http://localhost:9000/health/detailed
```

### Authentication

#### 1. Request OTP

```bash
curl -X POST http://localhost:9000/api/v1/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "8562093352677",
    "platform": "APPZAP",
    "header": "AppZap"
  }'
```

#### 2. Verify OTP & Login

```bash
curl -X POST http://localhost:9000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "8562093352677",
    "otp": "123456"
  }'
```

Response:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "...",
    "phone": "8562093352677",
    "roles": ["consumer"],
    "activeProfile": "personal",
    "points": {
      "balance": 0,
      "tier": "bronze"
    }
  }
}
```

#### 3. Get Current User

```bash
curl http://localhost:9000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 4. Switch Profile (Personal/Merchant)

```bash
curl -X POST http://localhost:9000/api/v1/auth/switch-profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "profileType": "merchant"
  }'
```

#### 5. Refresh Token

```bash
curl -X POST http://localhost:9000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

#### 6. Logout

```bash
curl -X POST http://localhost:9000/api/v1/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 🗄️ Database Schema

### User Collection

```typescript
{
  phone: string;              // Unique phone number
  fullName?: string;
  email?: string;
  roles: string[];           // ['consumer', 'merchant_owner']
  activeProfile: string;     // 'personal' | 'merchant'
  merchantProfiles: [{
    restaurantId: string;
    restaurantName: string;
    role: string;            // 'owner' | 'manager'
    supplierCustomerId?: string;
  }];
  points: {
    balance: number;
    tier: string;            // 'bronze' | 'silver' | 'gold' | 'platinum'
    totalEarned: number;
    totalRedeemed: number;
  };
  supplierId?: string;       // Personal Supplier customer ID (B2C)
}
```

---

## 🔐 Security Features

### Rate Limiting

- **Global**: 100 requests/minute per IP
- **OTP Request**: 3 requests/5 minutes per phone
- **OTP Verify**: 5 attempts/10 minutes per phone
- **Payment**: 10 requests/minute per user

### JWT Token System

- **Access Token**: 24h expiry
- **Refresh Token**: 30d expiry with rotation
- Token storage in Redis for invalidation

### Security Headers (Helmet.js)

- XSS Protection
- Content Security Policy
- HSTS
- Frame Options

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

---

## 📊 Monitoring

### Logs

Logs are stored in the `logs/` directory:
- `error.log` - Error level logs only
- `combined.log` - All logs

Sensitive data (phone numbers, emails, tokens) are automatically masked.

### Health Check Endpoints

- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed with MongoDB & Redis status
- `GET /health/liveness` - Kubernetes liveness probe
- `GET /health/readiness` - Kubernetes readiness probe

---

## 🐳 Docker Commands

```bash
# Start all services
docker-compose up -d

# Start with development tools (Mongo Express, Redis Commander)
docker-compose --profile dev up -d

# View logs
docker-compose logs -f api
docker-compose logs -f mongodb
docker-compose logs -f redis

# Restart API service
docker-compose restart api

# Stop all services
docker-compose down

# Remove volumes (WARNING: Deletes all data)
docker-compose down -v

# Access MongoDB UI
# Open: http://localhost:8081 (admin/admin123)

# Access Redis UI
# Open: http://localhost:8082
```

---

## 🚧 Next Steps (Phase 2)

Phase 1 is **COMPLETE**. Ready for Phase 2 implementation:

- [ ] Eats product endpoints (restaurants, cart, orders)
- [ ] POS V2 API integration
- [ ] Phapay payment integration
- [ ] Loyalty points earning/redeeming
- [ ] WebSocket live bills

---

## 📝 Development Scripts

```bash
# Development
npm run dev              # Start with nodemon (auto-reload)

# Production
npm run build            # Compile TypeScript
npm start                # Start production server
npm run start:prod       # Start with PM2 cluster mode

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues

# Database
npm run migrate          # Run database migrations (TODO)
```

---

## 🤝 Team Information

**Backend Team**: 2-3 Engineers
**Timeline**: Phase 1 completed in 2 weeks
**Next Phase**: Phase 2 (Eats Product) - 2 weeks

---

## 📞 Support

For technical questions or issues:
- Check documentation in `/docs` folder
- Review API specification: `docs/2.consumer_api_doc.md`
- Review identity linking: `docs/6.consumer_api_identity_linking.md`

---

## ✅ Phase 1 Checklist

- [x] Project initialization
- [x] MongoDB + Redis configuration
- [x] User model & schemas
- [x] OTP authentication (proxy to Auth API)
- [x] JWT token system
- [x] Profile switching logic
- [x] Rate limiting with Redis
- [x] Error handling & logging
- [x] Health check endpoints
- [x] Docker & Docker Compose setup
- [x] Documentation

**Status**: ✅ **PRODUCTION READY**

---

Built with ❤️ by AppZap Team

