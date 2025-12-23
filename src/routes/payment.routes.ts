import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { paymentRateLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

/**
 * @route   POST /api/v1/payments/webhook/phapay
 * @desc    Phapay payment webhook
 * @access  Public (webhook)
 */
router.post('/webhook/phapay', paymentController.phapayWebhook);

/**
 * @route   POST /api/v1/payments/initialize
 * @desc    Initialize payment for existing order
 * @access  Private
 */
router.post('/initialize', authenticate, paymentRateLimiter, paymentController.initializePayment);

/**
 * @route   GET /api/v1/payments/:orderId/status
 * @desc    Get payment status
 * @access  Private
 */
router.get('/:orderId/status', authenticate, paymentController.getPaymentStatus);

export default router;

