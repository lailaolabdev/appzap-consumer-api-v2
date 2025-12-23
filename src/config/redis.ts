import { createClient } from 'redis';
import config from './env';
import logger from '../utils/logger';

/**
 * Redis Configuration for AppZap Consumer API
 * Following the same pattern as POS API for consistency and maintainability
 */

// Redis connection state
let isRedisConnected = false;
let connectionAttempts = 0;
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 2000;

// Create Redis clients with production-ready configuration
const redisOptions = {
  url: config.redis.url,
  socket: {
    connectTimeout: 10000, // 10 seconds
    lazyConnect: true,
    reconnectStrategy: (retries: number) => {
      if (retries > MAX_RETRY_ATTEMPTS) {
        logger.error(`Redis max retry attempts (${MAX_RETRY_ATTEMPTS}) exceeded`);
        return false; // Stop retrying
      }
      const delay = Math.min(retries * RETRY_DELAY_MS, 10000);
      logger.warn(`Redis reconnecting in ${delay}ms (attempt ${retries}/${MAX_RETRY_ATTEMPTS})`);
      return delay;
    },
  },
  // Production settings
  database: config.redis.db || 0,
  password: config.redis.password,
  name: 'appzap-consumer-api',
};

// Main Redis client for caching, sessions, rate limiting
export const redisClient = createClient(redisOptions);

// Dedicated Redis clients for pub/sub (avoid blocking cache operations)
export let redisPublisher: any = null;
export let redisSubscriber: any = null;

// Enhanced event handlers
redisClient.on('connect', () => {
  logger.info('🔄 Redis client connecting...');
});

redisClient.on('ready', () => {
  isRedisConnected = true;
  connectionAttempts = 0;
  logger.info('✅ Redis client ready and connected');
});

redisClient.on('error', (err: Error) => {
  isRedisConnected = false;
  connectionAttempts++;
  logger.error('❌ Redis client error:', {
    error: err.message,
    attempts: connectionAttempts,
    timestamp: new Date().toISOString(),
  });
});

redisClient.on('end', () => {
  isRedisConnected = false;
  logger.warn('⚠️ Redis connection ended');
});

redisClient.on('reconnecting', () => {
  logger.info('🔄 Redis client reconnecting...');
});

// Initialize pub/sub clients
const initializePubSubClients = async () => {
  try {
    if (!redisPublisher) {
      redisPublisher = createClient({ ...redisOptions, name: 'appzap-consumer-api-publisher' });
      await redisPublisher.connect();
      logger.info('✅ Redis publisher client connected');
    }

    if (!redisSubscriber) {
      redisSubscriber = createClient({ ...redisOptions, name: 'appzap-consumer-api-subscriber' });
      await redisSubscriber.connect();
      logger.info('✅ Redis subscriber client connected');
    }
  } catch (error: any) {
    logger.error('❌ Failed to initialize Redis pub/sub clients:', error.message);
    // Don't throw - pub/sub is optional for main API functionality
  }
};

// Connect to Redis with enhanced error handling
export const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
      logger.info('🚀 Redis client connected successfully');

      // Test the connection
      await redisClient.ping();
      logger.info('📡 Redis ping successful');
    }

    // Initialize pub/sub clients for real-time features
    await initializePubSubClients();
  } catch (error: any) {
    isRedisConnected = false;
    logger.error('💥 Failed to connect to Redis:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    // Don't throw error - allow app to continue without Redis
    logger.warn('⚠️ Application will continue without Redis caching');
  }
};

// Graceful Redis shutdown
export const disconnectRedis = async () => {
  try {
    // Close pub/sub clients first
    if (redisPublisher && redisPublisher.isOpen) {
      await redisPublisher.quit();
      logger.info('🔒 Redis publisher connection closed');
    }

    if (redisSubscriber && redisSubscriber.isOpen) {
      await redisSubscriber.quit();
      logger.info('🔒 Redis subscriber connection closed');
    }

    // Close main client
    if (redisClient.isOpen) {
      await redisClient.quit();
      logger.info('🔒 Redis main connection closed gracefully');
    }
  } catch (error: any) {
    logger.error('❌ Error closing Redis connections:', error.message);
  }
};

// Health check function
export const getRedisHealth = async () => {
  try {
    if (!isRedisConnected || !redisClient.isOpen) {
      return {
        status: 'disconnected',
        connected: false,
        error: 'Redis client not connected',
      };
    }

    const start = Date.now();
    await redisClient.ping();
    const latency = Date.now() - start;

    const info = await redisClient.info('memory');
    const memoryUsage =
      info
        .split('\r\n')
        .find((line) => line.startsWith('used_memory_human:'))
        ?.split(':')[1] || 'unknown';

    return {
      status: 'connected',
      connected: true,
      latency: `${latency}ms`,
      memoryUsage,
      uptime:
        info
          .split('\r\n')
          .find((line) => line.startsWith('uptime_in_seconds:'))
          ?.split(':')[1] || 'unknown',
    };
  } catch (error: any) {
    return {
      status: 'error',
      connected: false,
      error: error.message,
    };
  }
};

