/**
 * Gift Controller
 * 
 * Handles Social Gifting feature endpoints:
 * - Browse gift templates
 * - Purchase/create gifts
 * - Share gifts via WhatsApp/Link
 * - Claim received gifts
 * - Redeem gifts at restaurants
 * - View gift history
 */

import { Request, Response } from 'express';
import * as giftService from '../services/gift.service';
import Gift from '../models/Gift';
import logger from '../utils/logger';
import { ValidationError } from '../utils/errors';

// ============================================================================
// GET GIFT TEMPLATES
// ============================================================================

/**
 * Get Available Gift Templates
 * GET /api/v1/gifts/templates
 * 
 * Returns list of gift templates (Digital Coffee, Meal Voucher, etc.)
 */
export const getTemplates = async (req: Request, res: Response): Promise<void> => {
  try {
    const templates = await giftService.getGiftTemplates();

    res.json({
      success: true,
      data: templates.map(t => ({
        id: t.type,
        type: t.type,
        name: t.name,
        nameEn: t.nameEn,
        description: t.description,
        descriptionEn: t.descriptionEn,
        amount: t.amount,
        currency: t.currency,
        image: t.image,
        icon: t.icon,
        validDays: t.validDays,
        isCustomAmount: t.type === 'custom_amount',
        minAmount: t.minAmount,
        maxAmount: t.maxAmount,
      })),
    });
  } catch (error: any) {
    logger.error('Failed to get gift templates', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'GET_TEMPLATES_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// CREATE GIFT
// ============================================================================

/**
 * Create/Purchase a Gift
 * POST /api/v1/gifts
 * 
 * @body type - Gift type (digital_coffee, meal_voucher, custom_amount, experience)
 * @body templateId - Optional template ID
 * @body amount - Required for custom_amount type
 * @body recipientPhone - Recipient's phone number
 * @body recipientName - Recipient's name
 * @body message - Personal message
 * @body paymentMethod - 'phapay' or 'loyalty_points'
 */
export const createGift = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const {
      type,
      templateId,
      amount,
      recipientPhone,
      recipientEmail,
      recipientName,
      message,
      restaurantIds,
      paymentMethod = 'phapay',
    } = req.body;

    if (!type) {
      throw new ValidationError('Gift type is required');
    }

    const result = await giftService.createGift(req.user._id.toString(), {
      type,
      templateId,
      amount: amount ? parseFloat(amount) : undefined,
      recipientPhone,
      recipientEmail,
      recipientName,
      message,
      restaurantIds,
      paymentMethod,
    });

    logger.info('Gift created', {
      giftId: result.gift._id,
      userId: req.user._id.toString(),
      paymentRequired: result.paymentRequired,
    });

    res.status(201).json({
      success: true,
      data: {
        gift: formatGiftResponse(result.gift, 'sender'),
        paymentRequired: result.paymentRequired,
        paymentAmount: result.paymentAmount,
        shareUrl: result.gift.getShareableLink(),
      },
    });
  } catch (error: any) {
    logger.error('Failed to create gift', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'CREATE_GIFT_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// ACTIVATE GIFT (Payment Callback)
// ============================================================================

/**
 * Activate Gift After Payment
 * POST /api/v1/gifts/:giftId/activate
 * 
 * Called after payment is confirmed
 */
export const activateGift = async (req: Request, res: Response): Promise<void> => {
  try {
    const { giftId } = req.params;
    const { paymentId, paymentMethod } = req.body;

    if (!paymentId) {
      throw new ValidationError('Payment ID is required');
    }

    const gift = await giftService.activateGift(giftId, paymentId, paymentMethod || 'phapay');

    res.json({
      success: true,
      data: {
        gift: formatGiftResponse(gift, 'sender'),
        shareUrl: gift.getShareableLink(),
        message: 'Gift activated successfully',
      },
    });
  } catch (error: any) {
    logger.error('Failed to activate gift', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'ACTIVATE_GIFT_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// SHARE GIFT
// ============================================================================

/**
 * Share Gift via Channel
 * POST /api/v1/gifts/:giftId/share
 * 
 * Records share action and returns share URLs
 * 
 * @body channel - 'whatsapp' | 'link' | 'sms' | 'email'
 * @body recipientPhone - Required for WhatsApp/SMS
 */
export const shareGift = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { giftId } = req.params;
    const { channel = 'link', recipientPhone, recipientEmail } = req.body;

    const result = await giftService.shareGift(giftId, req.user._id.toString(), {
      giftId,
      channel,
      recipientPhone,
      recipientEmail,
    });

    res.json({
      success: true,
      data: {
        shareUrl: result.shareUrl,
        whatsappUrl: result.whatsappUrl,
        giftCode: result.gift.giftCode,
        channel,
      },
    });
  } catch (error: any) {
    logger.error('Failed to share gift', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'SHARE_GIFT_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// GET GIFT BY CODE (Public)
// ============================================================================

/**
 * Get Gift Details by Code
 * GET /api/v1/gifts/code/:code
 * 
 * Public endpoint - for gift claiming page
 */
export const getGiftByCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.params;

    const gift = await giftService.getGiftByCode(code);

    if (!gift) {
      res.status(404).json({
        success: false,
        error: {
          code: 'GIFT_NOT_FOUND',
          message: 'Gift not found',
        },
      });
      return;
    }

    // Return limited info for public view
    res.json({
      success: true,
      data: {
        giftCode: gift.giftCode,
        type: gift.type,
        name: gift.name,
        description: gift.description,
        image: gift.image,
        icon: gift.icon,
        amount: gift.originalAmount,
        currency: gift.currency,
        senderName: gift.senderName,
        message: gift.message?.text,
        status: gift.status,
        expiresAt: gift.expiresAt,
        isExpired: gift.expiresAt < new Date(),
        isClaimed: !!gift.recipientId,
        isRedeemable: ['active', 'claimed', 'partially_used'].includes(gift.status) && 
                      gift.expiresAt >= new Date() &&
                      gift.remainingAmount > 0,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get gift by code', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'GET_GIFT_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// CLAIM GIFT
// ============================================================================

/**
 * Claim a Gift
 * POST /api/v1/gifts/claim
 * 
 * Recipient claims ownership of a gift
 * 
 * @body giftCode - The gift code to claim
 */
export const claimGift = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { giftCode } = req.body;

    if (!giftCode) {
      throw new ValidationError('Gift code is required');
    }

    const gift = await giftService.claimGift(giftCode, req.user._id.toString());

    logger.info('Gift claimed', {
      giftId: gift._id,
      userId: req.user._id.toString(),
    });

    res.json({
      success: true,
      data: {
        gift: formatGiftResponse(gift, 'recipient'),
        message: 'Gift claimed successfully! You can now use it at any AppZap restaurant.',
      },
    });
  } catch (error: any) {
    logger.error('Failed to claim gift', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'CLAIM_GIFT_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// REDEEM GIFT
// ============================================================================

/**
 * Redeem Gift at Restaurant
 * POST /api/v1/gifts/redeem
 * 
 * Use gift value at a restaurant
 * 
 * @body giftCode - The gift code to redeem
 * @body restaurantId - Restaurant ID
 * @body orderId - Optional order ID
 * @body amount - Optional partial amount to redeem
 */
export const redeemGift = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { giftCode, restaurantId, orderId, amount } = req.body;

    if (!giftCode) {
      throw new ValidationError('Gift code is required');
    }

    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required');
    }

    const result = await giftService.redeemGift(req.user._id.toString(), {
      giftCode,
      restaurantId,
      orderId,
      amount: amount ? parseFloat(amount) : undefined,
    });

    logger.info('Gift redeemed', {
      giftId: result.gift._id,
      userId: req.user._id.toString(),
      amountRedeemed: result.amountRedeemed,
    });

    res.json({
      success: true,
      data: {
        amountRedeemed: result.amountRedeemed,
        remainingAmount: result.remainingAmount,
        isFullyRedeemed: result.remainingAmount === 0,
        gift: formatGiftResponse(result.gift, 'recipient'),
        message: `Successfully redeemed ${result.amountRedeemed.toLocaleString()} LAK`,
      },
    });
  } catch (error: any) {
    logger.error('Failed to redeem gift', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'REDEEM_GIFT_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// GET USER'S SENT GIFTS
// ============================================================================

/**
 * Get Gifts Sent by User
 * GET /api/v1/gifts/sent
 * 
 * @query status - Filter by status
 * @query limit - Number of results
 * @query skip - Pagination offset
 */
export const getSentGifts = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { status, limit = '20', skip = '0' } = req.query;

    const result = await giftService.getSentGifts(req.user._id.toString(), {
      status: status as any,
      limit: parseInt(limit as string),
      skip: parseInt(skip as string),
    });

    res.json({
      success: true,
      data: result.data.map(g => formatGiftResponse(g, 'sender')),
      pagination: {
        limit: parseInt(limit as string),
        skip: parseInt(skip as string),
        total: result.total,
        hasMore: parseInt(skip as string) + result.data.length < result.total,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get sent gifts', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'GET_SENT_GIFTS_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// GET USER'S RECEIVED GIFTS
// ============================================================================

/**
 * Get Gifts Received by User
 * GET /api/v1/gifts/received
 * 
 * @query status - Filter by status
 * @query limit - Number of results
 * @query skip - Pagination offset
 */
export const getReceivedGifts = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { status, limit = '20', skip = '0' } = req.query;

    const result = await giftService.getReceivedGifts(req.user._id.toString(), {
      status: status as any,
      limit: parseInt(limit as string),
      skip: parseInt(skip as string),
    });

    res.json({
      success: true,
      data: result.data.map(g => formatGiftResponse(g, 'recipient')),
      pagination: {
        limit: parseInt(limit as string),
        skip: parseInt(skip as string),
        total: result.total,
        hasMore: parseInt(skip as string) + result.data.length < result.total,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get received gifts', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'GET_RECEIVED_GIFTS_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// GET GIFT DETAILS
// ============================================================================

/**
 * Get Gift Details by ID
 * GET /api/v1/gifts/:giftId
 * 
 * Full gift details for owner (sender or recipient)
 */
export const getGiftById = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { giftId } = req.params;

    const gift = await giftService.getGiftById(giftId, req.user._id.toString());
    
    const viewType = gift.senderId.toString() === req.user._id.toString() 
      ? 'sender' 
      : 'recipient';

    res.json({
      success: true,
      data: formatGiftResponse(gift, viewType),
    });
  } catch (error: any) {
    logger.error('Failed to get gift', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'GET_GIFT_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// CANCEL GIFT
// ============================================================================

/**
 * Cancel a Gift
 * DELETE /api/v1/gifts/:giftId
 * 
 * Only sender can cancel, and only before it's claimed
 * 
 * @body reason - Optional cancellation reason
 */
export const cancelGift = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { giftId } = req.params;
    const { reason } = req.body;

    const gift = await giftService.cancelGift(
      giftId,
      req.user._id.toString(),
      reason
    );

    logger.info('Gift cancelled', {
      giftId: gift._id,
      userId: req.user._id.toString(),
    });

    res.json({
      success: true,
      data: {
        giftId: gift._id,
        status: 'cancelled',
        message: 'Gift cancelled successfully',
      },
    });
  } catch (error: any) {
    logger.error('Failed to cancel gift', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'CANCEL_GIFT_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format gift for API response
 */
function formatGiftResponse(gift: any, viewType: 'sender' | 'recipient'): any {
  const base = {
    id: gift._id,
    giftCode: gift.giftCode,
    type: gift.type,
    name: gift.name,
    description: gift.description,
    image: gift.image,
    icon: gift.icon,
    originalAmount: gift.originalAmount,
    remainingAmount: gift.remainingAmount,
    currency: gift.currency,
    status: gift.status,
    validFrom: gift.validFrom,
    expiresAt: gift.expiresAt,
    isExpired: gift.expiresAt < new Date(),
    daysUntilExpiry: Math.max(0, Math.ceil((gift.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))),
    message: gift.message,
    createdAt: gift.createdAt,
    shareUrl: gift.getShareableLink ? gift.getShareableLink() : null,
  };

  if (viewType === 'sender') {
    return {
      ...base,
      recipient: {
        phone: gift.recipientPhone,
        email: gift.recipientEmail,
        name: gift.recipientName,
        claimed: !!gift.recipientId,
        claimedAt: gift.claimedAt,
      },
      shareHistory: gift.shareHistory?.map((s: any) => ({
        channel: s.channel,
        sharedAt: s.sharedAt,
        linkClicked: s.linkClicked,
      })),
      redemptions: gift.redemptions?.map((r: any) => ({
        amount: r.amount,
        redeemedAt: r.redeemedAt,
        restaurantName: r.restaurantName,
      })),
    };
  } else {
    return {
      ...base,
      sender: {
        name: gift.senderName,
      },
      redemptions: gift.redemptions?.map((r: any) => ({
        amount: r.amount,
        redeemedAt: r.redeemedAt,
        restaurantName: r.restaurantName,
      })),
      isRedeemable: ['claimed', 'partially_used'].includes(gift.status) && 
                    gift.expiresAt >= new Date() &&
                    gift.remainingAmount > 0,
    };
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  getTemplates,
  createGift,
  activateGift,
  shareGift,
  getGiftByCode,
  claimGift,
  redeemGift,
  getSentGifts,
  getReceivedGifts,
  getGiftById,
  cancelGift,
};
