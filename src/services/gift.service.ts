/**
 * Gift Service
 * 
 * Handles all gift/voucher operations:
 * - Purchase gifts
 * - Share via WhatsApp/Link
 * - Claim gifts
 * - Redeem at restaurants
 * - Track gift history
 */

import Gift, { 
  IGift, 
  GiftStatus, 
  GiftType, 
  ShareChannel,
  GIFT_TEMPLATES,
  IGiftTemplate,
} from '../models/Gift';
import User from '../models/User';
import { posRouter } from '../adapters/pos.router';
import * as loyaltyService from './loyalty.service';
import logger from '../utils/logger';
import { 
  ValidationError, 
  NotFoundError, 
  BusinessLogicError,
  InsufficientPointsError,
} from '../utils/errors';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_VALID_DAYS = 90;
const MAX_GIFTS_PER_DAY = 10;  // Limit gifts per user per day

// ============================================================================
// TYPES
// ============================================================================

export interface CreateGiftInput {
  type: GiftType;
  templateId?: string;
  amount?: number;          // For custom_amount type
  recipientPhone?: string;
  recipientEmail?: string;
  recipientName?: string;
  message?: string;
  restaurantIds?: string[]; // Restrict to specific restaurants
  paymentMethod: 'phapay' | 'loyalty_points';
}

export interface ShareGiftInput {
  giftId: string;
  channel: ShareChannel;
  recipientPhone?: string;
  recipientEmail?: string;
}

export interface RedeemGiftInput {
  giftCode: string;
  restaurantId: string;
  orderId?: string;
  amount?: number;          // For partial redemption
}

// ============================================================================
// GET TEMPLATES
// ============================================================================

/**
 * Get available gift templates
 */
