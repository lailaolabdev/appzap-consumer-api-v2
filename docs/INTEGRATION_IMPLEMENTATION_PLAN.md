# AppZap Integration Implementation Plan

> **Objective**: Enable secure service-to-service communication between Consumer API V2 and both POS systems (V1 & V2)

---

## 📋 Executive Summary

### Current State (Updated: 2026-02-06)

| System | API Key Auth | Consumer Endpoints | Table Availability | Bill Split | Status |
|--------|-------------|-------------------|-------------------|------------|--------|
| POS V1 | ✅ Implemented | ✅ `/v5/consumer/*` | ✅ Implemented | ✅ Implemented | **Ready for testing** |
| POS V2 | ✅ Implemented | ✅ `/api/v1/consumer/*` | ✅ Implemented | ✅ Implemented | **Ready for testing** |
| Consumer API V2 | ✅ Configured | ✅ Adapters updated | ✅ Uses POS endpoints | ✅ Uses POS endpoints | Set API keys in .env |

> **🎉 ALL PHASES COMPLETED** - Full integration between Consumer API V2 and both POS systems is now implemented.

### Target State

```
┌─────────────────────────────────────────────────────────────────┐
│                     Consumer Mobile App                          │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Consumer API V2                             │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │  POS Router  │──│   Adapters   │──│ Restaurant Registry│    │
│  └──────────────┘  └──────────────┘  └────────────────────┘    │
└────────────┬────────────────────────────────────┬───────────────┘
             │                                    │
             │ X-API-Key: appzap_pos_live_sk_xxx  │ X-API-Key: appzap_pos_live_sk_yyy
             ▼                                    ▼
┌────────────────────────────┐    ┌────────────────────────────────┐
│         POS V1             │    │           POS V2               │
│  /consumer/* endpoints     │    │    /consumer/* endpoints       │
│  + apiKeyAuth middleware   │    │    + apiKeyAuth middleware     │
│  + Rate limiting (Redis)   │    │    + Rate limiting (Redis)     │
└────────────────────────────┘    └────────────────────────────────┘
```

---

## 🎯 Implementation Phases

### Phase Overview

| Priority | Task | Effort | Impact | Dependencies | Status |
|----------|------|--------|--------|--------------|--------|
| 🔴 **P0** | API Key Auth - POS V2 | 2 days | Critical | None | ✅ Done |
| 🔴 **P0** | API Key Auth - POS V1 | 2 days | Critical | None | ✅ Done |
| 🟠 **P1** | Consumer API routes - POS V2 | 2 days | Enables integration | P0 | ✅ Done |
| 🟠 **P1** | Consumer API routes - POS V1 | 1 day | Enables integration | P0 | ✅ Done |
| 🟡 **P2** | Table Availability - Both | 1 day | Required for reservations | P1 | ✅ Done |
| 🟡 **P2** | Reservations module - POS V2 | 2 days | New feature | P1 | ✅ Done |
| 🟢 **P3** | Split Bill API - Both | 2 days | Enhanced feature | P1 | ✅ Done |
| 🟢 **P3** | Consumer API adapter updates | 1 day | Final integration | All above | ✅ Done |

**🎉 ALL PHASES COMPLETE (13 days total)**

---

## 🔴 P0: API Key Authentication - POS V2

### Overview
Implement complete API Key authentication system following the documented pattern.

### Files to Create

```
appzap-pos-api-v2/
└── src/
    ├── features/
    │   └── api-keys/                         # NEW FOLDER
    │       ├── models/
    │       │   └── api-key.model.js          # MongoDB schema
    │       ├── services/
    │       │   └── api-key.service.js        # Business logic
    │       ├── controllers/
    │       │   └── api-key.controller.js     # HTTP handlers
    │       ├── routes/
    │       │   └── api-key.route.js          # Route definitions
    │       └── README.md                      # Documentation
    └── core/
        ├── middlewares/
        │   └── api-key-auth.js               # NEW FILE
        ├── utils/
        │   └── api-key-generator.js          # NEW FILE
        └── constants/
            └── api-key-scopes.js             # NEW FILE
```

### Step-by-Step Implementation

#### Step 1: Create API Key Generator Utility
**File**: `src/core/utils/api-key-generator.js`

```javascript
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

// Key format: appzap_pos_{live|test}_sk_{64-hex-chars}
export function generateApiKey(environment = 'production') {
  const secret = crypto.randomBytes(32).toString('hex')
  const env = environment === 'production' ? 'live' : 'test'
  const fullKey = `appzap_pos_${env}_sk_${secret}`
  const prefix = `appzap_pos_${env}_sk_`
  
  return { fullKey, secret, prefix, environment }
}

export function generateKeyId() {
  return `api_key_${crypto.randomBytes(16).toString('hex')}`
}

export async function hashApiKeySecret(secret) {
  return await bcrypt.hash(secret, 10)
}

export async function verifyApiKeySecret(secret, hash) {
  return await bcrypt.compare(secret, hash)
}

export function parseApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') return null
  
  const parts = apiKey.split('_')
  if (parts.length !== 5) return null
  
  const [brand, product, env, type, secret] = parts
  
  if (brand !== 'appzap' || product !== 'pos') return null
  if (!['live', 'test'].includes(env)) return null
  if (type !== 'sk') return null
  if (!secret || secret.length < 32) return null
  
  return {
    brand, product,
    environment: env === 'live' ? 'production' : 'sandbox',
    type, secret,
    prefix: `${brand}_${product}_${env}_${type}_`
  }
}

export function validateApiKeyFormat(apiKey) {
  const parsed = parseApiKey(apiKey)
  if (!parsed) {
    return { valid: false, error: 'Invalid API key format' }
  }
  return { valid: true, parsed }
}

export function maskApiKey(apiKey) {
  const parsed = parseApiKey(apiKey)
  if (!parsed) return '****'
  return `${parsed.prefix}****${parsed.secret.slice(-4)}`
}
```

