import { Router } from 'express';
import * as deepLinkController from '../controllers/deepLink.controller';
import * as spinToWinController from '../controllers/spinToWin.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';

const router = Router();

// ============================================================================
// DEEP LINKS
// ============================================================================

/**
 * @route   POST /api/v1/deep-links
 * @desc    Create a deep link
 * @access  Private
 * @body    targetType, targetId, campaignId?, campaignName?, source?, medium?, metadata?, expiresInDays?
 */
router.post('/', authenticate, deepLinkController.createDeepLink);

/**
 * @route   POST /api/v1/deep-links/:shortCode/track-open
 * @desc    Track deep link open in app
 * @access  Public
 * @body    deviceInfo?
 */
router.post('/:shortCode/track-open', deepLinkController.trackDeepLinkOpen);

/**
 * @route   POST /api/v1/deep-links/:shortCode/track-conversion
 * @desc    Track deep link conversion
 * @access  Public
 * @body    value?
 */
router.post('/:shortCode/track-conversion', deepLinkController.trackDeepLinkConversion);

/**
 * @route   GET /api/v1/deep-links/analytics
 * @desc    Get deep link analytics
 * @access  Private
 * @query   campaignId?, startDate?, endDate?
 */
router.get('/analytics', authenticate, deepLinkController.getDeepLinkAnalytics);

// ============================================================================
// SPIN TO WIN
// ============================================================================

/**
 * @route   POST /api/v1/deep-links/spin-to-win/:rewardId/spin
 * @desc    Execute spin and win reward
 * @access  Private
 */
router.post('/spin-to-win/:rewardId/spin', authenticate, spinToWinController.executeSpin);

/**
 * @route   GET /api/v1/deep-links/spin-to-win/rewards
 * @desc    Get user's rewards
 * @access  Private
 * @query   includeExpired?
 */
router.get('/spin-to-win/rewards', authenticate, spinToWinController.getUserRewards);

/**
 * @route   POST /api/v1/deep-links/spin-to-win/:rewardId/redeem
 * @desc    Redeem a won reward
 * @access  Private
 * @body    orderId?
 */
router.post('/spin-to-win/:rewardId/redeem', authenticate, spinToWinController.redeemReward);

/**
 * @route   GET /api/v1/deep-links/spin-to-win/statistics
 * @desc    Get reward statistics
 * @access  Private
 * @query   startDate?, endDate?
 */
router.get('/spin-to-win/statistics', authenticate, spinToWinController.getStatistics);

export default router;

