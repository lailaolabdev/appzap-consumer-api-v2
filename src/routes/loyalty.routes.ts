/**
 * Loyalty Routes
 * 
 * Endpoints for Universal ZapPoints loyalty program
 */

import { Router } from 'express';
import * as loyaltyController from '../controllers/loyalty.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';

const router = Router();

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

/**
 * @route   GET /api/v1/loyalty/tiers
 * @desc    Get loyalty tier information
 * @access  Public (optionally authenticated for user tier info)
 */
router.get('/tiers', optionalAuthenticate, loyaltyController.getTiers);

/**
 * @route   GET /api/v1/loyalty/earn
 * @desc    Get earning opportunities
 * @access  Public
 */
router.get('/earn', loyaltyController.getEarningOpportunities);

// ============================================================================
// AUTHENTICATED ROUTES
// ============================================================================

/**
 * @route   GET /api/v1/loyalty/balance
 * @desc    Get user's loyalty balance and tier
 * @access  Private
 */
router.get('/balance', authenticate, loyaltyController.getBalance);

/**
 * @route   GET /api/v1/loyalty/history
 * @desc    Get loyalty transaction history
 * @access  Private
 * @query   type - Filter by type (earn, redeem, expire)
 * @query   limit - Number of records (default: 20)
 * @query   skip - Pagination offset
 * @query   startDate - Filter from date
 * @query   endDate - Filter to date
 */
router.get('/history', authenticate, loyaltyController.getHistory);

/**
 * @route   POST /api/v1/loyalty/preview-redemption
 * @desc    Preview points redemption (validate before redeeming)
 * @access  Private
 * @body    points - Number of points to redeem
 * @body    orderTotal - Total amount of the order
 */
router.post('/preview-redemption', authenticate, loyaltyController.previewRedemption);

/**
 * @route   POST /api/v1/loyalty/redeem
 * @desc    Redeem points for order discount
 * @access  Private
 * @body    points - Number of points to redeem
 * @body    orderId - Order to apply discount to
 * @body    orderTotal - Order total for validation
 */
router.post('/redeem', authenticate, loyaltyController.redeemPoints);

export default router;