#### Step 2: Create Scopes Constants
**File**: `src/core/constants/api-key-scopes.js`

```javascript
export const API_KEY_SCOPES = {
  // System-wide scopes (for Consumer API)
  'read:all-restaurants': 'Read all restaurants',
  'read:restaurant-details': 'Read restaurant details',
  'read:all-reservations': 'Read all reservations',
  'write:reservations': 'Create/update reservations',
  'consumer:search': 'Search restaurants',
  'consumer:book': 'Create bookings',
  'consumer:profile': 'Manage consumer profiles',
  
  // Restaurant-specific scopes
  'read:menu': 'Read menu items',
  'write:menu': 'Create/update menu',
  'read:orders': 'Read orders',
  'write:orders': 'Create/update orders',
  'read:tables': 'Read tables',
  'write:tables': 'Update tables',
  'read:transactions': 'Read transactions',
  'write:payments': 'Process payments',
  'read:customers': 'Read customers',
  'write:customers': 'Update customers',
  
  // Wildcard
  '*': 'Full access'
}

export const PRESET_SCOPES = {
  consumer_app: [
    'read:all-restaurants', 'read:restaurant-details',
    'read:menu', 'read:tables',
    'write:orders', 'read:orders',
    'write:reservations', 'read:all-reservations',
    'consumer:search', 'consumer:book', 'consumer:profile'
  ],
  readonly: ['read:menu', 'read:orders', 'read:tables', 'read:transactions'],
  pos_terminal: ['read:menu', 'write:orders', 'write:payments', 'read:customers'],
  admin: ['*']
}

export function isValidScope(scope) {
  return Object.keys(API_KEY_SCOPES).includes(scope)
}

export function validateScopes(scopes) {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    return { valid: false, error: 'At least one scope required' }
  }
  const invalid = scopes.filter(s => !isValidScope(s))
  if (invalid.length > 0) {
    return { valid: false, error: `Invalid scopes: ${invalid.join(', ')}` }
  }
  return { valid: true }
}

export function hasScope(apiKeyScopes, requiredScope) {
  if (apiKeyScopes.includes('*')) return true
  return apiKeyScopes.includes(requiredScope)
}

export function hasAnyScope(apiKeyScopes, requiredScopes) {
  if (apiKeyScopes.includes('*')) return true
  return requiredScopes.some(s => apiKeyScopes.includes(s))
}

export function isSystemWideScope(scope) {
  const systemScopes = [
    'read:all-restaurants', 'read:restaurant-details',
    'read:all-reservations', 'write:reservations',
    'consumer:search', 'consumer:book', 'consumer:profile'
  ]
  return systemScopes.includes(scope) || scope === '*'
}

export function requiresSystemAccess(scopes) {
  return scopes.some(s => isSystemWideScope(s))
}
```

#### Step 3: Create API Key Model
**File**: `src/features/api-keys/models/api-key.model.js`

Full schema as documented in `api_key_auth.md` (417 lines).

#### Step 4: Create API Key Middleware
**File**: `src/core/middlewares/api-key-auth.js`

Full implementation as documented in `api_key_auth.md` (323 lines).

#### Step 5: Create API Key Service
**File**: `src/features/api-keys/services/api-key.service.js`

Full implementation as documented in `api_key_auth.md` (560 lines).

#### Step 6: Create API Key Controller
**File**: `src/features/api-keys/controllers/api-key.controller.js`

Full implementation as documented in `api_key_auth.md` (430 lines).

#### Step 7: Create API Key Routes
**File**: `src/features/api-keys/routes/api-key.route.js`