export const getGiftTemplates = async (): Promise<IGiftTemplate[]> => {
  return GIFT_TEMPLATES.filter(t => t.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
};

/**
 * Get template by ID/type
 */
export const getTemplateById = (templateId: string): IGiftTemplate | undefined => {
  return GIFT_TEMPLATES.find(t => t.type === templateId || t.name === templateId);
};

// ============================================================================
// CREATE GIFT
// ============================================================================

/**
 * Create a new gift
 */
export const createGift = async (
  senderId: string,
  input: CreateGiftInput
): Promise<{ gift: IGift; paymentRequired: boolean; paymentAmount: number }> => {
  try {
    // Get sender
    const sender = await User.findById(senderId);
    if (!sender) {
      throw new NotFoundError('User', senderId);
    }

    // Check daily limit
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const giftsToday = await Gift.countDocuments({
      senderId,
      createdAt: { $gte: todayStart },
    });
    
    if (giftsToday >= MAX_GIFTS_PER_DAY) {
      throw new BusinessLogicError(
        `Daily gift limit reached (${MAX_GIFTS_PER_DAY})`,
        'DAILY_LIMIT_REACHED'
      );
    }

    // Get template or validate custom amount
    let giftAmount: number;
    let giftName: string;
    let giftDescription: string | undefined;
    let giftImage: string | undefined;
    let giftIcon: string | undefined;
    let validDays = DEFAULT_VALID_DAYS;

    if (input.type === 'custom_amount') {
      if (!input.amount || input.amount <= 0) {
        throw new ValidationError('Amount is required for custom gifts');
      }
      
      const customTemplate = GIFT_TEMPLATES.find(t => t.type === 'custom_amount');
      if (customTemplate) {
        if (input.amount < (customTemplate.minAmount || 0)) {
          throw new ValidationError(`Minimum amount is ${customTemplate.minAmount?.toLocaleString()} LAK`);
        }
        if (input.amount > (customTemplate.maxAmount || Infinity)) {
          throw new ValidationError(`Maximum amount is ${customTemplate.maxAmount?.toLocaleString()} LAK`);
        }
        giftImage = customTemplate.image;
        giftIcon = customTemplate.icon;
        validDays = customTemplate.validDays;
      }
      
      giftAmount = input.amount;
      giftName = 'Custom Gift';
      giftDescription = `${input.amount.toLocaleString()} LAK Gift`;
    } else {
      const template = input.templateId 
        ? getTemplateById(input.templateId)
        : GIFT_TEMPLATES.find(t => t.type === input.type);
      
      if (!template) {
        throw new ValidationError('Invalid gift template');
      }
      
      giftAmount = template.amount;
      giftName = template.name;
      giftDescription = template.description;
      giftImage = template.image;
      giftIcon = template.icon;
      validDays = template.validDays;
    }

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + validDays);

    // Create gift
    const gift = new Gift({
      type: input.type,
      templateId: input.templateId,
      name: giftName,
      description: giftDescription,
      image: giftImage,
      icon: giftIcon,
      originalAmount: giftAmount,
      remainingAmount: giftAmount,
      currency: 'LAK',
      senderId: sender._id,
      senderName: sender.fullName || 'AppZap User',
      senderPhone: sender.phone,
      recipientPhone: input.recipientPhone,
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
      message: input.message
        ? {
            text: input.message,
            senderName: sender.fullName || 'AppZap User',
            recipientName: input.recipientName,
          }
        : undefined,
      status: 'pending_payment',
      expiresAt,
      restaurantIds: input.restaurantIds,
    });

    await gift.save();

    // Handle payment
    let paymentRequired = true;
    
    if (input.paymentMethod === 'loyalty_points') {
      // Calculate points needed (using same rate as redemption)
      const pointsNeeded = Math.ceil(giftAmount / loyaltyService.POINTS_TO_LAK_RATE);
      
      if (sender.points.balance < pointsNeeded) {
        // Not enough points - payment required
        paymentRequired = true;
      } else {
        // Redeem points for gift
        try {
          await loyaltyService.redeemPoints(
            senderId,
            pointsNeeded,
            gift._id.toString(),
            giftAmount
          );
          
          // Mark as paid
          gift.status = 'active';
          gift.paymentMethod = 'loyalty_points';
          gift.paidAt = new Date();
          await gift.save();
          
          paymentRequired = false;
        } catch (error) {
          if (error instanceof InsufficientPointsError) {
            paymentRequired = true;
          } else {
            throw error;
          }
        }
      }
    }

    logger.info('Gift created', {
      giftId: gift._id,
      giftCode: gift.giftCode,
      senderId,
      type: input.type,
      amount: giftAmount,
      paymentRequired,
    });

    return {
      gift,
      paymentRequired,
      paymentAmount: paymentRequired ? giftAmount : 0,
    };
  } catch (error) {
    logger.error('Failed to create gift', { senderId, input, error });
    throw error;
  }
};

// ============================================================================
// ACTIVATE GIFT (After Payment)
// ============================================================================

/**
 * Activate gift after payment confirmation
 */
export const activateGift = async (
  giftId: string,
  paymentId: string,
  paymentMethod: string
): Promise<IGift> => {
  try {
    const gift = await Gift.findById(giftId);
    if (!gift) {
      throw new NotFoundError('Gift', giftId);
    }

    if (gift.status !== 'pending_payment') {
      throw new BusinessLogicError(
        `Cannot activate gift with status: ${gift.status}`,
        'INVALID_STATUS'
      );
    }

    gift.status = 'active';
    gift.paymentId = paymentId;
    gift.paymentMethod = paymentMethod;
    gift.paidAt = new Date();
    
    await gift.save();

    logger.info('Gift activated', {
      giftId: gift._id,
      giftCode: gift.giftCode,
      paymentId,
    });

    return gift;
  } catch (error) {
    logger.error('Failed to activate gift', { giftId, error });
    throw error;
  }
};

// ============================================================================
// SHARE GIFT
// ============================================================================

/**
 * Record gift share action
 */
