# Redis & Bull Queue Refactoring ✅

## Overview
Refactored the Redis and Bull Queue configuration to follow the **same pattern as the AppZap POS API** for consistency, maintainability, and easier cross-team collaboration.

## Changes Made

### 1. Redis Client (`src/config/redis.ts`) ✅

**Before:** Used `ioredis` package with manual configuration  
**After:** Uses `redis` package (v4) matching POS API pattern

#### Key Improvements:
- ✅ **Connection State Management** - Tracks connection status with retry logic
- ✅ **Enhanced Error Handling** - Max retry attempts (5) with exponential backoff
- ✅ **Pub/Sub Clients** - Dedicated clients for pub/sub operations (avoid blocking)
- ✅ **Health Checks** - `getRedisHealth()` and `getRedisMetrics()` for monitoring
- ✅ **Safe Operations** - `safeRedisOperation()` with fallback support
- ✅ **Graceful Shutdown** - Proper cleanup of all Redis connections
- ✅ **Cache Middleware** - Express middleware for response caching
- ✅ **Consistent Logging** - Emoji-prefixed logs matching POS API style

#### New Features:
```typescript
// Connection management
connectRedis() - Initialize all Redis clients
disconnectRedis() - Graceful shutdown

// Health & Monitoring
getRedisHealth() - Check connection status
getRedisMetrics() - Get performance metrics

// Operations
cache(duration) - Express cache middleware
clearCache(pattern) - Clear cache by pattern
safeRedisOperation(fn, fallback) - Safe execution with fallback

// Pub/Sub
publishEvent(channel, data)
subscribeToEvents(channels, callback)
unsubscribeFromEvents(channels)
isPubSubReady()
```

### 2. Bull Queue Configuration (`src/config/queue.ts`) ✅

**Updated to use `redis` package properly**

#### Improvements:
- ✅ **Redis URL Parsing** - Automatically parses `REDIS_URL` format
- ✅ **Queue Options** - Production-ready retry, backoff, and cleanup settings
- ✅ **Event Handlers** - Comprehensive logging for all queue events
- ✅ **Health Check** - `getQueuesHealth()` to monitor all queues
- ✅ **Graceful Shutdown** - `closeQueues()` for cleanup

#### 5 Queues Configured:
1. **subscription-orders** - Auto-generate subscription orders
2. **emails** - Send emails
3. **notifications** - Push notifications
4. **pos-sync** - Sync to POS V2 API
5. **supplier-sync** - Sync to Supplier API

#### Helper Functions:
```typescript
addSubscriptionOrderJob(subscriptionId, scheduledDate)
addEmailJob(emailData)
addNotificationJob(notificationData)
addPosSyncJob(orderId, orderData)
addSupplierSyncJob(orderId, orderData)
getQueuesHealth() - Monitor all queues
closeQueues() - Graceful shutdown
```

### 3. WebSocket Service (`src/services/websocket.service.ts`) ✅

**Updated imports to use new Redis clients**

```typescript
// Before
import { redisPubClient, redisSubClient } from '../config/redis';

// After
import { redisPublisher, redisSubscriber } from '../config/redis';
```

Added fallback for when Redis is unavailable:
```typescript
if (redisPublisher && redisSubscriber) {
  io.adapter(createAdapter(redisPublisher, redisSubscriber));
  logger.info('WebSocket using Redis adapter for scaling');
} else {
  logger.warn('WebSocket running without Redis adapter (single instance only)');
}
```

### 4. Environment Configuration (`src/config/env.ts`) ✅

**Added `redis.url` field**

```typescript
redis: {
  url: string;  // NEW: Full Redis URL
  host: string;
  port: number;
  password?: string;
  db: number;
  cacheTTL: number;
  tokenTTL: number;
}
```

Supports both formats:
- `REDIS_URL=redis://localhost:6379` (preferred)
- `REDIS_HOST=localhost` + `REDIS_PORT=6379` (fallback)

### 5. Package Dependencies (`package.json`) ✅

**Before:**
```json
{
  "ioredis": "^5.3.2",
  "socket.io-redis": "^6.1.1"
}
```

**After:**
```json
{
  "redis": "^4.6.11",
  "@socket.io/redis-adapter": "^8.2.1"
}
```

### 6. Server Initialization (`src/server.ts`) ✅

**Added proper Redis and Queue lifecycle management**

```typescript
// Startup
await connectDatabase();
await connectRedis();  // NEW

// Shutdown
await closeQueues();      // NEW
await disconnectRedis();  // NEW
```

---

## Benefits

### 1. **Consistency Across AppZap Ecosystem**
- Same pattern as POS API = easier for developers to work across services
- Shared knowledge and debugging techniques
- Copy-paste solutions between projects

### 2. **Production-Ready Features**
- Automatic reconnection with exponential backoff
- Connection state tracking
- Health checks and monitoring
- Graceful shutdown
- Fallback mechanisms