```javascript
import express from 'express'
import { auth, authorize } from '../../../core/middlewares/auth.js'
import { apiKeyAuth } from '../../../core/middlewares/api-key-auth.js'
import { PERMISSIONS } from '../../../core/utils/permissions.js'
import controller from '../controllers/api-key.controller.js'

const router = express.Router()

// Scopes endpoint
router.get('/scopes', auth, controller.getScopes)

// Validate API key (uses apiKeyAuth)
router.get('/validate', apiKeyAuth, controller.validateApiKey)

// CRUD routes (require auth + permission)
router.route('/')
  .post(auth, authorize(PERMISSIONS.MANAGE_API_KEYS), controller.createApiKey)
  .get(auth, authorize(PERMISSIONS.MANAGE_API_KEYS), controller.getApiKeys)

router.route('/:id')
  .get(auth, authorize(PERMISSIONS.MANAGE_API_KEYS), controller.getApiKey)
  .patch(auth, authorize(PERMISSIONS.MANAGE_API_KEYS), controller.updateApiKey)
  .delete(auth, authorize(PERMISSIONS.MANAGE_API_KEYS), controller.deleteApiKey)

// Actions
router.post('/:id/revoke', auth, authorize(PERMISSIONS.MANAGE_API_KEYS), controller.revokeApiKey)
router.post('/:id/rotate', auth, authorize(PERMISSIONS.MANAGE_API_KEYS), controller.rotateApiKey)
router.get('/:id/stats', auth, authorize(PERMISSIONS.MANAGE_API_KEYS), controller.getApiKeyStats)

// System key management (super admin)
router.get('/pending', auth, authorize(PERMISSIONS.SUPER_ADMIN), controller.getPendingKeys)
router.get('/system', auth, authorize(PERMISSIONS.SUPER_ADMIN), controller.getSystemKeys)
router.post('/:id/approve', auth, authorize(PERMISSIONS.SUPER_ADMIN), controller.approveApiKey)
router.post('/:id/reject', auth, authorize(PERMISSIONS.SUPER_ADMIN), controller.rejectApiKey)

export default router
```

#### Step 8: Register Routes
**File**: `src/core/routes-index.js`

Add:
```javascript
import apiKeyRoute from "../features/api-keys/routes/api-key.route.js"

// In routes array:
{ path: "/api-keys", route: apiKeyRoute }
```

#### Step 9: Add Permission Constants
**File**: `src/core/utils/permissions.js`

Add:
```javascript
MANAGE_API_KEYS: 'manage_api_keys',
MANAGE_SYSTEM_API_KEYS: 'manage_system_api_keys',
APPROVE_API_KEYS: 'approve_api_keys',
```

### Testing Checklist
- [ ] Create API key via POST /api/v1/api-keys
- [ ] List API keys via GET /api/v1/api-keys
- [ ] Validate API key via GET /api/v1/api-keys/validate (with X-API-Key header)
- [ ] Test rate limiting (exceed limit, check 429 response)
- [ ] Test IP whitelisting
- [ ] Test key revocation
- [ ] Test key rotation

---

## 🔴 P0: API Key Authentication - POS V1

### Overview
Implement API Key authentication adapted for POS V1's CommonJS/JavaScript structure.

### Files to Create

```
appzap-app-api/
└── api/
    └── src/
        ├── models/
        │   └── apiKey.model.js              # NEW FILE
        ├── middlewares/
        │   └── apiKeyAuth.js                # NEW FILE
        ├── helper/
        │   └── apiKeyGenerator.js           # NEW FILE
        ├── config/
        │   └── apiKeyScopes.js              # NEW FILE
        ├── controllers/
        │   └── apiKey.controller.js         # NEW FILE
        ├── routes/
        │   └── apiKey.routes.js             # NEW FILE
        └── helper/
            └── connecting-redis.js          # MODIFY (enable Redis)
```

### Step-by-Step Implementation

#### Step 1: Enable Redis Connection
**File**: `api/src/helper/connecting-redis.js`

```javascript
const Redis = require('ioredis');

let redisClient = null;
let isRedisConnected = false;

const connectRedis = async () => {
  try {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: process.env.REDIS_DB || 0,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error('Redis: Max retries exceeded');
          return null;
        }
        return Math.min(times * 200, 2000);
      }
    });

    redisClient.on('connect', () => {
      isRedisConnected = true;
      console.log('✅ Redis connected');
    });

    redisClient.on('error', (err) => {
      isRedisConnected = false;
      console.error('❌ Redis error:', err.message);
    });

    await redisClient.ping();
    return redisClient;
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    return null;
  }
};

const getRedisClient = () => redisClient;
const isConnected = () => isRedisConnected;

module.exports = { connectRedis, getRedisClient, isConnected };
```

#### Step 2: Create API Key Generator
**File**: `api/src/helper/apiKeyGenerator.js`

```javascript
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Key format: appzap_pos_{live|test}_sk_{64-hex-chars}
function generateApiKey(environment = 'production') {
  const secret = crypto.randomBytes(32).toString('hex');
  const env = environment === 'production' ? 'live' : 'test';
  const fullKey = `appzap_pos_${env}_sk_${secret}`;
  const prefix = `appzap_pos_${env}_sk_`;
  
  return { fullKey, secret, prefix, environment };
}

function generateKeyId() {
  return `api_key_${crypto.randomBytes(16).toString('hex')}`;
}

async function hashApiKeySecret(secret) {
  return await bcrypt.hash(secret, 10);
}

async function verifyApiKeySecret(secret, hash) {
  return await bcrypt.compare(secret, hash);
}

function parseApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') return null;
  
  const parts = apiKey.split('_');
  if (parts.length !== 5) return null;
  
  const [brand, product, env, type, secret] = parts;
  
  if (brand !== 'appzap' || product !== 'pos') return null;
  if (!['live', 'test'].includes(env)) return null;
  if (type !== 'sk') return null;
  if (!secret || secret.length < 32) return null;
  
  return {
    brand, product,
    environment: env === 'live' ? 'production' : 'sandbox',
    type, secret,
    prefix: `${brand}_${product}_${env}_${type}_`
  };
}

function validateApiKeyFormat(apiKey) {
  const parsed = parseApiKey(apiKey);
  if (!parsed) {
    return { valid: false, error: 'Invalid API key format' };
  }
  return { valid: true, parsed };
}

function maskApiKey(apiKey) {
  const parsed = parseApiKey(apiKey);
  if (!parsed) return '****';
  return `${parsed.prefix}****${parsed.secret.slice(-4)}`;
}

module.exports = {
  generateApiKey,
  generateKeyId,
  hashApiKeySecret,
  verifyApiKeySecret,
  parseApiKey,
  validateApiKeyFormat,
  maskApiKey
};
```