export const shareGift = async (
  giftId: string,
  userId: string,
  input: ShareGiftInput
): Promise<{ gift: IGift; shareUrl: string; whatsappUrl?: string }> => {
  try {
    const gift = await Gift.findById(giftId);
    if (!gift) {
      throw new NotFoundError('Gift', giftId);
    }

    // Verify ownership
    if (gift.senderId.toString() !== userId) {
      throw new BusinessLogicError('Gift does not belong to user', 'UNAUTHORIZED');
    }

    // Gift must be active
    if (gift.status !== 'active') {
      throw new BusinessLogicError(
        `Cannot share gift with status: ${gift.status}`,
        'INVALID_STATUS'
      );
    }

    // Update recipient info if provided
    if (input.recipientPhone && !gift.recipientPhone) {
      gift.recipientPhone = input.recipientPhone;
    }
    if (input.recipientEmail && !gift.recipientEmail) {
      gift.recipientEmail = input.recipientEmail;
    }

    // Record share
    gift.shareHistory.push({
      channel: input.channel,
      sharedAt: new Date(),
      linkClicked: false,
    });
    gift.lastSharedAt = new Date();
    
    await gift.save();

    // Generate share URL
    const shareUrl = gift.getShareableLink();

    // Generate WhatsApp URL if applicable
    let whatsappUrl: string | undefined;
    if (input.channel === 'whatsapp' && (input.recipientPhone || gift.recipientPhone)) {
      const phone = (input.recipientPhone || gift.recipientPhone || '').replace(/\D/g, '');
      const message = encodeURIComponent(
        `🎁 ${gift.senderName} sent you a gift!\n\n` +
        `${gift.name}: ${gift.originalAmount.toLocaleString()} LAK\n\n` +
        (gift.message?.text ? `"${gift.message.text}"\n\n` : '') +
        `Claim your gift: ${shareUrl}`
      );
      whatsappUrl = `https://wa.me/${phone}?text=${message}`;
    }

    logger.info('Gift shared', {
      giftId: gift._id,
      channel: input.channel,
    });

    return { gift, shareUrl, whatsappUrl };
  } catch (error) {
    logger.error('Failed to share gift', { giftId, input, error });
    throw error;
  }
};

// ============================================================================
// CLAIM GIFT
// ============================================================================

/**
 * Claim a gift (recipient claims ownership)
 */
export const claimGift = async (
  giftCode: string,
  userId: string
): Promise<IGift> => {
  try {
    const gift = await Gift.findByCode(giftCode);
    if (!gift) {
      throw new NotFoundError('Gift', giftCode);
    }

    // Check expiration
    if (gift.expiresAt < new Date()) {
      gift.status = 'expired';
      await gift.save();
      throw new BusinessLogicError('Gift has expired', 'GIFT_EXPIRED');
    }

    // Must be active to claim
    if (gift.status !== 'active') {
      if (gift.status === 'claimed' || gift.status === 'partially_used') {
        throw new BusinessLogicError('Gift has already been claimed', 'ALREADY_CLAIMED');
      }
      throw new BusinessLogicError(
        `Cannot claim gift with status: ${gift.status}`,
        'INVALID_STATUS'
      );
    }

    // Cannot claim own gift
    if (gift.senderId.toString() === userId) {
      throw new BusinessLogicError('Cannot claim your own gift', 'SELF_CLAIM');
    }

    // Get user info
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    // Claim the gift
    await gift.claim(user._id, user.fullName || 'AppZap User');

    // Award bonus points for receiving gift
    try {
      await loyaltyService.awardPoints(
        userId,
        100,  // 100 bonus points for claiming gift
        'gift_received',
        gift._id.toString(),
        `Claimed gift from ${gift.senderName}`
      );
    } catch (error) {
      logger.warn('Failed to award bonus points for gift claim', { giftId: gift._id, error });
    }

    logger.info('Gift claimed', {
      giftId: gift._id,
      giftCode: gift.giftCode,
      recipientId: userId,
    });

    return gift;
  } catch (error) {
    logger.error('Failed to claim gift', { giftCode, userId, error });
    throw error;
  }
};

