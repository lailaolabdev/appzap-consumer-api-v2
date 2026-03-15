import { Router, Request, Response, NextFunction } from 'express';
import * as notificationController from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth.middleware';
import config from '../config/env';

const router: Router = Router();

// In development, admin broadcast endpoints skip JWT auth and inject a mock admin user.
// This allows the Dashboard (which authenticates via POS API) to call Consumer API directly.
const devAdminBypass = (req: Request, _res: Response, next: NextFunction) => {
  if (config.nodeEnv !== 'production') {
    (req as any).user = { _id: 'dev-admin', roles: ['admin'] };
    return next();
  }
  return authenticate(req, _res, next);
};

// Device Registration
router.post('/device/register', authenticate, notificationController.registerDeviceToken);

// User notification endpoints
router.get('/history', authenticate, notificationController.getNotificationHistory);
router.get('/unread-count', authenticate, notificationController.getUnreadCount);
router.put('/:notificationId/read', authenticate, notificationController.markAsRead);
router.put('/read-all', authenticate, notificationController.markAllAsRead);
router.get('/preferences', authenticate, notificationController.getPreferences);
router.put('/preferences', authenticate, notificationController.updatePreferences);

// Admin broadcast endpoints — use devAdminBypass for local testing
router.post('/admin/broadcast/dispatch', devAdminBypass, notificationController.dispatchBroadcast);
router.get('/admin/broadcasts', devAdminBypass, notificationController.getBroadcasts);
router.get('/admin/broadcasts/:id', devAdminBypass, notificationController.getBroadcastById);

export default router;
