import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth.middleware';

const router: Router = Router();

// Device Registration from Flutter App
router.post('/device/register', authenticate, notificationController.registerDeviceToken);

// Admin Broadcast Dispatcher (Should be wrapped in restrictTo('appzap_admin') in prod, using authenticate for Phase 1 compilation compatibility)
router.post('/admin/broadcast/dispatch', authenticate, notificationController.dispatchBroadcast);

export default router;
