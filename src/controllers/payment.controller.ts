import { Request, Response } from 'express';
import Order from '../models/Order';
import * as phapayService from '../services/phapay.service';
import * as loyaltyService from '../services/loyalty.service';
import * as posV2Service from '../services/posV2Api.service';
import logger from '../utils/logger';
import { ValidationError } from '../utils/errors';

// ============================================================================
// PAYMENT WEBHOOK
// ============================================================================

/**
 * Phapay Webhook Handler
 * POST /api/v1/payments/webhook/phapay
 */
export const phapayWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const webhookPayload = req.body;

    logger.info('Phapay webhook received', {
      orderId: webhookPayload.orderId,
      status: webhookPayload.status,
    });

    // Verify webhook signature
    const verification = phapayService.processWebhook(webhookPayload);

    if (!verification.valid) {
      logger.error('Invalid webhook signature', { orderId: webhookPayload.orderId });
      res.status(400).json({
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'Invalid webhook signature',
        },
      });
      return;
    }

    // Get order
    const order = await Order.findById(verification.orderId);

    if (!order) {
      logger.error('Order not found for webhook', { orderId: verification.orderId });
      res.status(404).json({
        error: {
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found',
        },
      });
      return;
    }

    // Process payment status
    if (verification.status === 'success') {
      // Mark order as paid
      await order.markAsPaid(verification.transactionId || webhookPayload.sessionId);

      // Award loyalty points
      if (order.pointsEarned && order.pointsEarned > 0) {
        await loyaltyService.awardPoints(
          order.userId.toString(),
          order.pointsEarned,
          'order',
          order._id.toString(),
          `Order ${order.orderCode} - Earned ${order.pointsEarned} points`
        );
      }

      // Notify POS V2 that payment is complete
      if (order.posOrderId) {
        try {
          await posV2Service.updateOrderStatus(order.posOrderId, 'confirmed');
          logger.info('POS order status updated to confirmed', {
            posOrderId: order.posOrderId,
          });
        } catch (error) {
          logger.error('Failed to update POS order status', {
            posOrderId: order.posOrderId,
            error,
          });
        }
      }

      // TODO: Send push notification to user
      // TODO: Send notification to restaurant

      logger.info('Payment processed successfully', {
        orderId: order._id.toString(),
        orderCode: order.orderCode,
        pointsEarned: order.pointsEarned,
      });
    } else if (verification.status === 'failed') {
      order.paymentStatus = 'failed';
      order.status = 'cancelled';
      await order.save();

      logger.warn('Payment failed', {
        orderId: order._id.toString(),
        orderCode: order.orderCode,
      });
    } else if (verification.status === 'cancelled') {
      order.paymentStatus = 'failed';
      order.status = 'cancelled';
      order.cancelledAt = new Date();
      await order.save();

      logger.info('Payment cancelled by user', {
        orderId: order._id.toString(),
        orderCode: order.orderCode,
      });
    }

    // Always return 200 to acknowledge webhook
    res.status(200).json({
      message: 'Webhook processed successfully',
      orderId: order._id,
      status: order.paymentStatus,
    });
  } catch (error: any) {
    logger.error('Webhook processing error', {
      error: error.message,
      stack: error.stack,
    });

    // Still return 200 to avoid webhook retries
    res.status(200).json({
      message: 'Webhook received but processing failed',
      error: error.message,
    });
  }
};

// ============================================================================
// PAYMENT INITIALIZATION
// ============================================================================

/**
 * Initialize Payment (if needed separately)
 * POST /api/v1/payments/initialize
 */
export const initializePayment = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { orderId } = req.body;

    if (!orderId) {
      throw new ValidationError('orderId is required');
    }

    const order = await Order.findById(orderId);

    if (!order) {
      res.status(404).json({
        error: {
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found',
        },
      });
      return;
    }

    if (order.userId.toString() !== req.user._id.toString()) {
      throw new ValidationError('Order does not belong to user');
    }

    if (order.paymentStatus === 'paid') {
      res.status(400).json({
        error: {
          code: 'ALREADY_PAID',
          message: 'Order is already paid',
        },
      });
      return;
    }

    // Create payment session
    const paymentSession = await phapayService.createPaymentSession({
      orderId: order._id.toString(),
      amount: order.total,
      returnUrl: `${req.protocol}://${req.get('host')}/payment/callback`,
      webhookUrl: `${req.protocol}://${req.get('host')}/api/v1/payments/webhook/phapay`,
      customerInfo: {
        name: req.user.fullName,
        phone: req.user.phone,
      },
      metadata: {
        orderCode: order.orderCode,
        restaurantId: order.restaurantId,
      },
    });

    order.paymentId = paymentSession.sessionId;
    await order.save();

    res.json({
      paymentId: paymentSession.sessionId,
      paymentUrl: paymentSession.paymentUrl,
      qrCode: paymentSession.qrCode,
      expiresAt: paymentSession.expiresAt,
    });
  } catch (error: any) {
    logger.error('Failed to initialize payment', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'PAYMENT_INIT_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

// ============================================================================
// PAYMENT STATUS CHECK
// ============================================================================

/**
 * Check Payment Status
 * GET /api/v1/payments/:orderId/status
 */
export const getPaymentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { orderId } = req.params;

    const order = await Order.findById(orderId);

    if (!order) {
      res.status(404).json({
        error: {
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found',
        },
      });
      return;
    }

    if (order.userId.toString() !== req.user._id.toString()) {
      throw new ValidationError('Order does not belong to user');
    }

    res.json({
      orderId: order._id,
      orderCode: order.orderCode,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      paymentId: order.paymentId,
      paidAt: order.paidAt,
      total: order.total,
    });
  } catch (error: any) {
    logger.error('Failed to get payment status', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_PAYMENT_STATUS_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};