#### Step 3: Create Scopes Config
**File**: `api/src/config/apiKeyScopes.js`

```javascript
const API_KEY_SCOPES = {
  'read:all-restaurants': 'Read all restaurants',
  'read:restaurant-details': 'Read restaurant details',
  'read:menu': 'Read menu items',
  'write:menu': 'Create/update menu',
  'read:orders': 'Read orders',
  'write:orders': 'Create/update orders',
  'read:tables': 'Read tables',
  'read:reservations': 'Read reservations',
  'write:reservations': 'Create reservations',
  'consumer:search': 'Search restaurants',
  'consumer:book': 'Create bookings',
  '*': 'Full access'
};

const PRESET_SCOPES = {
  consumer_app: [
    'read:all-restaurants', 'read:restaurant-details',
    'read:menu', 'read:tables',
    'write:orders', 'read:orders',
    'write:reservations', 'read:reservations',
    'consumer:search', 'consumer:book'
  ],
  readonly: ['read:menu', 'read:orders', 'read:tables'],
  admin: ['*']
};

function isValidScope(scope) {
  return Object.keys(API_KEY_SCOPES).includes(scope);
}

function validateScopes(scopes) {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    return { valid: false, error: 'At least one scope required' };
  }
  const invalid = scopes.filter(s => !isValidScope(s));
  if (invalid.length > 0) {
    return { valid: false, error: `Invalid scopes: ${invalid.join(', ')}` };
  }
  return { valid: true };
}

function hasScope(apiKeyScopes, requiredScope) {
  if (apiKeyScopes.includes('*')) return true;
  return apiKeyScopes.includes(requiredScope);
}

function hasAnyScope(apiKeyScopes, requiredScopes) {
  if (apiKeyScopes.includes('*')) return true;
  return requiredScopes.some(s => apiKeyScopes.includes(s));
}

module.exports = {
  API_KEY_SCOPES,
  PRESET_SCOPES,
  isValidScope,
  validateScopes,
  hasScope,
  hasAnyScope
};
```

#### Step 4: Create API Key Model
**File**: `api/src/models/apiKey.model.js`

```javascript
const mongoose = require('mongoose');
const { API_KEY_SCOPES } = require('../config/apiKeyScopes');

const apiKeySchema = mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  keyId: { type: String, required: true, unique: true, index: true },
  keyHash: { type: String, required: true },
  keyPrefix: { type: String, required: true, index: true },
  
  keyType: {
    type: String,
    enum: ['restaurant', 'system', 'partner'],
    default: 'restaurant',
    required: true
  },
  
  storeId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'Store',
    index: true
  },
  
  createdBy: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'UserApp',
    required: true
  },
  
  scopes: {
    type: [String],
    required: true,
    validate: {
      validator: function(scopes) {
        return scopes.every(scope => Object.keys(API_KEY_SCOPES).includes(scope));
      },
      message: 'Invalid scope detected'
    }
  },
  
  rateLimit: { type: Number, default: 1000, min: 1, max: 100000 },
  environment: { type: String, enum: ['production', 'sandbox'], default: 'production' },
  
  ipWhitelist: [{
    type: String,
    validate: {
      validator: (ip) => /^(\d{1,3}\.){3}\d{1,3}$/.test(ip),
      message: 'Invalid IP address'
    }
  }],
  
  lastUsedAt: { type: Date },
  lastUsedFrom: { type: String },
  usageCount: { type: Number, default: 0 },
  
  isActive: { type: Boolean, default: true, index: true },
  expiresAt: { type: Date, index: true },
  revokedAt: { type: Date },
  revokedBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'UserApp' },
  revokedReason: { type: String, maxlength: 500 },
  
  description: { type: String, maxlength: 500 },
  tags: [{ type: String, maxlength: 50 }]
}, { timestamps: true });

// Indexes
apiKeySchema.index({ storeId: 1, isActive: 1 });
apiKeySchema.index({ keyPrefix: 1, keyHash: 1 });

// Methods
apiKeySchema.methods.canBeUsed = function() {
  if (!this.isActive || this.revokedAt) return false;
  if (this.expiresAt && new Date() > this.expiresAt) return false;
  return true;
};

apiKeySchema.methods.hasScope = function(scope) {
  if (this.scopes.includes('*')) return true;
  return this.scopes.includes(scope);
};

apiKeySchema.methods.hasAnyScope = function(requiredScopes) {
  if (this.scopes.includes('*')) return true;
  return requiredScopes.some(scope => this.scopes.includes(scope));
};

apiKeySchema.methods.recordUsage = async function(ipAddress) {
  this.lastUsedAt = new Date();
  this.lastUsedFrom = ipAddress;
  this.usageCount += 1;
  return await this.save();
};

apiKeySchema.methods.revoke = async function(revokedBy, reason) {
  this.isActive = false;
  this.revokedAt = new Date();
  this.revokedBy = revokedBy;
  this.revokedReason = reason;
  return await this.save();
};

module.exports = mongoose.model('ApiKey', apiKeySchema);
```

