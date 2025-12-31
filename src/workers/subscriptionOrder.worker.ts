import { subscriptionOrderQueue } from '../config/queue';
import * as subscriptionService from '../services/subscription.service';
import logger from '../utils/logger';

/**
 * Subscription Order Worker
 * Processes jobs to generate orders from subscriptions
 */

subscriptionOrderQueue.process(async (job) => {
  const { subscriptionId, scheduledDate } = job.data;

  logger.info('🔄 Processing subscription order job', {
    jobId: job.id,
    subscriptionId,
    scheduledDate,
  });

  try {
    // Generate order from subscription
    const result = await subscriptionService.generateOrderFromSubscription(subscriptionId);

    logger.info('✅ Subscription order generated successfully', {
      jobId: job.id,
      subscriptionId,
      orderId: result.orderId,
      orderCode: result.orderCode,
    });

    return result;
  } catch (error: any) {
    logger.error('❌ Failed to generate subscription order', {
      jobId: job.id,
      subscriptionId,
      error: error.message,
      stack: error.stack,
    });

    // Throw error to trigger retry
    throw error;
  }
});

logger.info('📦 Subscription order worker initialized');

export default subscriptionOrderQueue;


