import Subscription, { ISubscription } from '../models/Subscription';
import MarketOrder from '../models/MarketOrder';
import DeliveryAddress from '../models/DeliveryAddress';
import User from '../models/User';
import * as supplierApi from './supplierApi.service';
import { addSubscriptionOrderJob, addSupplierSyncJob } from '../config/queue';
import { codeGenerators } from '../utils/helpers';
import logger from '../utils/logger';
import { BusinessLogicError, ValidationError } from '../utils/errors';

/**
 * Subscription Service
 * Handles subscription management and automatic order generation
 */

// ============================================================================
// ORDER GENERATION
// ============================================================================

/**
 * Generate order from subscription
 * This is the core function called by the Bull queue worker
 */
export const generateOrderFromSubscription = async (
  subscriptionId: string
): Promise<{ orderId: string; orderCode: string }> => {
  try {
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      throw new BusinessLogicError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND');
    }

    // Check if subscription is active
    if (subscription.status !== 'active') {
      logger.warn('Skipping order generation for inactive subscription', {
        subscriptionId: subscription._id.toString(),
        status: subscription.status,
      });
      throw new BusinessLogicError(
        'Subscription is not active',
        'SUBSCRIPTION_NOT_ACTIVE'
      );
    }

    // Get delivery address
    const deliveryAddress = await DeliveryAddress.findById(subscription.deliveryAddressId);
    if (!deliveryAddress) {
      throw new BusinessLogicError(
        'Delivery address not found',
        'DELIVERY_ADDRESS_NOT_FOUND'
      );
    }

    // Get user
    const user = await User.findById(subscription.userId);
    if (!user) {
      throw new BusinessLogicError('User not found', 'USER_NOT_FOUND');
    }

    // Calculate pricing
    const subtotal = subscription.items.reduce((sum, item) => sum + item.itemTotal, 0);
    const deliveryFee = subscription.deliveryFee;
    const total = subtotal + deliveryFee;

    // Create market order
    const order = await MarketOrder.create({
      orderCode: codeGenerators.marketOrderCode(),
      userId: subscription.userId,
      profileType: subscription.profileType,
      merchantProfileId: subscription.merchantProfileId,
      orderType: 'subscription',
      subscriptionId: subscription._id,
      items: subscription.items.map((item) => ({
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        priceType: item.priceType,
        unitPrice: item.unitPrice,
        itemTotal: item.itemTotal,
      })),
      subtotal,
      discount: 0,
      deliveryFee,
      total,
      deliveryInfo: {
        address: {
          recipientName: deliveryAddress.recipientName,
          phone: deliveryAddress.phone,
          addressLine1: deliveryAddress.addressLine1,
          addressLine2: deliveryAddress.addressLine2,
          district: deliveryAddress.district,
          city: deliveryAddress.city,
          province: deliveryAddress.province,
          postalCode: deliveryAddress.postalCode,
          latitude: deliveryAddress.latitude,
          longitude: deliveryAddress.longitude,
          notes: deliveryAddress.notes,
        },
        deliveryDate: subscription.deliverySchedule.nextDeliveryDate,
        deliveryTimeSlot: subscription.deliverySchedule.timeSlot,
        deliveryMethod: 'scheduled',
        deliveryFee,
      },
      paymentMethod: subscription.paymentMethod,
      paymentStatus: subscription.autoPayment ? 'pending' : 'pending',
      status: 'pending',
      supplierSyncStatus: 'pending',
      source: 'app',
    });

    // Update subscription
    subscription.ordersGenerated += 1;
    subscription.lastOrderGeneratedAt = new Date();
    subscription.deliverySchedule.nextDeliveryDate = subscription.calculateNextDeliveryDate();
    subscription.nextOrderScheduledAt = subscription.deliverySchedule.nextDeliveryDate;
    await subscription.save();

    // Schedule next order generation
    await scheduleNextOrder(subscription._id.toString(), subscription.deliverySchedule.nextDeliveryDate);

    // Sync to supplier (async)
    await addSupplierSyncJob(order._id.toString(), {
      consumerUserId: user._id.toString(),
      consumerOrderId: order._id.toString(),
      supplierId: user.supplierId,
      priceType: subscription.profileType === 'merchant' ? 'wholesale' : 'retail',
      items: order.items,
      deliveryAddress: order.deliveryInfo.address,
      deliveryMethod: 'scheduled',
      deliveryDate: subscription.deliverySchedule.nextDeliveryDate,
      paymentMethod: subscription.paymentMethod,
      isSubscription: true,
      subscriptionId: subscription._id.toString(),
    });

    logger.info('Order generated from subscription', {
      subscriptionId: subscription._id.toString(),
      orderId: order._id.toString(),
      orderCode: order.orderCode,
      nextDeliveryDate: subscription.deliverySchedule.nextDeliveryDate,
    });

    return {
      orderId: order._id.toString(),
      orderCode: order.orderCode,
    };
  } catch (error) {
    logger.error('Failed to generate order from subscription', {
      subscriptionId,
      error,
    });
    throw error;
  }
};

/**
 * Schedule next order generation for a subscription
 */
export const scheduleNextOrder = async (
  subscriptionId: string,
  nextDeliveryDate: Date
): Promise<void> => {
  try {
    await addSubscriptionOrderJob(subscriptionId, nextDeliveryDate);
    logger.info('Next order scheduled', {
      subscriptionId,
      nextDeliveryDate,
    });
  } catch (error) {
    logger.error('Failed to schedule next order', {
      subscriptionId,
      nextDeliveryDate,
      error,
    });
    throw error;
  }
};

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