#### Step 5: Create API Key Middleware
**File**: `api/src/middlewares/apiKeyAuth.js`

```javascript
const ApiKey = require('../models/apiKey.model');
const { parseApiKey, validateApiKeyFormat, verifyApiKeySecret } = require('../helper/apiKeyGenerator');
const { getRedisClient, isConnected } = require('../helper/connecting-redis');

function extractApiKey(req) {
  // 1. X-API-Key header (preferred)
  if (req.headers['x-api-key']) return req.headers['x-api-key'];
  
  // 2. API-Key header
  if (req.headers['api-key']) return req.headers['api-key'];
  
  // 3. Authorization: Bearer {api_key} (if starts with appzap_pos_)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token.startsWith('appzap_pos_')) return token;
  }
  
  return null;
}

const apiKeyAuth = async (req, res, next) => {
  try {
    const apiKey = extractApiKey(req);
    
    if (!apiKey) {
      return res.status(401).json({
        message: 'API key required',
        code: 'API_KEY_REQUIRED'
      });
    }
    
    // Validate format
    const formatValidation = validateApiKeyFormat(apiKey);
    if (!formatValidation.valid) {
      return res.status(401).json({
        message: formatValidation.error,
        code: 'INVALID_API_KEY_FORMAT'
      });
    }
    
    const parsed = formatValidation.parsed;
    
    // Look up by prefix
    const apiKeys = await ApiKey.find({
      keyPrefix: parsed.prefix,
      isActive: true
    }).populate('storeId');
    
    if (!apiKeys || apiKeys.length === 0) {
      return res.status(401).json({
        message: 'Invalid API key',
        code: 'INVALID_API_KEY'
      });
    }
    
    // Verify hash
    let matchedKey = null;
    for (const key of apiKeys) {
      const isValid = await verifyApiKeySecret(parsed.secret, key.keyHash);
      if (isValid) {
        matchedKey = key;
        break;
      }
    }
    
    if (!matchedKey) {
      return res.status(401).json({
        message: 'Invalid API key',
        code: 'INVALID_API_KEY'
      });
    }
    
    // Check usability
    if (!matchedKey.canBeUsed()) {
      return res.status(401).json({
        message: matchedKey.revokedAt ? 'API key revoked' : 'API key expired',
        code: 'API_KEY_INACTIVE'
      });
    }
    
    // Check IP whitelist
    if (matchedKey.ipWhitelist && matchedKey.ipWhitelist.length > 0) {
      const clientIp = req.ip || req.connection.remoteAddress;
      if (!matchedKey.ipWhitelist.includes(clientIp)) {
        return res.status(403).json({
          message: 'IP not whitelisted',
          code: 'IP_NOT_ALLOWED'
        });
      }
    }
    
    // Rate limiting with Redis
    if (isConnected()) {
      const redis = getRedisClient();
      const currentHour = Math.floor(Date.now() / 3600000);
      const rateLimitKey = `api_key:${matchedKey._id}:rate_limit:${currentHour}`;
      
      try {
        const requestCount = await redis.incr(rateLimitKey);
        if (requestCount === 1) {
          await redis.expire(rateLimitKey, 3600);
        }
        
        if (requestCount > matchedKey.rateLimit) {
          return res.status(429).json({
            message: `Rate limit exceeded. Limit: ${matchedKey.rateLimit}/hour`,
            code: 'RATE_LIMIT_EXCEEDED'
          });
        }
        
        res.setHeader('X-RateLimit-Limit', matchedKey.rateLimit);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, matchedKey.rateLimit - requestCount));
        res.setHeader('X-RateLimit-Reset', (currentHour + 1) * 3600000);
      } catch (err) {
        console.error('Redis rate limit error:', err.message);
      }
    }
    
    // Record usage (async)
    const clientIp = req.ip || req.connection.remoteAddress;
    matchedKey.recordUsage(clientIp).catch(err => {
      console.error('Failed to record API key usage:', err.message);
    });
    
    // Attach to request
    req.apiKey = matchedKey;
    req.apiKeyId = matchedKey._id;
    req.apiKeyScopes = matchedKey.scopes;
    req.keyType = matchedKey.keyType;
    req.authMethod = 'api_key';
    
    if (matchedKey.keyType === 'restaurant' && matchedKey.storeId) {
      req.storeId = matchedKey.storeId._id;
      req.store = matchedKey.storeId;
    } else {
      req.isSystemKey = true;
    }
    
    next();
    
  } catch (error) {
    console.error('API key auth error:', error);
    return res.status(500).json({
      message: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};

const requireScope = (...requiredScopes) => {
  return (req, res, next) => {
    if (!req.apiKey) {
      return res.status(401).json({
        message: 'API key authentication required',
        code: 'API_KEY_REQUIRED'
      });
    }
    
    if (!req.apiKey.hasAnyScope(requiredScopes)) {
      return res.status(403).json({
        message: `Missing required scope. Need one of: ${requiredScopes.join(', ')}`,
        code: 'INSUFFICIENT_SCOPE'
      });
    }
    
    next();
  };
};

// Dual auth: accepts JWT or API key
const authOrApiKey = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  // Check if it's a JWT token (AppZap format)
  if (authHeader && authHeader.startsWith('AppZap ') && !authHeader.includes('appzap_pos_')) {
    const { verifyToken } = require('./auth');
    return verifyToken(req, res, next);
  }
  
  // Otherwise try API key
  return apiKeyAuth(req, res, next);
};

module.exports = {
  apiKeyAuth,
  requireScope,
  authOrApiKey
};
```

