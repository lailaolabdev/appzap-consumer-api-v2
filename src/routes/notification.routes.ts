import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import * as pushNotificationService from '../services/pushNotification.service';
import DeviceToken from '../models/DeviceToken';
import { Notification, NotificationPreferences } from '../models/Notification';
import logger from '../utils/logger';
import { ValidationError } from '../utils/errors';

const router = Router();

// ============================================================================
// DEVICE REGISTRATION (for anonymous users before login)
// ============================================================================

/**
 * @route   POST /api/v1/notifications/register-device
 * @desc    Register device for push notifications (works for anonymous users)
 * @access  Public/Private
 * @body    token, platform, deviceInfo
 */
router.post('/register-device', optionalAuthenticate, async (req, res) => {
  try {
    const { token, platform, deviceInfo } = req.body;

    if (!token) {
      throw new ValidationError('Device token is required');
    }

    if (!platform || !['ios', 'android'].includes(platform)) {
      throw new ValidationError('Platform must be ios or android');
    }

    // If user is authenticated, link token to user
    const userId = req.user?._id?.toString();

    // Upsert device token
    await DeviceToken.findOneAndUpdate(
      { token },
      {
        token,
        platform,
        userId: userId || null,
        deviceInfo: deviceInfo || {},
        lastActiveAt: new Date(),
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // If user is authenticated, also update their fcmToken field
    if (userId) {
      await pushNotificationService.updateFCMToken(userId, token);
    }

    logger.info('Device registered for notifications', {
      platform,
      userId: userId || 'anonymous',
    });

    res.json({
      success: true,
      message: 'Device registered successfully',
    });
  } catch (error: any) {
    logger.error('Failed to register device', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'REGISTER_DEVICE_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
});

// ============================================================================
// FCM TOKEN MANAGEMENT
// ============================================================================

/**
 * @route   POST /api/v1/notifications/fcm-token
 * @desc    Update user's FCM token
 * @access  Private
 * @body    fcmToken
 */
router.post('/fcm-token', authenticate, async (req, res) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { fcmToken } = req.body;

    if (!fcmToken) {
      throw new ValidationError('FCM token is required');
    }

    await pushNotificationService.updateFCMToken(req.user._id.toString(), fcmToken);

    res.json({
      success: true,
      message: 'FCM token updated successfully',
    });
  } catch (error: any) {
    logger.error('Failed to update FCM token', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'UPDATE_FCM_TOKEN_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
});

/**
 * @route   DELETE /api/v1/notifications/fcm-token
 * @desc    Remove user's FCM token
 * @access  Private
 */
router.delete('/fcm-token', authenticate, async (req, res) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    await pushNotificationService.removeFCMToken(req.user._id.toString());

    res.json({
      success: true,
      message: 'FCM token removed successfully',
    });
  } catch (error: any) {
    logger.error('Failed to remove FCM token', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'REMOVE_FCM_TOKEN_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
});

// ============================================================================
// NOTIFICATION PREFERENCES
// ============================================================================

/**
 * @route   GET /api/v1/notifications/preferences
 * @desc    Get user's notification preferences
 * @access  Private
 */
router.get('/preferences', authenticate, async (req, res) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    let preferences = await NotificationPreferences.findOne({ userId: req.user._id });
    
    // Create default preferences if not exists
    if (!preferences) {
      preferences = await NotificationPreferences.create({
        userId: req.user._id,
        promotions: true,
        orders: true,
        newRestaurants: true,
        dailyDeals: true,
        events: true,
        sponsorMessages: true,
      });
    }

    res.json({
      success: true,
      data: {
        promotions: preferences.promotions,
        orders: preferences.orders,
        newRestaurants: preferences.newRestaurants,
        dailyDeals: preferences.dailyDeals,
        events: preferences.events,
        sponsorMessages: preferences.sponsorMessages,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get notification preferences', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_PREFERENCES_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
});

/**
 * @route   PUT /api/v1/notifications/preferences
 * @desc    Update user's notification preferences
 * @access  Private
 * @body    promotions, orders, newRestaurants, dailyDeals, events, sponsorMessages
 */
router.put('/preferences', authenticate, async (req, res) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { promotions, orders, newRestaurants, dailyDeals, events, sponsorMessages } = req.body;

    const updateData: any = {};
    if (typeof promotions === 'boolean') updateData.promotions = promotions;
    if (typeof orders === 'boolean') updateData.orders = orders;
    if (typeof newRestaurants === 'boolean') updateData.newRestaurants = newRestaurants;
    if (typeof dailyDeals === 'boolean') updateData.dailyDeals = dailyDeals;
    if (typeof events === 'boolean') updateData.events = events;
    if (typeof sponsorMessages === 'boolean') updateData.sponsorMessages = sponsorMessages;

    const preferences = await NotificationPreferences.findOneAndUpdate(
      { userId: req.user._id },
      { $set: updateData },
      { upsert: true, new: true }
    );

    logger.info('Notification preferences updated', { userId: req.user._id.toString() });

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: {
        promotions: preferences.promotions,
        orders: preferences.orders,
        newRestaurants: preferences.newRestaurants,
        dailyDeals: preferences.dailyDeals,
        events: preferences.events,
        sponsorMessages: preferences.sponsorMessages,
      },
    });
  } catch (error: any) {
    logger.error('Failed to update notification preferences', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'UPDATE_PREFERENCES_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
});

// ============================================================================
// NOTIFICATION HISTORY
// ============================================================================

/**
 * @route   GET /api/v1/notifications/history
 * @desc    Get user's notification history
 * @access  Private
 * @query   page, limit
 */
router.get('/history', authenticate, async (req, res) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      Notification.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments({ userId: req.user._id }),
    ]);

    res.json({
      success: true,
      data: notifications.map((n) => ({
        id: n._id,
        title: n.title,
        body: n.body,
        type: n.type,
        imageUrl: n.imageUrl,
        targetId: n.targetId,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error('Failed to get notification history', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_HISTORY_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
});

/**
 * @route   GET /api/v1/notifications/unread-count
 * @desc    Get user's unread notification count
 * @access  Private
 */
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const count = await Notification.countDocuments({
      userId: req.user._id,
      isRead: false,
    });

    res.json({
      success: true,
      count,
    });
  } catch (error: any) {
    logger.error('Failed to get unread count', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_UNREAD_COUNT_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
});

/**
 * @route   PUT /api/v1/notifications/:id/read
 * @desc    Mark a notification as read
 * @access  Private
 */
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      throw new ValidationError('Notification not found');
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error: any) {
    logger.error('Failed to mark notification as read', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'MARK_READ_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
});

/**
 * @route   PUT /api/v1/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put('/read-all', authenticate, async (req, res) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const result = await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    logger.info('All notifications marked as read', {
      userId: req.user._id.toString(),
      count: result.modifiedCount,
    });

    res.json({
      success: true,
      message: 'All notifications marked as read',
      count: result.modifiedCount,
    });
  } catch (error: any) {
    logger.error('Failed to mark all notifications as read', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'MARK_ALL_READ_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
});

// ============================================================================
// ADMIN: SEND NOTIFICATIONS (Protected)
// ============================================================================

/**
 * @route   POST /api/v1/notifications/send
 * @desc    Send push notification to user(s) - Admin only
 * @access  Private (Admin)
 * @body    userId or userIds or topic, title, body, type, data, imageUrl, deepLink
 */
router.post('/send', authenticate, async (req, res) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    // TODO: Add admin role check
    // if (req.user.role !== 'admin') {
    //   throw new ValidationError('Admin access required');
    // }

    const { userId, userIds, topic, title, body, type, data, imageUrl, deepLink } = req.body;

    if (!title || !body) {
      throw new ValidationError('Title and body are required');
    }

    let result: any;

    if (topic) {
      // Send to topic
      result = await pushNotificationService.sendTopicNotification({
        topic,
        title,
        body,
        data,
        imageUrl,
        deepLink,
      });
    } else if (userIds && Array.isArray(userIds)) {
      // Send to multiple users
      result = await pushNotificationService.sendBulkNotifications({
        userIds,
        title,
        body,
        data,
        deepLink,
      });

      // Store notifications in history
      const notifications = userIds.map((uid: string) => ({
        userId: uid,
        title,
        body,
        type: type || 'general',
        imageUrl,
        data,
      }));
      await Notification.insertMany(notifications);
    } else if (userId) {
      // Send to single user
      result = await pushNotificationService.sendNotification({
        userId,
        title,
        body,
        data,
        imageUrl,
        deepLink,
      });

      // Store notification in history
      await Notification.create({
        userId,
        title,
        body,
        type: type || 'general',
        imageUrl,
        data,
      });
    } else {
      throw new ValidationError('userId, userIds, or topic is required');
    }

    logger.info('Notification sent', {
      target: topic || userId || `${userIds?.length} users`,
      title,
    });

    res.json({
      success: true,
      message: 'Notification sent successfully',
      result,
    });
  } catch (error: any) {
    logger.error('Failed to send notification', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'SEND_NOTIFICATION_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
});

/**
 * @route   POST /api/v1/notifications/send-heineken
 * @desc    Send Heineken promotional notification - Admin only
 * @access  Private (Admin)
 * @body    topic or userId, promoTitle, promoDescription, discount, deepLink
 */
router.post('/send-heineken', authenticate, async (req, res) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { topic, userId, promoTitle, promoDescription, discount, deepLink } = req.body;

    if (!promoTitle || !promoDescription) {
      throw new ValidationError('promoTitle and promoDescription are required');
    }

    const result = await pushNotificationService.sendHeinekenPromoNotification({
      topic,
      userId,
      promoTitle,
      promoDescription,
      discount,
      deepLink,
    });

    logger.info('Heineken promo notification sent', {
      target: topic || userId,
      promoTitle,
    });

    res.json({
      success: true,
      message: 'Heineken notification sent successfully',
      result,
    });
  } catch (error: any) {
    logger.error('Failed to send Heineken notification', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'SEND_HEINEKEN_NOTIFICATION_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
});

export default router;


