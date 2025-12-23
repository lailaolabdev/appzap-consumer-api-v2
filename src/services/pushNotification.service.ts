import { getMessaging } from '../config/firebase';
import User from '../models/User';
import logger from '../utils/logger';
import { addNotificationJob } from '../config/queue';

/**
 * Push Notification Service
 * Sends push notifications via Firebase Cloud Messaging
 */

export interface SendNotificationParams {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  deepLink?: string;
  priority?: 'high' | 'normal';
  sound?: string;
}

// ============================================================================
// SEND NOTIFICATIONS
// ============================================================================

/**
 * Send push notification to user
 */
export const sendNotification = async (params: SendNotificationParams): Promise<boolean> => {
  try {
    const messaging = getMessaging();
    if (!messaging) {
      logger.warn('Firebase Messaging not available, queuing notification');
      await addNotificationJob({
        userId: params.userId,
        title: params.title,
        body: params.body,
        data: params.data,
      });
      return false;
    }

    // Get user's FCM token
    const user = await User.findById(params.userId);
    if (!user || !user.fcmToken) {
      logger.warn('User FCM token not found', { userId: params.userId });
      return false;
    }

    // Build notification message
    const message: any = {
      token: user.fcmToken,
      notification: {
        title: params.title,
        body: params.body,
      },
      data: {
        ...params.data,
        userId: params.userId,
        timestamp: new Date().toISOString(),
      },
      android: {
        priority: params.priority || 'high',
        notification: {
          sound: params.sound || 'default',
          clickAction: params.deepLink || 'FLUTTER_NOTIFICATION_CLICK',
          imageUrl: params.imageUrl,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: params.sound || 'default',
            badge: 1,
          },
        },
        fcm_options: {
          image: params.imageUrl,
        },
      },
    };

    // Add deep link if provided
    if (params.deepLink) {
      message.data.deepLink = params.deepLink;
    }

    // Send notification
    const response = await messaging.send(message);

    logger.info('Push notification sent', {
      userId: params.userId,
      title: params.title,
      messageId: response,
    });

    return true;
  } catch (error: any) {
    logger.error('Failed to send push notification', {
      userId: params.userId,
      error: error.message,
    });
    return false;
  }
};

// ============================================================================
// NOTIFICATION TEMPLATES
// ============================================================================

/**
 * Send order confirmation notification
 */
export const sendOrderConfirmationNotification = async (params: {
  userId: string;
  orderCode: string;
  restaurantName?: string;
  total: number;
  deepLink: string;
}) => {
  return await sendNotification({
    userId: params.userId,
    title: '🎉 Order Confirmed!',
    body: params.restaurantName
      ? `Your order from ${params.restaurantName} is confirmed! Track it in the app.`
      : `Order ${params.orderCode} is confirmed! Total: ${params.total.toLocaleString()} LAK`,
    data: {
      type: 'order_confirmation',
      orderCode: params.orderCode,
      total: params.total.toString(),
    },
    deepLink: params.deepLink,
    imageUrl: `${process.env.CDN_URL}/assets/order-confirmed.png`,
    priority: 'high',
  });
};

/**
 * Send spin-to-win invitation notification
 */
export const sendSpinToWinNotification = async (params: {
  userId: string;
  orderCode: string;
  deepLink: string;
}) => {
  return await sendNotification({
    userId: params.userId,
    title: '🎰 Spin to Win FREE Rewards!',
    body: `Order ${params.orderCode} is ready! Download the app and spin the wheel to win FREE beer, discounts & more! 🍺🎁`,
    data: {
      type: 'spin_to_win',
      orderCode: params.orderCode,
      action: 'spin_wheel',
    },
    deepLink: params.deepLink,
    imageUrl: `${process.env.CDN_URL}/assets/spin-to-win.gif`,
    priority: 'high',
    sound: 'spin_sound',
  });
};

/**
 * Send order status update notification
 */
export const sendOrderStatusNotification = async (params: {
  userId: string;
  orderCode: string;
  status: string;
  message: string;
  deepLink: string;
}) => {
  const statusEmojis: Record<string, string> = {
    confirmed: '✅',
    cooking: '👨‍🍳',
    ready: '🎉',
    delivered: '✅',
    cancelled: '❌',
  };

  return await sendNotification({
    userId: params.userId,
    title: `${statusEmojis[params.status] || '📦'} Order ${params.status}`,
    body: params.message,
    data: {
      type: 'order_status',
      orderCode: params.orderCode,
      status: params.status,
    },
    deepLink: params.deepLink,
    priority: 'high',
  });
};

/**
 * Send loyalty points earned notification
 */
export const sendLoyaltyPointsNotification = async (params: {
  userId: string;
  points: number;
  balance: number;
}) => {
  return await sendNotification({
    userId: params.userId,
    title: '🎁 Loyalty Points Earned!',
    body: `You earned ${params.points} points! Your new balance: ${params.balance} points`,
    data: {
      type: 'loyalty_points',
      points: params.points.toString(),
      balance: params.balance.toString(),
    },
    priority: 'normal',
  });
};

/**
 * Send promotional notification
 */
export const sendPromotionalNotification = async (params: {
  userId: string;
  title: string;
  body: string;
  imageUrl?: string;
  deepLink?: string;
  data?: Record<string, string>;
}) => {
  return await sendNotification({
    ...params,
    priority: 'normal',
  });
};

// ============================================================================
// BULK NOTIFICATIONS
// ============================================================================

/**
 * Send notification to multiple users
 */
export const sendBulkNotifications = async (params: {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  deepLink?: string;
}) => {
  const results = await Promise.allSettled(
    params.userIds.map((userId) =>
      sendNotification({
        userId,
        title: params.title,
        body: params.body,
        data: params.data,
        deepLink: params.deepLink,
      })
    )
  );

  const successCount = results.filter((r) => r.status === 'fulfilled' && r.value).length;
  const failureCount = results.length - successCount;

  logger.info('Bulk notifications sent', {
    total: params.userIds.length,
    success: successCount,
    failure: failureCount,
  });

  return {
    total: params.userIds.length,
    success: successCount,
    failure: failureCount,
  };
};

// ============================================================================
// FCM TOKEN MANAGEMENT
// ============================================================================

/**
 * Update user's FCM token
 */
export const updateFCMToken = async (userId: string, fcmToken: string): Promise<void> => {
  await User.findByIdAndUpdate(userId, { fcmToken });
  logger.info('FCM token updated', { userId });
};

/**
 * Remove user's FCM token
 */
export const removeFCMToken = async (userId: string): Promise<void> => {
  await User.findByIdAndUpdate(userId, { $unset: { fcmToken: 1 } });
  logger.info('FCM token removed', { userId });
};

// ============================================================================
// EXPORT
// ============================================================================

export default {
  sendNotification,
  sendOrderConfirmationNotification,
  sendSpinToWinNotification,
  sendOrderStatusNotification,
  sendLoyaltyPointsNotification,
  sendPromotionalNotification,
  sendBulkNotifications,
  updateFCMToken,
  removeFCMToken,
};