// ============================================================================
// REDEEM GIFT
// ============================================================================

/**
 * Redeem gift at restaurant
 */
export const redeemGift = async (
  userId: string,
  input: RedeemGiftInput
): Promise<{ gift: IGift; amountRedeemed: number; remainingAmount: number }> => {
  try {
    const gift = await Gift.findByCode(input.giftCode);
    if (!gift) {
      throw new NotFoundError('Gift', input.giftCode);
    }

    // Must be owned by user (claimed)
    if (!gift.recipientId || gift.recipientId.toString() !== userId) {
      throw new BusinessLogicError('Gift does not belong to user', 'UNAUTHORIZED');
    }

    // Check if redeemable
    if (!['claimed', 'partially_used'].includes(gift.status)) {
      throw new BusinessLogicError(
        `Cannot redeem gift with status: ${gift.status}`,
        'INVALID_STATUS'
      );
    }

    // Check expiration
    if (gift.expiresAt < new Date()) {
      gift.status = 'expired';
      await gift.save();
      throw new BusinessLogicError('Gift has expired', 'GIFT_EXPIRED');
    }

    // Check restaurant validity
    if (!gift.isValidForRestaurant(input.restaurantId)) {
      throw new BusinessLogicError(
        'Gift is not valid at this restaurant',
        'INVALID_RESTAURANT'
      );
    }

    // Determine redemption amount
    const redeemAmount = input.amount || gift.remainingAmount;
    
    if (redeemAmount > gift.remainingAmount) {
      throw new BusinessLogicError(
        `Redemption amount exceeds remaining balance (${gift.remainingAmount.toLocaleString()} LAK)`,
        'INSUFFICIENT_BALANCE'
      );
    }

    // Get restaurant name
    let restaurantName = 'Unknown Restaurant';
    try {
      const restaurant = await posRouter.getRestaurantById(input.restaurantId);
      if (restaurant) {
        restaurantName = restaurant.name;
      }
    } catch (error) {
      logger.warn('Could not fetch restaurant name', { restaurantId: input.restaurantId });
    }

    // Perform redemption
    await gift.redeem(redeemAmount, input.restaurantId, restaurantName, input.orderId);

    logger.info('Gift redeemed', {
      giftId: gift._id,
      giftCode: gift.giftCode,
      amount: redeemAmount,
      remainingAmount: gift.remainingAmount,
      restaurantId: input.restaurantId,
    });

    return {
      gift,
      amountRedeemed: redeemAmount,
      remainingAmount: gift.remainingAmount,
    };
  } catch (error) {
    logger.error('Failed to redeem gift', { userId, input, error });
    throw error;
  }
};

// ============================================================================
// GET GIFT DETAILS
// ============================================================================

/**
 * Get gift by code (public - for claiming)
 */
export const getGiftByCode = async (code: string): Promise<IGift | null> => {
  try {
    const gift = await Gift.findByCode(code);
    
    // Update link click tracking
    if (gift && gift.shareHistory.length > 0) {
      const lastShare = gift.shareHistory[gift.shareHistory.length - 1];
      if (!lastShare.linkClicked) {
        lastShare.linkClicked = true;
        lastShare.linkClickedAt = new Date();
        await gift.save();
      }
    }
    
    return gift;
  } catch (error) {
    logger.error('Failed to get gift by code', { code, error });
    throw error;
  }
};

/**
 * Get gift by ID (authenticated)
 */