#### Step 6: Create Routes and Controller
**File**: `api/src/routes/apiKey.routes.js`

```javascript
const { verifyToken } = require('../middlewares');
const { apiKeyAuth } = require('../middlewares/apiKeyAuth');
const controller = require('../controllers/apiKey.controller');

module.exports = (app) => {
  // Get available scopes
  app.get('/v5/api-keys/scopes', verifyToken, controller.getScopes);
  
  // Validate API key
  app.get('/v5/api-keys/validate', apiKeyAuth, controller.validateApiKey);
  
  // CRUD operations
  app.post('/v5/api-keys', verifyToken, controller.createApiKey);
  app.get('/v5/api-keys', verifyToken, controller.getApiKeys);
  app.get('/v5/api-keys/:id', verifyToken, controller.getApiKey);
  app.put('/v5/api-keys/:id', verifyToken, controller.updateApiKey);
  app.delete('/v5/api-keys/:id', verifyToken, controller.deleteApiKey);
  
  // Actions
  app.post('/v5/api-keys/:id/revoke', verifyToken, controller.revokeApiKey);
  app.post('/v5/api-keys/:id/rotate', verifyToken, controller.rotateApiKey);
  app.get('/v5/api-keys/:id/stats', verifyToken, controller.getApiKeyStats);
};
```

#### Step 7: Register Routes in app.js
**File**: `api/app.js`

Add:
```javascript
// Near top - connect Redis
const { connectRedis } = require('./src/helper/connecting-redis');
connectRedis().catch(err => console.log('Redis not available:', err.message));

// With other route registrations
require("./src/routes/apiKey.routes")(app);
```

### Testing Checklist
- [ ] Create API key via POST /v5/api-keys
- [ ] List API keys via GET /v5/api-keys
- [ ] Validate API key via GET /v5/api-keys/validate
- [ ] Test rate limiting
- [ ] Test with Consumer API adapter

---

## 🟠 P1: Consumer API Routes - POS V2

### Overview
Create dedicated consumer-facing endpoints that use API key authentication.

### Files to Create/Modify

```
appzap-pos-api-v2/
└── src/
    └── features/
        └── consumer-api/                    # NEW FOLDER
            ├── routes/
            │   └── consumer.route.js        # Consumer endpoints
            ├── controllers/
            │   └── consumer.controller.js   # Controllers
            └── services/
                └── consumer.service.js      # Business logic
```

### Endpoints to Create

| Method | Endpoint | Description | Required Scope |
|--------|----------|-------------|----------------|
| GET | `/api/v1/consumer/restaurants` | List restaurants | `read:all-restaurants` |
| GET | `/api/v1/consumer/restaurants/:id` | Get restaurant details | `read:restaurant-details` |
| GET | `/api/v1/consumer/restaurants/:id/menu` | Get menu | `read:menu` |
| GET | `/api/v1/consumer/restaurants/:id/tables` | Get tables | `read:tables` |
| POST | `/api/v1/consumer/orders` | Create order | `write:orders` |
| GET | `/api/v1/consumer/orders/:id` | Get order | `read:orders` |
| GET | `/api/v1/consumer/orders` | List orders by phone | `read:orders` |
| POST | `/api/v1/consumer/reservations` | Create reservation | `write:reservations` |
| GET | `/api/v1/consumer/reservations/:id` | Get reservation | `read:all-reservations` |
| DELETE | `/api/v1/consumer/reservations/:id` | Cancel reservation | `write:reservations` |

### Route Implementation

```javascript
import express from 'express'
import { apiKeyAuth, requireScope } from '../../../core/middlewares/api-key-auth.js'
import controller from '../controllers/consumer.controller.js'

const router = express.Router()

// All routes require API key authentication
router.use(apiKeyAuth)

// Restaurants
router.get('/restaurants', requireScope('read:all-restaurants', 'consumer:search'), controller.getRestaurants)
router.get('/restaurants/:id', requireScope('read:restaurant-details'), controller.getRestaurant)
router.get('/restaurants/:id/menu', requireScope('read:menu'), controller.getMenu)
router.get('/restaurants/:id/tables', requireScope('read:tables'), controller.getTables)

// Orders
router.post('/orders', requireScope('write:orders'), controller.createOrder)
router.get('/orders/:id', requireScope('read:orders'), controller.getOrder)
router.get('/orders', requireScope('read:orders'), controller.getOrdersByPhone)

// Reservations
router.post('/reservations', requireScope('write:reservations', 'consumer:book'), controller.createReservation)
router.get('/reservations/:id', requireScope('read:all-reservations'), controller.getReservation)
router.delete('/reservations/:id', requireScope('write:reservations'), controller.cancelReservation)

export default router
```

