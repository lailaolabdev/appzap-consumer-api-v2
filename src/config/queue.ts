import Queue from 'bull';
import config from './env';
import logger from '../utils/logger';

/**
 * Bull Queue Configuration
 * Uses Redis for job persistence and processing
 * Following the same pattern as POS API for consistency
 */

// Parse Redis URL to extract host and port
const parseRedisUrl = (url: string) => {
  try {
    const urlObj = new URL(url);
    return {
      host: urlObj.hostname,
      port: parseInt(urlObj.port) || 6379,
      password: urlObj.password || undefined,
      db: parseInt(urlObj.pathname.slice(1)) || 0,
    };
  } catch (error) {
    // Fallback for simple host:port format
    const [host, port] = url.split(':');
    return {
      host: host || 'localhost',
      port: parseInt(port) || 6379,
    };
  }
};

const redisConfig = parseRedisUrl(config.redis.url);

// Queue options
const queueOptions = {
  redis: {
    host: redisConfig.host,
    port: redisConfig.port,
    password: redisConfig.password,
    db: redisConfig.db,
  },
  defaultJobOptions: {
    attempts: 3, // Retry failed jobs 3 times
    backoff: {
      type: 'exponential' as const,
      delay: 2000, // Start with 2 seconds
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 500, // Keep last 500 failed jobs
  },
  settings: {
    lockDuration: 30000, // 30 seconds
    stalledInterval: 30000, // Check for stalled jobs every 30 seconds
    maxStalledCount: 2, // Max times a job can be stalled before being failed
  },
};

// ============================================================================
// QUEUES
// ============================================================================

/**
 * Subscription Order Queue
 * Handles automatic generation of subscription orders
 */
export const subscriptionOrderQueue = new Queue('subscription-orders', queueOptions);

/**
 * Email Queue
 * Handles sending emails
 */
export const emailQueue = new Queue('emails', queueOptions);

/**
 * Notification Queue
 * Handles push notifications
 */
export const notificationQueue = new Queue('notifications', queueOptions);

/**
 * POS Sync Queue
 * Handles syncing orders to POS V2
 */
export const posSyncQueue = new Queue('pos-sync', queueOptions);

/**
 * Supplier Sync Queue
 * Handles syncing orders to Supplier API
 */
export const supplierSyncQueue = new Queue('supplier-sync', queueOptions);

// ============================================================================
// QUEUE EVENT HANDLERS
// ============================================================================

// Subscription Order Queue Events
subscriptionOrderQueue.on('completed', (job, result) => {
  logger.info('✅ Subscription order job completed', {
    jobId: job.id,
    subscriptionId: job.data.subscriptionId,
    orderId: result?.orderId,
  });
});

subscriptionOrderQueue.on('failed', (job, err) => {
  logger.error('❌ Subscription order job failed', {
    jobId: job.id,
    subscriptionId: job.data.subscriptionId,
    error: err.message,
    attempts: job.attemptsMade,
  });
});

subscriptionOrderQueue.on('stalled', (job) => {
  logger.warn('⚠️ Subscription order job stalled', {
    jobId: job.id,
    subscriptionId: job.data.subscriptionId,
  });
});

subscriptionOrderQueue.on('error', (error) => {
  logger.error('❌ Subscription order queue error', { error: error.message });
});

// Email Queue Events
emailQueue.on('completed', (job) => {
  logger.info('✅ Email job completed', {
    jobId: job.id,
    to: job.data.to,
    subject: job.data.subject,
  });
});

emailQueue.on('failed', (job, err) => {
  logger.error('❌ Email job failed', {
    jobId: job.id,
    to: job.data.to,
    error: err.message,
  });
});

emailQueue.on('error', (error) => {
  logger.error('❌ Email queue error', { error: error.message });
});

// Notification Queue Events
notificationQueue.on('completed', (job) => {
  logger.info('✅ Notification job completed', {
    jobId: job.id,
    userId: job.data.userId,
  });
});

notificationQueue.on('failed', (job, err) => {
  logger.error('❌ Notification job failed', {
    jobId: job.id,
    userId: job.data.userId,
    error: err.message,
  });
});

notificationQueue.on('error', (error) => {
  logger.error('❌ Notification queue error', { error: error.message });
});

// POS Sync Queue Events
posSyncQueue.on('completed', (job, result) => {
  logger.info('✅ POS sync job completed', {
    jobId: job.id,
    orderId: job.data.orderId,
    posOrderId: result?.posOrderId,
  });
});

posSyncQueue.on('failed', (job, err) => {
  logger.error('❌ POS sync job failed', {
    jobId: job.id,
    orderId: job.data.orderId,
    error: err.message,
  });
});

posSyncQueue.on('error', (error) => {
  logger.error('❌ POS sync queue error', { error: error.message });
});

// Supplier Sync Queue Events
supplierSyncQueue.on('completed', (job, result) => {
  logger.info('✅ Supplier sync job completed', {
    jobId: job.id,
    orderId: job.data.orderId,
    supplierOrderId: result?.supplierOrderId,
  });
});

supplierSyncQueue.on('failed', (job, err) => {
  logger.error('❌ Supplier sync job failed', {
    jobId: job.id,
    orderId: job.data.orderId,
    error: err.message,
  });
});

supplierSyncQueue.on('error', (error) => {
  logger.error('❌ Supplier sync queue error', { error: error.message });
});

// ============================================================================
// QUEUE HELPERS
// ============================================================================

/**
 * Add job to subscription order queue
 */
export const addSubscriptionOrderJob = async (
  subscriptionId: string,
  scheduledDate: Date
) => {
  const job = await subscriptionOrderQueue.add(
    {
      subscriptionId,
      scheduledDate,
    },
    {
      jobId: `sub-${subscriptionId}-${scheduledDate.getTime()}`,
      delay: Math.max(0, scheduledDate.getTime() - Date.now()), // Delay until scheduled date
    }
  );

  logger.info('📋 Subscription order job added', {
    jobId: job.id,
    subscriptionId,
    scheduledDate,
  });

  return job;
};

/**
 * Add job to email queue
 */
export const addEmailJob = async (emailData: {
  to: string;
  subject: string;
  template: string;
  data: any;
}) => {
  const job = await emailQueue.add(emailData);
  logger.info('📋 Email job added', { jobId: job.id, to: emailData.to });
  return job;
};

/**
 * Add job to notification queue (single user notification)
 */
export const addNotificationJob = async (notificationData: {
  userId: string;
  title: string;
  body: string;
  data?: any;
}) => {
  const job = await notificationQueue.add(notificationData);
  logger.info('📋 Notification job added', { jobId: job.id, userId: notificationData.userId });
  return job;
};

/**
 * Add broadcast job to notification queue
 */
export const addBroadcastJob = async (broadcastData: {
  title: string;
  body: string;
  deepLinkUrl?: string;
  fcmTokens: string[];
  broadcastId: string;
}) => {
  const job = await notificationQueue.add(broadcastData, {
    attempts: 2,
    backoff: { type: 'exponential' as const, delay: 5000 },
  });
  logger.info('📋 Broadcast job added', { jobId: job.id, broadcastId: broadcastData.broadcastId });
  return job;
};

/**
 * Add job to POS sync queue
 */
export const addPosSyncJob = async (orderId: string, orderData: any) => {
  const job = await posSyncQueue.add({ orderId, orderData });
  logger.info('📋 POS sync job added', { jobId: job.id, orderId });
  return job;
};

/**
 * Add job to supplier sync queue
 */
export const addSupplierSyncJob = async (orderId: string, orderData: any) => {
  const job = await supplierSyncQueue.add({ orderId, orderData });
  logger.info('📋 Supplier sync job added', { jobId: job.id, orderId });
  return job;
};

// ============================================================================
// QUEUE HEALTH CHECK
// ============================================================================

export const getQueuesHealth = async () => {
  try {
    const [
      subOrderCounts,
      emailCounts,
      notificationCounts,
      posCounts,
      supplierCounts,
    ] = await Promise.all([
      subscriptionOrderQueue.getJobCounts(),
      emailQueue.getJobCounts(),
      notificationQueue.getJobCounts(),
      posSyncQueue.getJobCounts(),
      supplierSyncQueue.getJobCounts(),
    ]);

    return {
      subscriptionOrders: subOrderCounts,
      emails: emailCounts,
      notifications: notificationCounts,
      posSync: posCounts,
      supplierSync: supplierCounts,
    };
  } catch (error: any) {
    logger.error('❌ Failed to get queue health', { error: error.message });
    return {
      error: error.message,
    };
  }
};

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

export const closeQueues = async () => {
  logger.info('🔄 Closing Bull queues...');
  try {
    await Promise.all([
      subscriptionOrderQueue.close(),
      emailQueue.close(),
      notificationQueue.close(),
      posSyncQueue.close(),
      supplierSyncQueue.close(),
    ]);
    logger.info('✅ All Bull queues closed gracefully');
  } catch (error: any) {
    logger.error('❌ Error closing queues', { error: error.message });
  }
};

// ============================================================================
// EXPORT
// ============================================================================

export default {
  subscriptionOrderQueue,
  emailQueue,
  notificationQueue,
  posSyncQueue,
  supplierSyncQueue,
  addSubscriptionOrderJob,
  addEmailJob,
  addNotificationJob,
  addBroadcastJob,
  addPosSyncJob,
  addSupplierSyncJob,
  getQueuesHealth,
  closeQueues,
};
