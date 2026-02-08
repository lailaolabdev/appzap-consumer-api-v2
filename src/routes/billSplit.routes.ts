/**
 * Bill Split Routes
 * 
 * Group Bill Splitting feature - split bills with friends
 */

import { Router } from 'express';
import * as billSplitController from '../controllers/billSplit.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';

const router = Router();

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

/**
 * @route   GET /api/v1/bill-split/code/:code
 * @desc    Get session preview by code (for join page)
 * @access  Public
 */
router.get('/code/:code', billSplitController.getSessionByCode);

// ============================================================================
// AUTHENTICATED ROUTES
// ============================================================================

/**
 * @route   POST /api/v1/bill-split
 * @desc    Create a new split session
 * @access  Private
 * @body    orderId, splitMethod?, maxParticipants?
 */
router.post('/', authenticate, billSplitController.createSession);

/**
 * @route   POST /api/v1/bill-split/join
 * @desc    Join a split session
 * @access  Private
 * @body    sessionCode
 */
router.post('/join', authenticate, billSplitController.joinSession);

/**
 * @route   GET /api/v1/bill-split/active
 * @desc    Get user's active split sessions
 * @access  Private
 */
router.get('/active', authenticate, billSplitController.getActiveSessions);

/**
 * @route   GET /api/v1/bill-split/history
 * @desc    Get user's split session history
 * @access  Private
 * @query   limit?, skip?
 */
router.get('/history', authenticate, billSplitController.getSessionHistory);

/**
 * @route   GET /api/v1/bill-split/:sessionId
 * @desc    Get split session details
 * @access  Private (participants only)
 */
router.get('/:sessionId', authenticate, billSplitController.getSession);

/**
 * @route   PUT /api/v1/bill-split/:sessionId
 * @desc    Update split session (host only)
 * @access  Private
 * @body    splitMethod?, maxParticipants?
 */
router.put('/:sessionId', authenticate, billSplitController.updateSession);

/**
 * @route   POST /api/v1/bill-split/:sessionId/leave
 * @desc    Leave a split session
 * @access  Private
 */
router.post('/:sessionId/leave', authenticate, billSplitController.leaveSession);

/**
 * @route   POST /api/v1/bill-split/:sessionId/assign-items
 * @desc    Assign items to participants (by_item method)
 * @access  Private
 * @body    assignments: [{ itemId, userIds[] }]
 */
router.post('/:sessionId/assign-items', authenticate, billSplitController.assignItems);

/**
 * @route   POST /api/v1/bill-split/:sessionId/set-shares
 * @desc    Set custom shares (host only, percentage/custom methods)
 * @access  Private
 * @body    shares: [{ userId, percentage?, amount? }]
 */
router.post('/:sessionId/set-shares', authenticate, billSplitController.setShares);

/**
 * @route   POST /api/v1/bill-split/:sessionId/calculate
 * @desc    Calculate final shares (host only)
 * @access  Private
 */
router.post('/:sessionId/calculate', authenticate, billSplitController.calculateShares);

/**
 * @route   POST /api/v1/bill-split/:sessionId/confirm
 * @desc    Confirm my share amount
 * @access  Private
 */
router.post('/:sessionId/confirm', authenticate, billSplitController.confirmShare);

/**
 * @route   POST /api/v1/bill-split/:sessionId/pay
 * @desc    Record payment for my share
 * @access  Private
 * @body    paymentId, amount, paymentMethod?
 */
router.post('/:sessionId/pay', authenticate, billSplitController.recordPayment);

/**
 * @route   DELETE /api/v1/bill-split/:sessionId
 * @desc    Cancel split session (host only)
 * @access  Private
 * @body    reason?
 */
router.delete('/:sessionId', authenticate, billSplitController.cancelSession);

export default router;
