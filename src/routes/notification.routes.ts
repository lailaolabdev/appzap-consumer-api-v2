import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as pushNotificationService from '../services/pushNotification.service';
import logger from '../utils/logger';
import { ValidationError } from '../utils/errors';

const router = Router();

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

export default router;