---

## 🟠 P1: Consumer API Routes - POS V1

### Overview
Create dedicated consumer-facing endpoints for POS V1.

### Endpoints to Create

| Method | Endpoint | Description | Required Scope |
|--------|----------|-------------|----------------|
| GET | `/v5/consumer/stores` | List stores | `read:all-restaurants` |
| GET | `/v5/consumer/stores/:id` | Get store details | `read:restaurant-details` |
| GET | `/v5/consumer/stores/:id/menu` | Get menu | `read:menu` |
| GET | `/v5/consumer/stores/:id/tables` | Get tables | `read:tables` |
| POST | `/v5/consumer/orders` | Create order | `write:orders` |
| GET | `/v5/consumer/orders/:id` | Get order | `read:orders` |
| POST | `/v5/consumer/reservations` | Create reservation | `write:reservations` |
| GET | `/v5/consumer/reservations/:id` | Get reservation | `read:reservations` |

### Route Implementation

**File**: `api/src/routes/consumerApi.routes.js`

```javascript
const { apiKeyAuth, requireScope } = require('../middlewares/apiKeyAuth');
const controller = require('../controllers/consumerApi.controller');

module.exports = (app) => {
  // Stores
  app.get('/v5/consumer/stores', apiKeyAuth, requireScope('read:all-restaurants', 'consumer:search'), controller.getStores);
  app.get('/v5/consumer/stores/:id', apiKeyAuth, requireScope('read:restaurant-details'), controller.getStore);
  app.get('/v5/consumer/stores/:id/menu', apiKeyAuth, requireScope('read:menu'), controller.getMenu);
  app.get('/v5/consumer/stores/:id/tables', apiKeyAuth, requireScope('read:tables'), controller.getTables);
  
  // Orders
  app.post('/v5/consumer/orders', apiKeyAuth, requireScope('write:orders'), controller.createOrder);
  app.get('/v5/consumer/orders/:id', apiKeyAuth, requireScope('read:orders'), controller.getOrder);
  app.get('/v5/consumer/orders', apiKeyAuth, requireScope('read:orders'), controller.getOrdersByPhone);
  
  // Reservations
  app.post('/v5/consumer/reservations', apiKeyAuth, requireScope('write:reservations', 'consumer:book'), controller.createReservation);
  app.get('/v5/consumer/reservations/:id', apiKeyAuth, requireScope('read:reservations'), controller.getReservation);
  app.delete('/v5/consumer/reservations/:id', apiKeyAuth, requireScope('write:reservations'), controller.cancelReservation);
};
```

---

## 🟡 P2: Table Availability API

### Overview
Create endpoints to check table availability for reservations.

### POS V2 Implementation

**Endpoint**: `GET /api/v1/consumer/tables/availability`

**Query Parameters**:
- `restaurantId` (required)
- `branchId` (optional)
- `date` (required, YYYY-MM-DD)
- `time` (optional, HH:mm)
- `guests` (required)
- `duration` (optional, default: 90 minutes)

**Response**:
```json
{
  "success": true,
  "data": {
    "date": "2026-02-10",
    "restaurantId": "xxx",
    "slots": [
      {
        "time": "12:00",
        "available": true,
        "tablesAvailable": 3,
        "tables": [
          { "id": "t1", "name": "Table 1", "capacity": 4 },
          { "id": "t2", "name": "Table 2", "capacity": 4 }
        ]
      },
      {
        "time": "12:30",
        "available": true,
        "tablesAvailable": 2
      },
      {
        "time": "13:00",
        "available": false,
        "tablesAvailable": 0
      }
    ]
  }
}
```

### POS V1 Implementation

**Endpoint**: `GET /v5/consumer/tables/availability`

Similar structure adapted for POS V1's data model.

---

## 🟡 P2: Reservations Module - POS V2

### Overview
POS V2 has basic table-reservations but needs enhancements for consumer API.

### Enhancements Needed

1. **External booking ID tracking**
   - Add `externalBookingId` field to track Consumer API reservations

2. **Customer info without account**
   - Allow reservations with just name + phone (no user account required)

3. **Availability check endpoint**
   - Real-time table availability

4. **Consumer-friendly status**
   - Map internal statuses to consumer-friendly ones

### Model Updates

Add to `table-reservation.model.js`:
```javascript
externalBookingId: {
  type: String,
  index: true,
  sparse: true
},
customerInfo: {
  name: String,
  phone: String,
  email: String
},
source: {
  type: String,
  enum: ['pos', 'consumer_app', 'website', 'phone'],
  default: 'pos'
}
```

---

## 🟢 P3: Split Bill API

### Overview
Enable bill splitting through Consumer API.

### POS V2 Implementation

**Endpoint**: `POST /api/v1/consumer/orders/:orderId/split`