export const getGiftById = async (giftId: string, userId: string): Promise<IGift> => {
  try {
    const gift = await Gift.findById(giftId);
    if (!gift) {
      throw new NotFoundError('Gift', giftId);
    }

    // Must be sender or recipient
    if (
      gift.senderId.toString() !== userId &&
      gift.recipientId?.toString() !== userId
    ) {
      throw new BusinessLogicError('Gift does not belong to user', 'UNAUTHORIZED');
    }

    return gift;
  } catch (error) {
    logger.error('Failed to get gift', { giftId, userId, error });
    throw error;
  }
};

// ============================================================================
// GET USER GIFTS
// ============================================================================

/**
 * Get gifts sent by user
 */
export const getSentGifts = async (
  userId: string,
  params?: { status?: GiftStatus; limit?: number; skip?: number }
): Promise<{ data: IGift[]; total: number }> => {
  try {
    const query: any = { senderId: userId };
    if (params?.status) {
      query.status = params.status;
    }

    const [data, total] = await Promise.all([
      Gift.find(query)
        .sort({ createdAt: -1 })
        .limit(params?.limit || 20)
        .skip(params?.skip || 0),
      Gift.countDocuments(query),
    ]);

    return { data, total };
  } catch (error) {
    logger.error('Failed to get sent gifts', { userId, error });
    throw error;
  }
};

/**
 * Get gifts received by user
 */
export const getReceivedGifts = async (
  userId: string,
  params?: { status?: GiftStatus; limit?: number; skip?: number }
): Promise<{ data: IGift[]; total: number }> => {
  try {
    const query: any = { recipientId: userId };
    if (params?.status) {
      query.status = params.status;
    }

    const [data, total] = await Promise.all([
      Gift.find(query)
        .sort({ createdAt: -1 })
        .limit(params?.limit || 20)
        .skip(params?.skip || 0),
      Gift.countDocuments(query),
    ]);

    return { data, total };
  } catch (error) {
    logger.error('Failed to get received gifts', { userId, error });
    throw error;
  }
};

// ============================================================================
// CANCEL GIFT
// ============================================================================

/**
 * Cancel a gift (sender only, before claim)
 */
export const cancelGift = async (
  giftId: string,
  userId: string,
  reason?: string
): Promise<IGift> => {
  try {
    const gift = await Gift.findById(giftId);
    if (!gift) {
      throw new NotFoundError('Gift', giftId);
    }

    // Only sender can cancel
    if (gift.senderId.toString() !== userId) {
      throw new BusinessLogicError('Gift does not belong to user', 'UNAUTHORIZED');
    }

    // Can only cancel pending or active gifts
    if (!['pending_payment', 'active'].includes(gift.status)) {
      throw new BusinessLogicError(
        `Cannot cancel gift with status: ${gift.status}`,
        'INVALID_STATUS'
      );
    }

    await gift.cancel(reason);

    // TODO: Trigger refund if paid

    logger.info('Gift cancelled', {
      giftId: gift._id,
      userId,
      reason,
    });

    return gift;
  } catch (error) {
    logger.error('Failed to cancel gift', { giftId, userId, error });
    throw error;
  }
};

// ============================================================================
// EXPIRE GIFTS (Cron job)
// ============================================================================

/**
 * Mark expired gifts
 */
export const expireGifts = async (): Promise<number> => {
  try {
    const expiredGifts = await Gift.findExpiredGifts();
    
    for (const gift of expiredGifts) {
      gift.status = 'expired';
      await gift.save();
      
      logger.info('Gift expired', {
        giftId: gift._id,
        giftCode: gift.giftCode,
      });
    }

    logger.info('Expired gifts processed', { count: expiredGifts.length });
    return expiredGifts.length;
  } catch (error) {
    logger.error('Failed to expire gifts', { error });
    throw error;
  }
};

// ============================================================================
// EXPORT
// ============================================================================

export default {
  getGiftTemplates,
  getTemplateById,
  createGift,
  activateGift,
  shareGift,
  claimGift,
  redeemGift,
  getGiftByCode,
  getGiftById,
  getSentGifts,
  getReceivedGifts,
  cancelGift,
  expireGifts,
};
