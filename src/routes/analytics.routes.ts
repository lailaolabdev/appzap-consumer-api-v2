import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

/**
 * Restaurant analytics routes
 */

// Get restaurant dashboard
router.get('/restaurants/:restaurantId', authenticate, AnalyticsController.getRestaurantDashboard);

/**
 * Individual item analytics
 */

// Get promotion analytics
router.get('/promotions/:id', authenticate, AnalyticsController.getPromotionReport);

// Get coupon analytics
router.get('/coupons/:id', authenticate, AnalyticsController.getCouponReport);

/**
 * Admin routes
 */

// Get admin dashboard (all restaurants)
router.get('/admin/dashboard', authenticate, AnalyticsController.getAdminDashboard);

export default router;