/**
 * Create new subscription
 */
export const createSubscription = async (params: {
  userId: string;
  items: Array<{
    productId: string;
    sku: string;
    name: string;
    quantity: number;
    unit: string;
    priceType: 'retail' | 'wholesale';
    unitPrice: number;
  }>;
  deliveryAddressId: string;
  deliverySchedule: {
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    timeSlot?: string;
  };
  paymentMethod: 'phapay' | 'cash' | 'credit_term';
  autoPayment: boolean;
  startDate?: Date;
}): Promise<ISubscription> => {
  try {
    // Get user
    const user = await User.findById(params.userId);
    if (!user) {
      throw new BusinessLogicError('User not found', 'USER_NOT_FOUND');
    }

    // Get delivery address
    const deliveryAddress = await DeliveryAddress.findById(params.deliveryAddressId);
    if (!deliveryAddress) {
      throw new BusinessLogicError(
        'Delivery address not found',
        'DELIVERY_ADDRESS_NOT_FOUND'
      );
    }

    // Calculate totals
    const items = params.items.map((item) => ({
      ...item,
      itemTotal: item.unitPrice * item.quantity,
    }));

    const subtotal = items.reduce((sum, item) => sum + item.itemTotal, 0);

    // Calculate delivery fee
    const deliveryFeeResult = await supplierApi.calculateDeliveryFee({
      province: deliveryAddress.province,
      city: deliveryAddress.city,
      district: deliveryAddress.district,
      deliveryMethod: 'scheduled',
      orderTotal: subtotal,
    });

    const deliveryFee = deliveryFeeResult.deliveryFee || 0;

    // Determine first delivery date
    const startDate = params.startDate || new Date();
    let firstDeliveryDate = new Date(startDate);

    // Adjust based on frequency
    if (params.deliverySchedule.frequency === 'weekly' && params.deliverySchedule.dayOfWeek !== undefined) {
      const currentDay = firstDeliveryDate.getDay();
      const daysUntilTarget = (params.deliverySchedule.dayOfWeek - currentDay + 7) % 7;
      firstDeliveryDate.setDate(firstDeliveryDate.getDate() + daysUntilTarget);
    } else if (params.deliverySchedule.frequency === 'monthly' && params.deliverySchedule.dayOfMonth !== undefined) {
      firstDeliveryDate.setDate(params.deliverySchedule.dayOfMonth);
      if (firstDeliveryDate < startDate) {
        firstDeliveryDate.setMonth(firstDeliveryDate.getMonth() + 1);
      }
    }

    // Create subscription
    const subscription = await Subscription.create({
      subscriptionCode: codeGenerators.subscriptionCode(),
      userId: params.userId,
      profileType: user.activeProfile,
      merchantProfileId: user.activeProfile === 'merchant' ? user.merchantProfiles[0]?.merchantId : undefined,
      items,
      subtotal,
      deliveryFee,
      estimatedTotal: subtotal + deliveryFee,
      deliveryAddressId: params.deliveryAddressId,
      deliverySchedule: {
        ...params.deliverySchedule,
        nextDeliveryDate: firstDeliveryDate,
      },
      paymentMethod: params.paymentMethod,
      autoPayment: params.autoPayment,
      status: 'active',
      ordersGenerated: 0,
      nextOrderScheduledAt: firstDeliveryDate,
      startDate: params.startDate || new Date(),
    });

    // Schedule first order
    await scheduleNextOrder(subscription._id.toString(), firstDeliveryDate);

    // Sync to supplier
    try {
      await supplierApi.createSupplierSubscription({
        consumerUserId: user._id.toString(),
        consumerSubscriptionId: subscription._id.toString(),
        supplierId: user.supplierId,
        priceType: subscription.profileType === 'merchant' ? 'wholesale' : 'retail',
        items,
        frequency: params.deliverySchedule.frequency,
        deliveryAddress: deliveryAddress,
        startDate: subscription.startDate,
      });
    } catch (error) {
      logger.error('Failed to sync subscription to supplier', {
        subscriptionId: subscription._id.toString(),
        error,
      });
      // Continue even if supplier sync fails
    }

    logger.info('Subscription created', {
      subscriptionId: subscription._id.toString(),
      userId: params.userId,
      firstDeliveryDate,
    });

    return subscription;
  } catch (error) {
    logger.error('Failed to create subscription', { params, error });
    throw error;
  }
};

/**
 * Pause subscription
 */
export const pauseSubscription = async (subscriptionId: string): Promise<ISubscription> => {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) {
    throw new BusinessLogicError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND');
  }

  await subscription.pause();

  logger.info('Subscription paused', { subscriptionId });

  return subscription;
};

/**
 * Resume subscription
 */
export const resumeSubscription = async (subscriptionId: string): Promise<ISubscription> => {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) {
    throw new BusinessLogicError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND');
  }

  await subscription.resume();

  // Schedule next order
  await scheduleNextOrder(subscription._id.toString(), subscription.deliverySchedule.nextDeliveryDate);

  logger.info('Subscription resumed', { subscriptionId });

  return subscription;
};

/**
 * Cancel subscription
 */
export const cancelSubscription = async (
  subscriptionId: string,
  reason?: string
): Promise<ISubscription> => {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) {
    throw new BusinessLogicError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND');
  }

  await subscription.cancel(reason);

  logger.info('Subscription cancelled', { subscriptionId, reason });

  return subscription;
};

// ============================================================================
// EXPORT
// ============================================================================

export default {
  generateOrderFromSubscription,
  scheduleNextOrder,
  createSubscription,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
};

