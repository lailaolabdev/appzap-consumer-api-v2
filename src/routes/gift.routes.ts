/**
 * Gift Routes
 * 
 * Social Gifting feature - buy and send digital vouchers
 */

import { Router } from 'express';
import * as giftController from '../controllers/gift.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';

const router = Router();

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

/**
 * @route   GET /api/v1/gifts/templates
 * @desc    Get available gift templates
 * @access  Public
 */
router.get('/templates', giftController.getTemplates);

/**
 * @route   GET /api/v1/gifts/code/:code
 * @desc    Get gift details by code (for claim page)
 * @access  Public
 */
router.get('/code/:code', giftController.getGiftByCode);

// ============================================================================
// AUTHENTICATED ROUTES
// ============================================================================

/**
 * @route   POST /api/v1/gifts
 * @desc    Create/purchase a gift
 * @access  Private
 * @body    type, templateId?, amount?, recipientPhone?, recipientName?, message?, paymentMethod
 */
router.post('/', authenticate, giftController.createGift);

/**
 * @route   POST /api/v1/gifts/claim
 * @desc    Claim a received gift
 * @access  Private
 * @body    giftCode
 */
router.post('/claim', authenticate, giftController.claimGift);

/**
 * @route   POST /api/v1/gifts/redeem
 * @desc    Redeem gift at restaurant
 * @access  Private
 * @body    giftCode, restaurantId, orderId?, amount?
 */
router.post('/redeem', authenticate, giftController.redeemGift);

/**
 * @route   GET /api/v1/gifts/sent
 * @desc    Get gifts sent by user
 * @access  Private
 * @query   status?, limit?, skip?
 */
router.get('/sent', authenticate, giftController.getSentGifts);

/**
 * @route   GET /api/v1/gifts/received
 * @desc    Get gifts received by user
 * @access  Private
 * @query   status?, limit?, skip?
 */
router.get('/received', authenticate, giftController.getReceivedGifts);

/**
 * @route   GET /api/v1/gifts/:giftId
 * @desc    Get gift details by ID
 * @access  Private (owner only)
 */
router.get('/:giftId', authenticate, giftController.getGiftById);

/**
 * @route   POST /api/v1/gifts/:giftId/activate
 * @desc    Activate gift after payment
 * @access  Private
 * @body    paymentId, paymentMethod?
 */
router.post('/:giftId/activate', authenticate, giftController.activateGift);

/**
 * @route   POST /api/v1/gifts/:giftId/share
 * @desc    Share gift via channel
 * @access  Private (sender only)
 * @body    channel, recipientPhone?, recipientEmail?
 */
router.post('/:giftId/share', authenticate, giftController.shareGift);

/**
 * @route   DELETE /api/v1/gifts/:giftId
 * @desc    Cancel a gift (sender only, before claim)
 * @access  Private
 * @body    reason?
 */
router.delete('/:giftId', authenticate, giftController.cancelGift);

export default router;