### 3. **Better Error Handling**
- Redis unavailable? App continues without caching
- Failed queue jobs? Automatic retry with backoff
- Stalled jobs? Automatic detection and recovery

### 4. **Observability**
- Detailed logging with emojis for quick scanning
- Metrics endpoint for monitoring tools
- Queue health checks
- Redis performance stats

### 5. **Scalability**
- Horizontal scaling with Redis adapter
- Multiple queue workers
- Pub/Sub for real-time features
- Connection pooling

---

## Migration Guide

### Environment Variables

**Update your `.env` file:**

```env
# Option 1: Full Redis URL (recommended)
REDIS_URL=redis://localhost:6379

# Option 2: Individual settings (fallback)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=yourpassword  # if needed
REDIS_DB=0
```

### Install New Dependencies

```bash
npm uninstall ioredis socket.io-redis
npm install redis@^4.6.11 @socket.io/redis-adapter@^8.2.1
```

### Code Updates

If you have custom Redis code using `ioredis`, update to `redis` v4:

**Before (ioredis):**
```typescript
import Redis from 'ioredis';
const redis = new Redis();
await redis.set('key', 'value');
const value = await redis.get('key');
```

**After (redis v4):**
```typescript
import { redisClient } from './config/redis';
await redisClient.set('key', 'value');
const value = await redisClient.get('key');
```

---

## Testing

### Test Redis Connection
```bash
npm run dev
# Should see:
# ✅ Redis client ready and connected
# ✅ Redis publisher client connected
# ✅ Redis subscriber client connected
```

### Test Queue
```typescript
import { addEmailJob } from './config/queue';

await addEmailJob({
  to: 'test@example.com',
  subject: 'Test',
  template: 'welcome',
  data: {}
});
```

### Check Health
```bash
curl http://localhost:9000/health/detailed
```

Should show Redis and Queue status.

---

## Monitoring

### Redis Metrics
```typescript
import { getRedisMetrics } from './config/redis';

const metrics = await getRedisMetrics();
console.log(metrics);
// {
//   available: true,
//   connected_clients: '2',
//   used_memory_human: '1.23M',
//   keyspace_hits: '1000',
//   keyspace_misses: '50'
// }
```

### Queue Health
```typescript
import { getQueuesHealth } from './config/queue';

const health = await getQueuesHealth();
console.log(health);
// {
//   subscriptionOrders: { waiting: 5, active: 1, completed: 100, failed: 2 },
//   emails: { waiting: 0, active: 0, completed: 500, failed: 1 },
//   ...
// }
```

---

## Troubleshooting

### Redis Connection Failed
```
💥 Failed to connect to Redis
⚠️ Application will continue without Redis caching
```
**Solution:** App will work without Redis, but caching/queues disabled. Check:
1. Redis server is running: `redis-cli ping`
2. REDIS_URL is correct in `.env`
3. Network connectivity

### Queue Jobs Not Processing
**Solution:** Make sure workers are initialized (coming in next phase)

### High Memory Usage
**Solution:** Adjust Bull queue cleanup settings:
```typescript
removeOnComplete: 100  // Keep fewer completed jobs
removeOnFail: 500      // Keep fewer failed jobs
```

---

## What's Next

### Phase 3 Remaining Tasks:
1. Queue Workers implementation
2. Market controllers
3. Delivery address endpoints
4. Identity linking endpoints

---

## Files Modified

### Updated:
- ✅ `src/config/redis.ts` - Complete rewrite following POS API pattern
- ✅ `src/config/queue.ts` - Updated to work with new Redis client
- ✅ `src/config/env.ts` - Added `redis.url` field
- ✅ `src/services/websocket.service.ts` - Updated imports
- ✅ `src/server.ts` - Added Redis/Queue lifecycle management
- ✅ `package.json` - Updated dependencies

### Documentation:
- ✅ `REDIS_QUEUE_REFACTORING.md` - This file

---

## Comparison: Before vs After

| Feature | Before (ioredis) | After (redis v4) |
|---------|-----------------|------------------|
| Package | `ioredis` | `redis` (matches POS API) |
| Connection State | Manual | Automatic with retry |
| Error Handling | Basic | Advanced with fallback |
| Health Checks | None | Built-in |
| Pub/Sub | Manual setup | Dedicated clients |
| Monitoring | None | Metrics + health |
| Graceful Shutdown | Partial | Complete |
| Logging | Basic | Enhanced with emojis |
| Consistency | Unique | Matches POS API ✅ |

---

## Conclusion

✅ **Redis and Bull Queue now follow the proven POS API pattern**  
✅ **Production-ready with robust error handling**  
✅ **Easy to maintain across the AppZap ecosystem**  
✅ **Ready for Phase 3 continuation**

All changes are backward compatible and the API continues to function identically from the client perspective.

---

*Last Updated: December 23, 2025*
*Refactored by: AppZap Team*