**Request**:
```json
{
  "splitType": "equal",  // or "by_items", "by_amount", "custom"
  "participants": [
    { "name": "John", "phone": "8562012345678" },
    { "name": "Jane", "phone": "8562098765432" }
  ],
  // For by_items:
  "itemAssignments": [
    { "participantIndex": 0, "itemIds": ["item1", "item2"] }
  ],
  // For by_amount:
  "amounts": [50000, 75000],
  // For custom:
  "customSplits": [
    { "participantIndex": 0, "amount": 60000 }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "splitSessionId": "split_xxx",
    "orderId": "order_xxx",
    "totalAmount": 125000,
    "splits": [
      {
        "participantIndex": 0,
        "name": "John",
        "amount": 62500,
        "status": "pending",
        "paymentLink": "https://pay.appzap.la/split/xxx/0"
      },
      {
        "participantIndex": 1,
        "name": "Jane", 
        "amount": 62500,
        "status": "pending",
        "paymentLink": "https://pay.appzap.la/split/xxx/1"
      }
    ]
  }
}
```

### POS V1 Implementation

POS V1 currently doesn't have split bill functionality. This would be a new feature.

---

## 🟢 P3: Consumer API Adapter Updates

### Overview
Update Consumer API V2 adapters to use API keys.

### Files to Modify

```
appzap_consumer_api_v2/
└── src/
    ├── services/
    │   ├── posV1Api.service.ts    # Add API key header
    │   └── posV2Api.service.ts    # Add API key header
    ├── adapters/
    │   ├── posV1.adapter.ts       # Update endpoint paths
    │   └── posV2.adapter.ts       # Update endpoint paths
    └── config/
        └── index.ts               # Add API key env vars
```

### Environment Variables

```env
# POS V1
POS_V1_BASE_URL=https://pos-v1.appzap.la
POS_V1_API_KEY=appzap_pos_live_sk_xxxxxxxxxxxxxxxx

# POS V2
POS_V2_BASE_URL=https://pos-v2.appzap.la
POS_V2_API_KEY=appzap_pos_live_sk_yyyyyyyyyyyyyyyy
```

### API Service Updates

**File**: `src/services/posV1Api.service.ts`

```typescript
import axios from 'axios';

const posV1Client = axios.create({
  baseURL: process.env.POS_V1_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.POS_V1_API_KEY,
    'X-Service-Name': 'consumer-api-v2'
  }
});

// Add response interceptor for rate limiting
posV1Client.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 429) {
      // Handle rate limiting - retry after delay
      const retryAfter = error.response.headers['x-ratelimit-reset'];
      // ... retry logic
    }
    throw error;
  }
);

export default posV1Client;
```

### Adapter Path Updates

Update adapters to use new `/consumer/` endpoints:

```typescript
// posV1.adapter.ts
async getRestaurants() {
  const response = await posV1Client.get('/v5/consumer/stores');
  return this.transformToUnified(response.data);
}

// posV2.adapter.ts
async getRestaurants() {
  const response = await posV2Client.get('/api/v1/consumer/restaurants');
  return this.transformToUnified(response.data);
}
```

---

## 📅 Implementation Timeline

### Week 1: P0 - API Key Authentication

| Day | Task | System |
|-----|------|--------|
| 1 | Create generator, scopes, model | POS V2 |
| 2 | Create middleware, service, controller | POS V2 |
| 3 | Create routes, register, test | POS V2 |
| 4 | Enable Redis, create generator, scopes, model | POS V1 |
| 5 | Create middleware, service, controller, routes | POS V1 |

### Week 2: P1 - Consumer API Routes

| Day | Task | System |
|-----|------|--------|
| 1 | Create consumer routes module | POS V2 |
| 2 | Implement controllers (restaurants, menu) | POS V2 |
| 3 | Implement controllers (orders, reservations) | POS V2 |
| 4 | Create consumer routes | POS V1 |
| 5 | Implement controllers | POS V1 |

### Week 3: P2 & P3 - Features & Integration

| Day | Task | System |
|-----|------|--------|
| 1 | Table availability API | Both |
| 2 | Reservations enhancements | POS V2 |
| 3 | Split bill API | POS V2 |
| 4 | Consumer API adapter updates | Consumer API V2 |
| 5 | End-to-end testing | All |

---

## ✅ Success Criteria

1. **API Key Authentication**
   - [ ] Can create API keys via admin interface
   - [ ] API keys work with X-API-Key header
   - [ ] Rate limiting works correctly
   - [ ] IP whitelisting works correctly

2. **Consumer API Routes**
   - [ ] All endpoints return correct data
   - [ ] Proper scope validation
   - [ ] Consistent response format

3. **Integration**
   - [ ] Consumer API V2 can connect to POS V1
   - [ ] Consumer API V2 can connect to POS V2
   - [ ] Orders created in Consumer API appear in POS
   - [ ] Reservations sync correctly

---

## 🔐 Security Checklist

- [ ] API keys are hashed with bcrypt before storage
- [ ] Full API key shown only once at creation
- [ ] Rate limiting enabled and tested
- [ ] IP whitelisting available for system keys
- [ ] Audit logging for key operations
- [ ] Key rotation supported
- [ ] HTTPS enforced for all API communication

---

**Document Version**: 1.0.0  
**Last Updated**: February 2026  
**Author**: AI Assistant
