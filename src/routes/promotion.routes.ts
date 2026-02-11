import { Router } from 'express';
import { PromotionController } from '../controllers/promotion.controller';
import { optionalAuthenticate, authenticate } from '../middleware/auth.middleware';

const router = Router();

/**
 * Public routes (authentication optional - improves tracking)
 */

// Get all active promotions
router.get('/', optionalAuthenticate, PromotionController.getPromotions);

// Get flash sales
router.get('/flash-sales', optionalAuthenticate, PromotionController.getFlashSales);

// Get promotion details
router.get('/:id', optionalAuthenticate, PromotionController.getPromotion);

// Record click (for analytics)
router.post('/:id/click', optionalAuthenticate, PromotionController.recordClick);

/**
 * Protected routes (authentication required)
 */

// Redeem a promotion
router.post('/:id/redeem', authenticate, PromotionController.redeemPromotion);

// Check eligibility
router.get('/:id/eligibility', authenticate, PromotionController.checkEligibility);

/**
 * Restaurant admin routes
 */

// Create promotion
router.post('/', authenticate, PromotionController.createPromotion);

// Update promotion
router.put('/:id', authenticate, PromotionController.updatePromotion);

// Deactivate promotion
router.delete('/:id', authenticate, PromotionController.deactivatePromotion);

export default router;
