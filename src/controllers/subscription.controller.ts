import { Request, Response } from 'express';
import Subscription from '../models/Subscription';
import * as subscriptionService from '../services/subscription.service';
import logger from '../utils/logger';
import { ValidationError, NotFoundError } from '../utils/errors';

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

/**
 * Create Subscription
 * POST /api/v1/market/subscriptions
 */
export const createSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const {
      items,
      deliveryAddressId,
      deliverySchedule,
      paymentMethod,
      autoPayment,
      startDate,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ValidationError('Items array is required');
    }

    if (!deliveryAddressId) {
      throw new ValidationError('Delivery address is required');
    }

    if (!deliverySchedule || !deliverySchedule.frequency) {
      throw new ValidationError('Delivery schedule is required');
    }

    if (!paymentMethod) {
      throw new ValidationError('Payment method is required');
    }

    // Create subscription
    const subscription = await subscriptionService.createSubscription({
      userId: req.user._id.toString(),
      items,
      deliveryAddressId,
      deliverySchedule,
      paymentMethod,
      autoPayment: autoPayment || false,
      startDate: startDate ? new Date(startDate) : undefined,
    });

    logger.info('Subscription created', {
      subscriptionId: subscription._id.toString(),
      userId: req.user._id.toString(),
      frequency: deliverySchedule.frequency,
    });

    res.json({
      subscriptionId: subscription._id,
      subscriptionCode: subscription.subscriptionCode,
      status: subscription.status,
      nextDelivery: subscription.deliverySchedule.nextDeliveryDate,
      estimatedTotal: subscription.estimatedTotal,
    });
  } catch (error: any) {
    logger.error('Failed to create subscription', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'CREATE_SUBSCRIPTION_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Get User Subscriptions
 * GET /api/v1/market/subscriptions
 */
export const getUserSubscriptions = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { status, limit = 20, skip = 0 } = req.query;

    const query: any = {
      userId: req.user._id,
    };

    if (status) {
      query.status = status;
    }

    const subscriptions = await Subscription.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .skip(parseInt(skip as string))
      .lean();

    const total = await Subscription.countDocuments(query);

    res.json({
      data: subscriptions,
      pagination: {
        limit: parseInt(limit as string),
        skip: parseInt(skip as string),
        total,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get user subscriptions', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_SUBSCRIPTIONS_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Get Subscription Details
 * GET /api/v1/market/subscriptions/:subscriptionId
 */
export const getSubscriptionById = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { subscriptionId } = req.params;

    const subscription = await Subscription.findById(subscriptionId);

    if (!subscription) {
      throw new NotFoundError('Subscription', subscriptionId);
    }

    if (subscription.userId.toString() !== req.user._id.toString()) {
      throw new ValidationError('Subscription does not belong to user');
    }

    res.json(subscription);
  } catch (error: any) {
    logger.error('Failed to get subscription details', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_SUBSCRIPTION_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Pause Subscription
 * POST /api/v1/market/subscriptions/:subscriptionId/pause
 */
export const pauseSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { subscriptionId } = req.params;

    const subscription = await Subscription.findById(subscriptionId);

    if (!subscription) {
      throw new NotFoundError('Subscription', subscriptionId);
    }

    if (subscription.userId.toString() !== req.user._id.toString()) {
      throw new ValidationError('Subscription does not belong to user');
    }

    await subscriptionService.pauseSubscription(subscriptionId);

    logger.info('Subscription paused', {
      subscriptionId,
      userId: req.user._id.toString(),
    });

    res.json({
      message: 'Subscription paused successfully',
      subscriptionId,
      status: 'paused',
    });
  } catch (error: any) {
    logger.error('Failed to pause subscription', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'PAUSE_SUBSCRIPTION_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Resume Subscription
 * POST /api/v1/market/subscriptions/:subscriptionId/resume
 */
export const resumeSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { subscriptionId } = req.params;

    const subscription = await Subscription.findById(subscriptionId);

    if (!subscription) {
      throw new NotFoundError('Subscription', subscriptionId);
    }

    if (subscription.userId.toString() !== req.user._id.toString()) {
      throw new ValidationError('Subscription does not belong to user');
    }

    const resumed = await subscriptionService.resumeSubscription(subscriptionId);

    logger.info('Subscription resumed', {
      subscriptionId,
      userId: req.user._id.toString(),
      nextDelivery: resumed.deliverySchedule.nextDeliveryDate,
    });

    res.json({
      message: 'Subscription resumed successfully',
      subscriptionId,
      status: 'active',
      nextDelivery: resumed.deliverySchedule.nextDeliveryDate,
    });
  } catch (error: any) {
    logger.error('Failed to resume subscription', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'RESUME_SUBSCRIPTION_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Cancel Subscription
 * POST /api/v1/market/subscriptions/:subscriptionId/cancel
 */
export const cancelSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { subscriptionId } = req.params;
    const { reason } = req.body;

    const subscription = await Subscription.findById(subscriptionId);

    if (!subscription) {
      throw new NotFoundError('Subscription', subscriptionId);
    }

    if (subscription.userId.toString() !== req.user._id.toString()) {
      throw new ValidationError('Subscription does not belong to user');
    }

    await subscriptionService.cancelSubscription(subscriptionId, reason);

    logger.info('Subscription cancelled', {
      subscriptionId,
      userId: req.user._id.toString(),
      reason,
    });

    res.json({
      message: 'Subscription cancelled successfully',
      subscriptionId,
      status: 'cancelled',
    });
  } catch (error: any) {
    logger.error('Failed to cancel subscription', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'CANCEL_SUBSCRIPTION_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Update Subscription Schedule
 * PUT /api/v1/market/subscriptions/:subscriptionId/schedule
 */
export const updateSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { subscriptionId } = req.params;
    const { frequency, dayOfWeek, dayOfMonth, timeSlot } = req.body;

    const subscription = await Subscription.findById(subscriptionId);

    if (!subscription) {
      throw new NotFoundError('Subscription', subscriptionId);
    }

    if (subscription.userId.toString() !== req.user._id.toString()) {
      throw new ValidationError('Subscription does not belong to user');
    }

    await subscription.updateSchedule({
      frequency,
      dayOfWeek,
      dayOfMonth,
      timeSlot,
    });

    logger.info('Subscription schedule updated', {
      subscriptionId,
      userId: req.user._id.toString(),
      newFrequency: frequency,
    });

    res.json({
      message: 'Schedule updated successfully',
      subscriptionId,
      deliverySchedule: subscription.deliverySchedule,
    });
  } catch (error: any) {
    logger.error('Failed to update subscription schedule', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'UPDATE_SCHEDULE_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

