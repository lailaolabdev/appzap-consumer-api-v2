/**
 * Notification Broadcast Worker
 * Processes push notification broadcast jobs via Bull queue
 * Sends FCM notifications in batches of 500 (sendEachForMulticast limit)
 */

import { notificationQueue } from '../config/queue';
import { getMessaging } from '../config/firebase';
import { Notification } from '../models/Notification';
import Broadcast from '../models/Broadcast';
import DeviceToken from '../models/DeviceToken';
import { emitNotification } from '../services/websocket.service';
import logger from '../utils/logger';

const FCM_BATCH_SIZE = 500;

interface BroadcastJobData {
  title: string;
  body: string;
  deepLinkUrl?: string;
  fcmTokens: string[];
  broadcastId: string;
}

notificationQueue.process(async (job) => {
  const { title, body, deepLinkUrl, fcmTokens, broadcastId } = job.data as BroadcastJobData;

  logger.info('Processing notification broadcast', {
    broadcastId,
    totalTokens: fcmTokens.length,
  });

  // Update broadcast status to sending
  await Broadcast.findByIdAndUpdate(broadcastId, { status: 'sending' });

  // 1. Always create notification history records for targeted users
  let userIds: string[] = [];
  try {
    const deviceTokens = await DeviceToken.find({
      fcmToken: { $in: fcmTokens },
    }).select('user');

    userIds = [...new Set(deviceTokens.map(d => d.user.toString()))];

    if (userIds.length > 0) {
      const notifications = userIds.map(userId => ({
        userId,
        title,
        body,
        type: 'general' as const,
        data: { broadcastId, deepLinkUrl },
        isRead: false,
      }));

      await Notification.insertMany(notifications);

      // Emit real-time WebSocket events so connected clients see it immediately
      for (const userId of userIds) {
        try {
          emitNotification(userId, { title, body, type: 'general', broadcastId, deepLinkUrl });
        } catch {
          // WebSocket may not be initialized in worker context — that's fine
        }
      }

      logger.info('Notification history records created', {
        broadcastId,
        userCount: userIds.length,
      });
    }
  } catch (error: any) {
    logger.error('Failed to create notification history', {
      broadcastId,
      error: error.message,
    });
  }

  // 2. Attempt FCM delivery (optional — works without Firebase configured)
  const messaging = getMessaging();
  let totalSent = 0;
  let totalFailed = 0;

  if (!messaging) {
    logger.warn('Firebase Messaging not available — skipping FCM delivery. Notification records were still created.', {
      broadcastId,
    });
    totalFailed = fcmTokens.length;
  } else {
    // Chunk tokens into batches of 500
    for (let i = 0; i < fcmTokens.length; i += FCM_BATCH_SIZE) {
      const batch = fcmTokens.slice(i, i + FCM_BATCH_SIZE);

      try {
        const response = await messaging.sendEachForMulticast({
          tokens: batch,
          notification: { title, body },
          data: deepLinkUrl ? { deepLinkUrl } : undefined,
        });

        totalSent += response.successCount;
        totalFailed += response.failureCount;

        // Deactivate invalid tokens
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
            failedTokens.push(batch[idx]);
          }
        });

        if (failedTokens.length > 0) {
          await DeviceToken.updateMany(
            { fcmToken: { $in: failedTokens } },
            { isActive: false }
          );
        }

        // Report progress
        await job.progress(Math.round(((i + batch.length) / fcmTokens.length) * 100));
      } catch (error: any) {
        logger.error('FCM batch send failed', {
          broadcastId,
          batchStart: i,
          error: error.message,
        });
        totalFailed += batch.length;
      }
    }
  }

  // 3. Update broadcast with final stats
  const hasRecords = userIds.length > 0;
  await Broadcast.findByIdAndUpdate(broadcastId, {
    status: totalSent > 0 ? 'completed' : (hasRecords ? 'completed_without_push' : 'failed'),
    'stats.sent': totalSent,
    'stats.failed': totalFailed,
    completedAt: new Date(),
  });

  logger.info('Notification broadcast completed', {
    broadcastId,
    totalSent,
    totalFailed,
    notificationRecordsCreated: userIds.length,
  });

  return { broadcastId, totalSent, totalFailed, notificationRecordsCreated: userIds.length };
});

logger.info('Notification broadcast worker initialized');
