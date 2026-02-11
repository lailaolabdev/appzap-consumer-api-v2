import { Router } from 'express';
import { CouponController } from '../controllers/coupon.controller';
import { optionalAuthenticate, authenticate } from '../middleware/auth.middleware';

const router = Router();

/**
 * Public routes (authentication optional - improves tracking)
 */

// Get available coupons
router.get('/', optionalAuthenticate, CouponController.getCoupons);

// Get featured coupons (for home page)
router.get('/featured', optionalAuthenticate, CouponController.getFeaturedCoupons);

// Get coupon details
router.get('/:id', optionalAuthenticate, CouponController.getCoupon);

/**
 * POS Integration routes (API key auth)
 */

// Validate coupon code (for POS verification)
router.get('/validate/:code', CouponController.validateCode);

// Redeem coupon at POS
router.post('/redeem', CouponController.redeemCoupon);

/**
 * Protected routes (authentication required)
 */

// Purchase a coupon
router.post('/:id/purchase', authenticate, CouponController.purchaseCoupon);

// Get user's purchased coupons
router.get('/users/me', authenticate, CouponController.getMyCoupons);

/**
 * Restaurant admin routes
 */

// Create coupon
router.post('/', authenticate, CouponController.createCoupon);

// Update coupon
router.put('/:id', authenticate, CouponController.updateCoupon);

export default router;
