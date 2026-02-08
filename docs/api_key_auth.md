# API Key Authentication System - Implementation Guide

> **Reference Implementation from POS V2 (appzap-pos-api-v2)**
> 
> This document preserves the complete, working API Key Authentication pattern from POS V2 for reimplementation on both POS V1 and POS V2 systems.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [File Structure](#file-structure)
3. [Key Format & Generation](#key-format--generation)
4. [Database Model](#database-model)
5. [Middleware Implementation](#middleware-implementation)
6. [Scopes & Permissions](#scopes--permissions)
7. [Service Layer](#service-layer)
8. [Controller Layer](#controller-layer)
9. [Route Definitions](#route-definitions)
10. [Redis Configuration](#redis-configuration)
11. [Integration Examples](#integration-examples)
12. [Implementation Checklist](#implementation-checklist)

---

## Overview

This API Key Authentication system provides enterprise-grade security for service-to-service communication. It allows external systems (Consumer API, delivery apps, analytics tools) to authenticate with long-lived API keys instead of JWT tokens.

### Key Features

- ✅ Cryptographically secure key generation (32 bytes = 64 hex chars)
- ✅ bcrypt hash storage (NEVER store plain API keys!)
- ✅ Scope-based granular permissions
- ✅ Redis-based rate limiting (hourly windows)
- ✅ IP whitelisting (optional)
- ✅ Usage tracking and audit logging
- ✅ Key rotation with automatic revocation
- ✅ Approval workflow for system-wide keys
- ✅ Environment separation (production/sandbox)
- ✅ Dual authentication (JWT or API Key)

---

## File Structure

```
src/
├── features/
│   └── api-keys/
│       ├── models/
│       │   └── api-key.model.js          # MongoDB schema
│       ├── services/
│       │   └── api-key.service.js        # Business logic
│       ├── controllers/
│       │   └── api-key.controller.js     # HTTP controllers
│       ├── routes/
│       │   └── api-key.route.js          # Route definitions
│       └── README.md
└── core/
    ├── middlewares/
    │   └── api-key-auth.js               # Auth middleware
    ├── utils/
    │   └── api-key-generator.js          # Key generation utilities
    ├── constants/
    │   └── api-key-scopes.js             # Permission scopes
    ├── config/
    │   └── redis.js                      # Redis configuration
    └── routes-index.js                   # Route registration
```

---

## Key Format & Generation

### API Key Format

```
appzap_pos_{environment}_sk_{secret}

Examples:
- appzap_pos_live_sk_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
- appzap_pos_test_sk_abcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678
```

**Components:**
- `appzap` - Brand identifier
- `pos` - Product identifier
- `live`/`test` - Environment (production/sandbox)
- `sk` - Secret key type
- `{64_chars}` - Cryptographically secure random string (32 bytes)

### api-key-generator.js (Complete Implementation)

```javascript
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

/**
 * Generate cryptographically secure API key
 * Format: appzap_pos_{environment}_sk_{secret}
 * 
 * @param {string} environment - 'production' or 'sandbox'
 * @returns {Object} Key components
 */
export function generateApiKey(environment = 'production') {
  // Generate 32 random bytes = 64 hex characters
  const secret = crypto.randomBytes(32).toString('hex')
  
  // Determine environment prefix
  const env = environment === 'production' ? 'live' : 'test'
  
  // Construct full key
  const fullKey = `appzap_pos_${env}_sk_${secret}`
  
  // Create prefix for database lookup
  const prefix = `appzap_pos_${env}_sk_`
  
  return {
    fullKey,      // appzap_pos_live_sk_abc123...
    secret,       // abc123...
    prefix,       // appzap_pos_live_sk_
    environment   // production/sandbox
  }
}

/**
 * Generate unique API key ID
 * Used for HMAC-based authentication (future enhancement)
 * 
 * @returns {string} Unique key ID
 */
export function generateKeyId() {
  return `api_key_${crypto.randomBytes(16).toString('hex')}`
}

/**
 * Hash API key secret for secure storage
 * NEVER store plain API keys in database!
 * 
 * @param {string} secret - The secret part of API key
 * @returns {Promise<string>} Hashed secret
 */
export async function hashApiKeySecret(secret) {
  const saltRounds = 10
  return await bcrypt.hash(secret, saltRounds)
}

/**
 * Verify API key secret against hash
 * 
 * @param {string} secret - Plain secret from request
 * @param {string} hash - Hashed secret from database
 * @returns {Promise<boolean>} Whether secret matches
 */
export async function verifyApiKeySecret(secret, hash) {
  return await bcrypt.compare(secret, hash)
}

/**
 * Extract components from API key
 * 
 * @param {string} apiKey - Full API key
 * @returns {Object|null} Parsed components or null if invalid
 */
export function parseApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return null
  }
  
  // Expected format: appzap_pos_{env}_sk_{secret}
  const parts = apiKey.split('_')
  
  if (parts.length !== 5) {
    return null
  }
  
  const [brand, product, env, type, secret] = parts
  
  // Validate format
  if (brand !== 'appzap' || product !== 'pos') {
    return null
  }
  
  if (!['live', 'test'].includes(env)) {
    return null
  }
  
  if (type !== 'sk') {
    return null
  }
  
  if (!secret || secret.length < 32) {
    return null
  }
  
  return {
    brand,        // appzap
    product,      // pos
    environment: env === 'live' ? 'production' : 'sandbox',
    type,         // sk (secret key)
    secret,       // The actual secret
    prefix: `${brand}_${product}_${env}_${type}_`
  }
}

/**
 * Mask API key for display
 * Shows only first and last 4 characters
 * 
 * @param {string} apiKey - Full API key
 * @returns {string} Masked key
 */
export function maskApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return '****'
  }
  
  const parsed = parseApiKey(apiKey)
  if (!parsed) {
    return '****'
  }
  
  const { prefix, secret } = parsed
  
  // Show last 4 characters of secret
  const lastFour = secret.slice(-4)
  
  return `${prefix}****${lastFour}`
}

/**
 * Validate API key format
 * 
 * @param {string} apiKey - API key to validate
 * @returns {Object} Validation result
 */
export function validateApiKeyFormat(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return {
      valid: false,
      error: 'API key is required and must be a string'
    }
  }
  
  const parsed = parseApiKey(apiKey)
  
  if (!parsed) {
    return {
      valid: false,
      error: 'Invalid API key format. Expected: appzap_pos_{live|test}_sk_{secret}'
    }
  }
  
  return {
    valid: true,
    parsed
  }
}

/**
 * Generate webhook secret for API key
 * Used for verifying webhook signatures
 * 
 * @returns {string} Webhook secret
 */
export function generateWebhookSecret() {
  return `whsec_${crypto.randomBytes(32).toString('hex')}`
}

/**
 * Create HMAC signature (for future HMAC authentication)
 * 
 * @param {string} data - Data to sign
 * @param {string} secret - Secret key
 * @returns {string} HMAC signature
 */
export function createHmacSignature(data, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex')
}

/**
 * Verify HMAC signature
 * 
 * @param {string} data - Data that was signed
 * @param {string} signature - Provided signature
 * @param {string} secret - Secret key
 * @returns {boolean} Whether signature is valid
 */
export function verifyHmacSignature(data, signature, secret) {
  const expectedSignature = createHmacSignature(data, secret)
  
  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature)
    )
  } catch (error) {
    return false
  }
}

export default {
  generateApiKey,
  generateKeyId,
  hashApiKeySecret,
  verifyApiKeySecret,
  parseApiKey,
  maskApiKey,
  validateApiKeyFormat,
  generateWebhookSecret,
  createHmacSignature,
  verifyHmacSignature
}
```

---

## Database Model

### api-key.model.js (Complete Schema)

```javascript
import mongoose from 'mongoose'
import { API_KEY_SCOPES } from '../../../core/constants/api-key-scopes.js'

const apiKeySchema = mongoose.Schema(
  {
    // Identification
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    
    keyId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    
    // Security - NEVER store plain API key!
    keyHash: {
      type: String,
      required: true
    },
    
    keyPrefix: {
      type: String,
      required: true,
      index: true
    },
    
    // Key Type (determines scope of access)
    keyType: {
      type: String,
      enum: ['restaurant', 'system', 'partner'],
      default: 'restaurant',
      required: true,
      index: true
    },
    
    // Owner (optional for system/partner keys)
    restaurantId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Restaurant',
      required: function() {
        // Required only for restaurant-specific keys
        return this.keyType === 'restaurant'
      },
      index: true
    },
    
    branchId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Branch',
      index: true
    },
    
    createdBy: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Staff',
      required: true
    },
    
    // Approval System (for system/partner keys)
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: function() {
        // System and partner keys require approval
        return this.keyType === 'restaurant' ? 'approved' : 'pending'
      }
    },
    
    approvedBy: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Staff'
    },
    
    approvedAt: {
      type: Date
    },
    
    rejectedReason: {
      type: String,
      maxlength: 500
    },
    
    // Permissions & Scope
    scopes: {
      type: [String],
      required: true,
      validate: {
        validator: function(scopes) {
          // Check if all scopes are valid
          return scopes.every(scope => Object.keys(API_KEY_SCOPES).includes(scope))
        },
        message: 'Invalid scope detected'
      }
    },
    
    // Rate Limiting
    rateLimit: {
      type: Number,
      default: 1000,  // Requests per hour
      min: 1,
      max: 100000
    },
    
    // Environment
    environment: {
      type: String,
      enum: ['production', 'sandbox'],
      default: 'production',
      required: true
    },
    
    // Security Options
    ipWhitelist: [{
      type: String,
      validate: {
        validator: function(ip) {
          // Basic IP validation (IPv4)
          const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
          return ipv4Regex.test(ip)
        },
        message: 'Invalid IP address format'
      }
    }],
    
    // Enhanced security for system/partner keys
    requiresApproval: {
      type: Boolean,
      default: function() {
        return this.keyType !== 'restaurant'
      }
    },
    
    // Audit trail for system keys
    auditLog: [{
      action: {
        type: String,
        enum: ['created', 'approved', 'rejected', 'revoked', 'updated', 'rotated']
      },
      performedBy: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'Staff'
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      details: String
    }],
    
    // Usage Tracking
    lastUsedAt: {
      type: Date
    },
    
    lastUsedFrom: {
      type: String  // IP address
    },
    
    usageCount: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Status
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    
    expiresAt: {
      type: Date,
      index: true
    },
    
    revokedAt: {
      type: Date
    },
    
    revokedBy: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Staff'
    },
    
    revokedReason: {
      type: String,
      maxlength: 500
    },
    
    // Metadata
    description: {
      type: String,
      maxlength: 500
    },
    
    tags: [{
      type: String,
      maxlength: 50
    }],
    
    // Webhook secret (for future webhook integrations)
    webhookSecret: {
      type: String
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: function(doc, ret) {
        // Never expose key hash in JSON
        delete ret.keyHash
        delete ret.webhookSecret
        return ret
      }
    }
  }
)

// Indexes
apiKeySchema.index({ restaurantId: 1, isActive: 1 })
apiKeySchema.index({ keyType: 1, isActive: 1 })
apiKeySchema.index({ keyType: 1, approvalStatus: 1 })
apiKeySchema.index({ keyPrefix: 1, keyHash: 1 })
apiKeySchema.index({ expiresAt: 1 }, { sparse: true })
apiKeySchema.index({ createdAt: -1 })

// Virtual for checking if expired
apiKeySchema.virtual('isExpired').get(function() {
  if (!this.expiresAt) {
    return false
  }
  return new Date() > this.expiresAt
})

// Virtual for checking if revoked
apiKeySchema.virtual('isRevoked').get(function() {
  return !!this.revokedAt
})

// Virtual for effective status
apiKeySchema.virtual('status').get(function() {
  if (this.isRevoked) {
    return 'revoked'
  }
  if (this.isExpired) {
    return 'expired'
  }
  if (!this.isActive) {
    return 'inactive'
  }
  if (this.requiresApproval && this.approvalStatus === 'pending') {
    return 'pending_approval'
  }
  if (this.approvalStatus === 'rejected') {
    return 'rejected'
  }
  return 'active'
})

// Virtual for checking if key is system-wide
apiKeySchema.virtual('isSystemKey').get(function() {
  return this.keyType === 'system' || this.keyType === 'partner'
})

// Instance method: Check if key can be used
apiKeySchema.methods.canBeUsed = function() {
  // Basic checks
  if (!this.isActive || this.isRevoked || this.isExpired) {
    return false
  }
  
  // Approval check for system/partner keys
  if (this.requiresApproval && this.approvalStatus !== 'approved') {
    return false
  }
  
  return true
}

// Instance method: Check if key has scope
apiKeySchema.methods.hasScope = function(scope) {
  // Wildcard gives all permissions
  if (this.scopes.includes('*')) {
    return true
  }
  return this.scopes.includes(scope)
}

// Instance method: Check if key has ANY of the required scopes
apiKeySchema.methods.hasAnyScope = function(requiredScopes) {
  // Wildcard gives all permissions
  if (this.scopes.includes('*')) {
    return true
  }
  return requiredScopes.some(scope => this.scopes.includes(scope))
}

// Instance method: Check if key has ALL required scopes
apiKeySchema.methods.hasAllScopes = function(requiredScopes) {
  // Wildcard gives all permissions
  if (this.scopes.includes('*')) {
    return true
  }
  return requiredScopes.every(scope => this.scopes.includes(scope))
}

// Instance method: Revoke key
apiKeySchema.methods.revoke = async function(revokedBy, reason) {
  this.isActive = false
  this.revokedAt = new Date()
  this.revokedBy = revokedBy
  this.revokedReason = reason
  return await this.save()
}

// Instance method: Update usage
apiKeySchema.methods.recordUsage = async function(ipAddress) {
  this.lastUsedAt = new Date()
  this.lastUsedFrom = ipAddress
  this.usageCount += 1
  return await this.save()
}

// Instance method: Approve key (for system/partner keys)
apiKeySchema.methods.approve = async function(approvedBy, details) {
  this.approvalStatus = 'approved'
  this.approvedBy = approvedBy
  this.approvedAt = new Date()
  this.isActive = true
  
  // Add to audit log
  this.auditLog.push({
    action: 'approved',
    performedBy: approvedBy,
    timestamp: new Date(),
    details: details || 'API key approved'
  })
  
  return await this.save()
}

// Instance method: Reject key (for system/partner keys)
apiKeySchema.methods.reject = async function(rejectedBy, reason) {
  this.approvalStatus = 'rejected'
  this.rejectedReason = reason
  this.isActive = false
  
  // Add to audit log
  this.auditLog.push({
    action: 'rejected',
    performedBy: rejectedBy,
    timestamp: new Date(),
    details: reason
  })
  
  return await this.save()
}

// Static method: Find active API keys for restaurant
apiKeySchema.statics.findActiveByRestaurant = function(restaurantId) {
  return this.find({
    restaurantId,
    isActive: true,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ],
    revokedAt: { $exists: false }
  })
}

// Static method: Clean up expired keys (cron job)
apiKeySchema.statics.deactivateExpiredKeys = async function() {
  const result = await this.updateMany(
    {
      expiresAt: { $lte: new Date() },
      isActive: true
    },
    {
      $set: { isActive: false }
    }
  )
  return result
}

// Static method: Find keys pending approval
apiKeySchema.statics.findPendingApproval = function(filters = {}) {
  return this.find({
    approvalStatus: 'pending',
    ...filters
  })
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 })
}

// Static method: Find system-wide keys
apiKeySchema.statics.findSystemKeys = function() {
  return this.find({
    keyType: { $in: ['system', 'partner'] },
    isActive: true
  })
    .populate('createdBy', 'name email')
    .populate('approvedBy', 'name email')
    .sort({ createdAt: -1 })
}

const ApiKey = mongoose.model('ApiKey', apiKeySchema)

export default ApiKey
```

---

## Middleware Implementation

### api-key-auth.js (Complete Middleware)

```javascript
import httpStatus from 'http-status'
import ApiError from '../utils/ApiError.js'
import ApiKey from '../../features/api-keys/models/api-key.model.js'
import { Restaurant } from '../models-index.js'
import {
  parseApiKey,
  validateApiKeyFormat,
  verifyApiKeySecret
} from '../utils/api-key-generator.js'
import { hasAnyScope } from '../constants/api-key-scopes.js'
import { redisClient } from '../config/redis.js'

/**
 * Extract API key from request
 * Checks multiple possible locations
 */
function extractApiKey(req) {
  // 1. X-API-Key header (preferred)
  if (req.headers['x-api-key']) {
    return req.headers['x-api-key']
  }
  
  // 2. API-Key header
  if (req.headers['api-key']) {
    return req.headers['api-key']
  }
  
  // 3. Authorization: Bearer {api_key} (if it starts with 'pos_')
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    if (token.startsWith('pos_')) {
      return token
    }
  }
  
  // 4. Query parameter (NOT recommended for production, but supported)
  if (req.query.api_key) {
    console.warn('⚠️ API key passed in query parameter - this is insecure!')
    return req.query.api_key
  }
  
  return null
}

/**
 * API Key Authentication Middleware
 * Validates API key and attaches API key info to request
 */
export const apiKeyAuth = async (req, res, next) => {
  try {
    // Extract API key from request
    const apiKey = extractApiKey(req)
    
    if (!apiKey) {
      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        'API key required. Please provide API key in X-API-Key header'
      )
    }
    
    // Validate format
    const formatValidation = validateApiKeyFormat(apiKey)
    if (!formatValidation.valid) {
      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        `Invalid API key format: ${formatValidation.error}`
      )
    }
    
    const parsed = formatValidation.parsed
    
    // Look up API key in database by prefix
    // We can't search by full key (it's hashed), so we search by prefix first
    const apiKeys = await ApiKey.find({
      keyPrefix: parsed.prefix,
      isActive: true
    }).populate('restaurantId')
    
    if (!apiKeys || apiKeys.length === 0) {
      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        'Invalid API key'
      )
    }
    
    // Check each potential match by verifying the hash
    let matchedKey = null
    for (const key of apiKeys) {
      const isValid = await verifyApiKeySecret(parsed.secret, key.keyHash)
      if (isValid) {
        matchedKey = key
        break
      }
    }
    
    if (!matchedKey) {
      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        'Invalid API key'
      )
    }
    
    // Check if key can be used
    if (!matchedKey.canBeUsed()) {
      const status = matchedKey.status
      const message = status === 'revoked' 
        ? 'API key has been revoked'
        : status === 'expired'
        ? 'API key has expired'
        : 'API key is inactive'
      
      throw new ApiError(httpStatus.UNAUTHORIZED, message)
    }
    
    // Check IP whitelist if configured
    if (matchedKey.ipWhitelist && matchedKey.ipWhitelist.length > 0) {
      const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress
      const isWhitelisted = matchedKey.ipWhitelist.includes(clientIp)
      
      if (!isWhitelisted) {
        console.warn(`🚫 API key access denied - IP not whitelisted:`, {
          keyId: matchedKey.keyId,
          clientIp,
          whitelist: matchedKey.ipWhitelist
        })
        
        throw new ApiError(
          httpStatus.FORBIDDEN,
          'API key not allowed from this IP address'
        )
      }
    } else {
      // No IP whitelist - log for security monitoring
      const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress
      console.log(`⚠️ API key used without IP whitelist:`, {
        keyId: matchedKey.keyId,
        keyType: matchedKey.keyType,
        clientIp,
        timestamp: new Date().toISOString()
      })
    }
    
    // Check rate limit using Redis
    const rateLimitKey = `api_key:${matchedKey._id}:rate_limit`
    const currentHour = Math.floor(Date.now() / 3600000) // Hour-based window
    const rateLimitKeyWithHour = `${rateLimitKey}:${currentHour}`
    
    try {
      // Increment request count
      const requestCount = await redisClient.incr(rateLimitKeyWithHour)
      
      // Set expiry on first request in this hour
      if (requestCount === 1) {
        await redisClient.expire(rateLimitKeyWithHour, 3600) // 1 hour
      }
      
      // Check if limit exceeded
      if (requestCount > matchedKey.rateLimit) {
        throw new ApiError(
          httpStatus.TOO_MANY_REQUESTS,
          `Rate limit exceeded. Limit: ${matchedKey.rateLimit} requests per hour`
        )
      }
      
      // Add rate limit info to response headers
      res.setHeader('X-RateLimit-Limit', matchedKey.rateLimit)
      res.setHeader('X-RateLimit-Remaining', Math.max(0, matchedKey.rateLimit - requestCount))
      res.setHeader('X-RateLimit-Reset', (currentHour + 1) * 3600000)
      
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      // If Redis fails, log but don't block request
      console.error('❌ Redis rate limit check failed:', error)
    }
    
    // Update usage tracking (async, don't wait)
    const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress
    matchedKey.recordUsage(clientIp).catch(error => {
      console.error('❌ Failed to record API key usage:', error)
    })
    
    // Attach API key info to request
    req.apiKey = matchedKey
    req.apiKeyId = matchedKey._id
    req.apiKeyScopes = matchedKey.scopes
    req.keyType = matchedKey.keyType
    
    // Handle restaurant-specific vs system-wide keys
    if (matchedKey.keyType === 'restaurant') {
      // Restaurant-specific key
      req.restaurant = matchedKey.restaurantId
      req.restaurantId = matchedKey.restaurantId._id
      
      // If branch-specific, attach branch info
      if (matchedKey.branchId) {
        req.branchId = matchedKey.branchId
      }
    } else {
      // System-wide key (system/partner)
      req.isSystemKey = true
      req.restaurant = null
      req.restaurantId = null // System keys can access all restaurants
    }
    
    // Mark that this request was authenticated via API key
    req.authMethod = 'api_key'
    
    console.log(`✅ API key authenticated:`, {
      keyId: matchedKey.keyId,
      keyType: matchedKey.keyType,
      name: matchedKey.name,
      restaurantId: matchedKey.restaurantId?._id || 'system-wide',
      scopes: matchedKey.scopes,
      environment: matchedKey.environment
    })
    
    next()
    
  } catch (error) {
    next(error)
  }
}

/**
 * Require specific API key scope(s)
 * API key must have AT LEAST ONE of the required scopes
 * 
 * Usage: requireScope('read:menu', 'write:menu')
 */
export const requireScope = (...requiredScopes) => {
  return async (req, res, next) => {
    try {
      if (!req.apiKey) {
        throw new ApiError(
          httpStatus.UNAUTHORIZED,
          'API key authentication required'
        )
      }
      
      // Check if API key has required scope
      const hasRequiredScope = req.apiKey.hasAnyScope(requiredScopes)
      
      if (!hasRequiredScope) {
        throw new ApiError(
          httpStatus.FORBIDDEN,
          `Missing required scope. Need one of: ${requiredScopes.join(', ')}`
        )
      }
      
      next()
      
    } catch (error) {
      next(error)
    }
  }
}

/**
 * Require ALL specified API key scopes
 * API key must have EVERY ONE of the required scopes
 * 
 * Usage: requireAllScopes('read:menu', 'write:menu')
 */
export const requireAllScopes = (...requiredScopes) => {
  return async (req, res, next) => {
    try {
      if (!req.apiKey) {
        throw new ApiError(
          httpStatus.UNAUTHORIZED,
          'API key authentication required'
        )
      }
      
      // Check if API key has ALL required scopes
      const hasAllRequired = req.apiKey.hasAllScopes(requiredScopes)
      
      if (!hasAllRequired) {
        throw new ApiError(
          httpStatus.FORBIDDEN,
          `Missing required scopes. Need all of: ${requiredScopes.join(', ')}`
        )
      }
      
      next()
      
    } catch (error) {
      next(error)
    }
  }
}

/**
 * Dual Authentication Middleware
 * Accepts EITHER JWT token OR API key
 * 
 * Try JWT first, fall back to API key
 */
export const authOrApiKey = async (req, res, next) => {
  // Check if JWT token is present (and doesn't look like an API key)
  const authHeader = req.headers.authorization
  const hasJWT = authHeader && 
                 authHeader.startsWith('Bearer ') && 
                 !authHeader.substring(7).startsWith('pos_')
  
  if (hasJWT) {
    // Try JWT authentication
    const { auth } = await import('./auth.js')
    return auth(req, res, next)
  }
  
  // Otherwise try API key authentication
  return apiKeyAuth(req, res, next)
}

export default {
  apiKeyAuth,
  requireScope,
  requireAllScopes,
  authOrApiKey
}
```

---

## Scopes & Permissions

### api-key-scopes.js (Complete Implementation)

```javascript
/**
 * API Key Scopes
 * Define granular permissions for API keys
 */

export const API_KEY_SCOPES = {
  // ===== SYSTEM-WIDE SCOPES (Master Keys) =====
  // Restaurants (Cross-restaurant access)
  'read:all-restaurants': 'Read all restaurants (system-wide)',
  'read:restaurant-details': 'Read any restaurant details',
  'write:restaurant-details': 'Update any restaurant details (super admin)',
  'manage:restaurants': 'Full restaurant management (super admin)',
  
  // Reservations (Cross-restaurant)
  'read:all-reservations': 'Read reservations across all restaurants',
  'write:reservations': 'Create/update reservations at any restaurant',
  'manage:reservations': 'Full reservation management (system-wide)',
  
  // System Administration
  'system:admin': 'Full system administration access',
  'system:monitoring': 'System monitoring and metrics',
  'system:audit': 'Access audit logs (system-wide)',
  
  // Consumer App Operations
  'consumer:search': 'Search restaurants for consumer apps',
  'consumer:book': 'Create bookings for consumers',
  'consumer:profile': 'Manage consumer profiles',
  
  // ===== RESTAURANT-SPECIFIC SCOPES =====
  // Menu Management
  'read:menu': 'Read menu items and categories',
  'write:menu': 'Create and update menu items and categories',
  
  // Orders
  'read:orders': 'Read orders',
  'write:orders': 'Create and update orders',
  
  // Transactions & Payments
  'read:transactions': 'Read transaction history',
  'write:payments': 'Process payments',
  
  // Inventory
  'read:inventory': 'Read inventory levels',
  'write:inventory': 'Update inventory',
  
  // Customers (CRM)
  'read:customers': 'Read customer data',
  'write:customers': 'Create and update customers',
  
  // Reports & Analytics
  'read:reports': 'Read analytics and reports',
  
  // Branches
  'read:branches': 'Read branch information',
  'write:branches': 'Create and update branches',
  
  // Tables
  'read:tables': 'Read table information',
  'write:tables': 'Create and update tables',
  
  // Staff
  'read:staff': 'Read staff information',
  'write:staff': 'Create and update staff',
  
  // Restaurant Settings
  'read:settings': 'Read restaurant settings',
  'write:settings': 'Update restaurant settings',
  
  // Webhooks
  'manage:webhooks': 'Manage webhook subscriptions',
  
  // API Keys (admin only)
  'manage:api-keys': 'Manage API keys',
  
  // Wildcard (full access - use with extreme caution!)
  '*': 'Full access to all endpoints'
}

// Scope categories for UI grouping
export const SCOPE_CATEGORIES = {
  systemWide: {
    name: '🌍 System-Wide Access (Master Keys)',
    description: 'Cross-restaurant operations - requires super admin',
    scopes: [
      'read:all-restaurants',
      'read:restaurant-details',
      'write:restaurant-details',
      'manage:restaurants',
      'read:all-reservations',
      'write:reservations',
      'manage:reservations',
      'system:admin',
      'system:monitoring',
      'system:audit'
    ],
    requiresSuperAdmin: true
  },
  consumer: {
    name: '📱 Consumer App Operations',
    description: 'For consumer-facing booking/discovery apps',
    scopes: ['consumer:search', 'consumer:book', 'consumer:profile'],
    requiresSuperAdmin: true
  },
  menu: {
    name: 'Menu Management',
    scopes: ['read:menu', 'write:menu']
  },
  orders: {
    name: 'Orders',
    scopes: ['read:orders', 'write:orders']
  },
  payments: {
    name: 'Payments & Transactions',
    scopes: ['read:transactions', 'write:payments']
  },
  inventory: {
    name: 'Inventory',
    scopes: ['read:inventory', 'write:inventory']
  },
  customers: {
    name: 'Customers (CRM)',
    scopes: ['read:customers', 'write:customers']
  },
  reports: {
    name: 'Reports & Analytics',
    scopes: ['read:reports']
  },
  restaurant: {
    name: 'Restaurant Management',
    scopes: ['read:branches', 'write:branches', 'read:tables', 'write:tables', 'read:settings', 'write:settings']
  },
  staff: {
    name: 'Staff Management',
    scopes: ['read:staff', 'write:staff']
  },
  system: {
    name: 'System Administration',
    scopes: ['manage:webhooks', 'manage:api-keys', '*']
  }
}

// Default scopes for common use cases
export const PRESET_SCOPES = {
  // ===== SYSTEM-WIDE PRESETS =====
  // Consumer/Booking App (Master Key)
  consumer_app: [
    'read:all-restaurants',
    'read:restaurant-details',
    'write:reservations',
    'read:all-reservations',
    'consumer:search',
    'consumer:book',
    'consumer:profile'
  ],
  
  // Restaurant Discovery/Listing Platform
  restaurant_platform: [
    'read:all-restaurants',
    'read:restaurant-details',
    'consumer:search'
  ],
  
  // System Administrator (Master Key)
  system_admin: [
    'system:admin',
    'system:monitoring',
    'system:audit',
    'manage:restaurants',
    'read:all-restaurants'
  ],
  
  // Analytics/BI Platform (System-wide read-only)
  system_analytics: [
    'read:all-restaurants',
    'read:all-reservations',
    'system:monitoring'
  ],
  
  // ===== RESTAURANT-SPECIFIC PRESETS =====
  // Read-only access (for analytics, reporting tools)
  readonly: [
    'read:menu',
    'read:orders',
    'read:transactions',
    'read:inventory',
    'read:customers',
    'read:reports'
  ],
  
  // POS Terminal (can create orders, read menu)
  pos_terminal: [
    'read:menu',
    'write:orders',
    'write:payments',
    'read:inventory',
    'read:customers',
    'write:customers'
  ],
  
  // Delivery Integration (UberEats, DoorDash, etc.)
  delivery_integration: [
    'read:menu',
    'write:orders',
    'read:orders',
    'read:customers'
  ],
  
  // Inventory Management System
  inventory_system: [
    'read:inventory',
    'write:inventory',
    'read:menu',
    'write:menu'
  ],
  
  // Full access (use with caution!)
  admin: ['*']
}

/**
 * Check if a scope is valid
 */
export function isValidScope(scope) {
  return Object.keys(API_KEY_SCOPES).includes(scope)
}

/**
 * Validate an array of scopes
 */
export function validateScopes(scopes) {
  if (!Array.isArray(scopes)) {
    return { valid: false, error: 'Scopes must be an array' }
  }
  
  if (scopes.length === 0) {
    return { valid: false, error: 'At least one scope is required' }
  }
  
  const invalidScopes = scopes.filter(scope => !isValidScope(scope))
  
  if (invalidScopes.length > 0) {
    return { 
      valid: false, 
      error: `Invalid scopes: ${invalidScopes.join(', ')}` 
    }
  }
  
  return { valid: true }
}

/**
 * Check if scopes include wildcard
 */
export function hasWildcardScope(scopes) {
  return Array.isArray(scopes) && scopes.includes('*')
}

/**
 * Check if API key has required scope
 */
export function hasScope(apiKeyScopes, requiredScope) {
  if (!Array.isArray(apiKeyScopes)) {
    return false
  }
  
  // Wildcard gives all permissions
  if (apiKeyScopes.includes('*')) {
    return true
  }
  
  return apiKeyScopes.includes(requiredScope)
}

/**
 * Check if API key has ANY of the required scopes
 */
export function hasAnyScope(apiKeyScopes, requiredScopes) {
  if (!Array.isArray(apiKeyScopes) || !Array.isArray(requiredScopes)) {
    return false
  }
  
  // Wildcard gives all permissions
  if (apiKeyScopes.includes('*')) {
    return true
  }
  
  return requiredScopes.some(scope => apiKeyScopes.includes(scope))
}

/**
 * Check if API key has ALL required scopes
 */
export function hasAllScopes(apiKeyScopes, requiredScopes) {
  if (!Array.isArray(apiKeyScopes) || !Array.isArray(requiredScopes)) {
    return false
  }
  
  // Wildcard gives all permissions
  if (apiKeyScopes.includes('*')) {
    return true
  }
  
  return requiredScopes.every(scope => apiKeyScopes.includes(scope))
}

/**
 * Check if scope is system-wide (requires master key)
 */
export function isSystemWideScope(scope) {
  const systemScopes = [
    'read:all-restaurants',
    'read:restaurant-details',
    'write:restaurant-details',
    'manage:restaurants',
    'read:all-reservations',
    'write:reservations',
    'manage:reservations',
    'system:admin',
    'system:monitoring',
    'system:audit',
    'consumer:search',
    'consumer:book',
    'consumer:profile'
  ]
  
  return systemScopes.includes(scope) || scope === '*'
}

/**
 * Check if scopes require system-wide access
 */
export function requiresSystemAccess(scopes) {
  if (!Array.isArray(scopes)) {
    return false
  }
  
  return scopes.some(scope => isSystemWideScope(scope))
}

/**
 * Separate scopes into system-wide and restaurant-specific
 */
export function categorizeSopes(scopes) {
  if (!Array.isArray(scopes)) {
    return { systemScopes: [], restaurantScopes: [] }
  }
  
  const systemScopes = scopes.filter(scope => isSystemWideScope(scope))
  const restaurantScopes = scopes.filter(scope => !isSystemWideScope(scope))
  
  return { systemScopes, restaurantScopes }
}

export default {
  API_KEY_SCOPES,
  SCOPE_CATEGORIES,
  PRESET_SCOPES,
  isValidScope,
  validateScopes,
  hasWildcardScope,
  hasScope,
  hasAnyScope,
  hasAllScopes,
  isSystemWideScope,
  requiresSystemAccess,
  categorizeSopes
}
```

---

## Service Layer

The service layer (`api-key.service.js`) handles all business logic including:

- `createApiKey(data)` - Creates new API key with proper validation
- `getApiKeysByRestaurant(restaurantId, options)` - List keys with pagination
- `getApiKeyById(apiKeyId, restaurantId)` - Get single key
- `updateApiKey(apiKeyId, restaurantId, updates)` - Update key settings
- `revokeApiKey(apiKeyId, restaurantId, revokedBy, reason)` - Revoke key
- `deleteApiKey(apiKeyId, restaurantId)` - Hard delete
- `rotateApiKey(apiKeyId, restaurantId, rotatedBy)` - Rotate key
- `getApiKeyStats(apiKeyId, restaurantId)` - Get usage statistics
- `bulkRevokeApiKeys(apiKeyIds, restaurantId, revokedBy, reason)` - Bulk revoke
- `approveApiKey(apiKeyId, approvedBy, details)` - Approve system key
- `rejectApiKey(apiKeyId, rejectedBy, reason)` - Reject system key
- `getPendingApprovalKeys(filters)` - Get pending keys
- `getSystemKeys()` - Get system-wide keys

**Key Security Rules:**
- Restaurant keys cannot have system-wide scopes
- System keys rate limit max: 50,000/hour
- Full key shown only once during creation
- Approval required for system/partner keys

---

## Route Definitions

### api-key.route.js

```javascript
import express from 'express'
import { auth, authorize } from '../../../core/middlewares/auth.js'
import { apiKeyAuth } from '../../../core/middlewares/api-key-auth.js'
import { PERMISSIONS } from '../../../core/utils/permissions.js'
import apiKeyController from '../controllers/api-key.controller.js'

const router = express.Router()

// Get available scopes (no special permission needed)
router.route('/scopes').get(auth, apiKeyController.getScopes)

// Validate API key (for testing) - uses apiKeyAuth middleware
router.route('/validate').get(apiKeyAuth, apiKeyController.validateApiKey)

// System-wide key management (Super Admin only)
router.route('/pending').get(
  auth,
  authorize(PERMISSIONS.MANAGE_SYSTEM_API_KEYS, PERMISSIONS.SUPER_ADMIN),
  apiKeyController.getPendingKeys
)

router.route('/system').get(
  auth,
  authorize(PERMISSIONS.MANAGE_SYSTEM_API_KEYS, PERMISSIONS.SUPER_ADMIN),
  apiKeyController.getSystemKeys
)

// Bulk operations
router.route('/bulk-revoke').post(
  auth,
  authorize(PERMISSIONS.MANAGE_API_KEYS),
  apiKeyController.bulkRevokeApiKeys
)

// CRUD routes
router.route('/')
  .post(auth, authorize(PERMISSIONS.MANAGE_API_KEYS), apiKeyController.createApiKey)
  .get(auth, authorize(PERMISSIONS.MANAGE_API_KEYS), apiKeyController.getApiKeys)

router.route('/:id')
  .get(auth, authorize(PERMISSIONS.MANAGE_API_KEYS), apiKeyController.getApiKey)
  .patch(auth, authorize(PERMISSIONS.MANAGE_API_KEYS), apiKeyController.updateApiKey)
  .delete(auth, authorize(PERMISSIONS.MANAGE_API_KEYS), apiKeyController.deleteApiKey)

// Special actions
router.route('/:id/revoke').post(auth, authorize(PERMISSIONS.MANAGE_API_KEYS), apiKeyController.revokeApiKey)
router.route('/:id/rotate').post(auth, authorize(PERMISSIONS.MANAGE_API_KEYS), apiKeyController.rotateApiKey)
router.route('/:id/stats').get(auth, authorize(PERMISSIONS.MANAGE_API_KEYS), apiKeyController.getApiKeyStats)

// Approval workflow (Super Admin only)
router.route('/:id/approve').post(
  auth,
  authorize(PERMISSIONS.MANAGE_SYSTEM_API_KEYS, PERMISSIONS.APPROVE_API_KEYS, PERMISSIONS.SUPER_ADMIN),
  apiKeyController.approveApiKey
)
router.route('/:id/reject').post(
  auth,
  authorize(PERMISSIONS.MANAGE_SYSTEM_API_KEYS, PERMISSIONS.APPROVE_API_KEYS, PERMISSIONS.SUPER_ADMIN),
  apiKeyController.rejectApiKey
)

export default router
```

### Route Registration (routes-index.js)

```javascript
// API Keys
import apiKeyRoute from "../features/api-keys/routes/api-key.route.js"

// In routes array:
{
  path: "/api-keys",
  route: apiKeyRoute,
}
```

---

## Redis Configuration

### Required Environment Variables

```env
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password  # Optional
REDIS_DATABASE=0                    # Default: 0
REDIS_ENABLED=true                  # Default: true
```

### Rate Limiting Keys

```
api_key:{keyId}:rate_limit:{hourTimestamp}
```

- TTL: 3600 seconds (1 hour)
- Incremented on each request
- Checked against `rateLimit` field from API key

---

## Integration Examples

### 1. Create API Key (For Consumer API)

```bash
POST /api/v1/api-keys
Authorization: Bearer {jwt_token}

{
  "name": "Consumer API V2",
  "keyType": "system",
  "scopes": [
    "read:all-restaurants",
    "read:restaurant-details",
    "read:menu",
    "write:orders",
    "read:orders",
    "consumer:search",
    "consumer:book"
  ],
  "rateLimit": 10000,
  "environment": "production",
  "description": "API key for Consumer API V2 service",
  "tags": ["consumer", "production"]
}
```

### 2. Use API Key (From Consumer API)

```bash
GET /api/v1/restaurants
X-API-Key: appzap_pos_live_sk_abc123...
```

### 3. Validate API Key

```bash
GET /api/v1/api-keys/validate
X-API-Key: appzap_pos_live_sk_abc123...

# Response:
{
  "success": true,
  "data": {
    "valid": true,
    "keyId": "api_key_abc123",
    "keyType": "system",
    "name": "Consumer API V2",
    "scopes": ["read:all-restaurants", ...],
    "environment": "production",
    "rateLimit": 10000,
    "usageCount": 1234,
    "lastUsedAt": "2025-01-15T10:30:00Z"
  }
}
```

---

## Implementation Checklist

### For POS V1 (JavaScript/CommonJS)

- [ ] Create `api/src/models/ApiKey.js`
- [ ] Create `api/src/middlewares/apiKeyAuth.js`
- [ ] Create `api/src/utils/apiKeyGenerator.js`
- [ ] Create `api/src/constants/apiKeyScopes.js`
- [ ] Create `api/src/services/apiKey.service.js`
- [ ] Create `api/src/controllers/apiKey.controller.js`
- [ ] Create `api/src/routes/apiKey.routes.js`
- [ ] Register routes in main router
- [ ] Add Redis rate limiting support
- [ ] Add `MANAGE_API_KEYS` permission
- [ ] Create migration script (if needed)

### For POS V2 (Already Implemented - ES Modules)

- [x] Model: `src/features/api-keys/models/api-key.model.js`
- [x] Middleware: `src/core/middlewares/api-key-auth.js`
- [x] Generator: `src/core/utils/api-key-generator.js`
- [x] Scopes: `src/core/constants/api-key-scopes.js`
- [x] Service: `src/features/api-keys/services/api-key.service.js`
- [x] Controller: `src/features/api-keys/controllers/api-key.controller.js`
- [x] Routes: `src/features/api-keys/routes/api-key.route.js`
- [x] Route registration in `routes-index.js`
- [x] Redis rate limiting
- [x] Permissions system

### For Consumer API V2

- [ ] Update `src/services/posV1Api.service.ts` to use API key header
- [ ] Update `src/services/posV2Api.service.ts` to use API key header
- [ ] Store API keys in environment variables
- [ ] Add retry logic for rate limit errors

---

## Dependencies

```json
{
  "bcryptjs": "^2.4.3",
  "redis": "^4.6.7",
  "mongoose": "^8.0.0"
}
```

---

## Security Best Practices

1. **Never log full API keys** - Use `maskApiKey()` for logging
2. **Hash storage only** - Store only `keyHash` and `keyPrefix`
3. **Show key once** - Full key visible only at creation time
4. **IP whitelisting** - Enable for production system keys
5. **Key rotation** - Rotate keys regularly
6. **Minimal scopes** - Grant only required permissions
7. **Rate limiting** - Enforce per-key rate limits
8. **Audit logging** - Track all key operations
9. **Expiration dates** - Set expiry for system keys
10. **HTTPS only** - Never send API keys over HTTP

---

**Document Version:** 1.0.0  
**Last Updated:** February 2026  
**Source:** POS V2 (`appzap-pos-api-v2`)