// Enhanced cache middleware with fallback
export const cache = (duration = 300) => {
  return async (req: any, res: any, next: any) => {
    // Skip cache for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip if Redis is not available
    if (!isRedisConnected || !redisClient.isOpen) {
      logger.debug('🔄 Redis unavailable, skipping cache');
      return next();
    }

    // Create a unique key based on the request
    const key = `cache:${req.originalUrl || req.url}:${JSON.stringify(req.query)}:${req.user?._id || 'anonymous'}`;

    try {
      // Check if key exists in Redis
      const cachedResponse = await redisClient.get(key);

      if (cachedResponse) {
        logger.debug(`📦 Cache HIT for key: ${key}`);
        return res.json(JSON.parse(cachedResponse));
      }

      logger.debug(`📭 Cache MISS for key: ${key}`);

      // If not cached, replace res.json with custom function
      const originalJson = res.json;
      res.json = function (body: any) {
        // Cache the response if Redis is available
        if (isRedisConnected && redisClient.isOpen) {
          redisClient
            .setEx(key, duration, JSON.stringify(body))
            .catch((err: Error) => logger.warn('⚠️ Failed to cache response:', err.message));
        }
        // Call the original json function
        return originalJson.call(this, body);
      };

      next();
    } catch (error: any) {
      logger.warn('⚠️ Redis cache error, continuing without cache:', error.message);
      next();
    }
  };
};

// Clear cache by pattern with error handling
export const clearCache = async (pattern: string): Promise<number> => {
  try {
    if (!isRedisConnected || !redisClient.isOpen) {
      logger.warn('⚠️ Cannot clear cache: Redis not connected');
      return 0;
    }

    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
      logger.info(`🧹 Cleared ${keys.length} cache entries matching ${pattern}`);
      return keys.length;
    }
    return 0;
  } catch (error: any) {
    logger.error('❌ Redis clear cache error:', error.message);
    return 0;
  }
};

// Safe Redis operations with fallback
export const safeRedisOperation = async <T>(operation: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    if (!isRedisConnected || !redisClient.isOpen) {
      logger.debug('🔄 Redis unavailable, using fallback');
      return fallback;
    }
    return await operation();
  } catch (error: any) {
    logger.warn('⚠️ Redis operation failed, using fallback:', error.message);
    return fallback;
  }
};

// Get Redis metrics for monitoring
export const getRedisMetrics = async () => {
  try {
    if (!isRedisConnected || !redisClient.isOpen) {
      return { available: false };
    }

    const info = await redisClient.info();
    const lines = info.split('\r\n');

    const getInfoValue = (key: string) => {
      const line = lines.find((l) => l.startsWith(`${key}:`));
      return line ? line.split(':')[1] : null;
    };

    return {
      available: true,
      connected_clients: getInfoValue('connected_clients'),
      used_memory_human: getInfoValue('used_memory_human'),
      used_memory_peak_human: getInfoValue('used_memory_peak_human'),
      total_commands_processed: getInfoValue('total_commands_processed'),
      instantaneous_ops_per_sec: getInfoValue('instantaneous_ops_per_sec'),
      keyspace_hits: getInfoValue('keyspace_hits'),
      keyspace_misses: getInfoValue('keyspace_misses'),
      uptime_in_seconds: getInfoValue('uptime_in_seconds'),
    };
  } catch (error: any) {
    logger.error('❌ Failed to get Redis metrics:', error.message);
    return { available: false, error: error.message };
  }
};

// Pub/Sub operations for real-time features
export const publishEvent = async (channel: string, data: any): Promise<boolean> => {
  try {
    if (!redisPublisher || !redisPublisher.isOpen) {
      logger.warn(`⚠️ Cannot publish to ${channel}: Publisher not connected`);
      return false;
    }

    const message = typeof data === 'string' ? data : JSON.stringify(data);
    await redisPublisher.publish(channel, message);
    logger.debug(`📤 Published to ${channel}`);
    return true;
  } catch (error: any) {
    logger.error(`❌ Failed to publish to ${channel}:`, error.message);
    return false;
  }
};

export const subscribeToEvents = async (
  channels: string | string[],
  callback: (channel: string, data: any) => void
): Promise<boolean> => {
  try {
    if (!redisSubscriber || !redisSubscriber.isOpen) {
      logger.warn(`⚠️ Cannot subscribe: Subscriber not connected`);
      return false;
    }

    // Subscribe to channels
    await redisSubscriber.subscribe(channels, (message: string, channel: string) => {
      try {
        const data = JSON.parse(message);
        logger.debug(`📥 Received from ${channel}`);
        callback(channel, data);
      } catch (error: any) {
        logger.error(`❌ Failed to parse message from ${channel}:`, error.message);
        callback(channel, message); // Send raw message if JSON parse fails
      }
    });

    const channelList = Array.isArray(channels) ? channels.join(', ') : channels;
    logger.info(`📡 Subscribed to channels: ${channelList}`);
    return true;
  } catch (error: any) {
    logger.error(`❌ Failed to subscribe to channels:`, error.message);
    return false;
  }
};

export const unsubscribeFromEvents = async (channels: string | string[]): Promise<boolean> => {
  try {
    if (!redisSubscriber || !redisSubscriber.isOpen) {
      return false;
    }

    await redisSubscriber.unsubscribe(channels);
    const channelList = Array.isArray(channels) ? channels.join(', ') : channels;
    logger.info(`📡 Unsubscribed from channels: ${channelList}`);
    return true;
  } catch (error: any) {
    logger.error(`❌ Failed to unsubscribe:`, error.message);
    return false;
  }
};

// Check if pub/sub clients are ready
export const isPubSubReady = (): boolean => {
  return redisPublisher?.isOpen && redisSubscriber?.isOpen;
};

// Export connection status
export { isRedisConnected };

export default {
  redisClient,
  connectRedis,
  disconnectRedis,
  cache,
  clearCache,
  isRedisConnected,
  getRedisHealth,
  safeRedisOperation,
  getRedisMetrics,
  publishEvent,
  subscribeToEvents,
  unsubscribeFromEvents,
  isPubSubReady,
  redisPublisher,
  redisSubscriber,
};
