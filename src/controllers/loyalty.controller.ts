/**
 * Loyalty Controller
 * Handles loyalty points balance, history, and redemption
 * 
 * Features:
 * - Universal ZapPoints across all AppZap restaurants
 * - Points balance and tier information
 * - Transaction history with filtering
 * - Points redemption validation and execution
 */

import { Request, Response } from 'express';
import * as loyaltyService from '../services/loyalty.service';
import LoyaltyTransaction from '../models/LoyaltyTransaction';
import logger from '../utils/logger';
import { ValidationError } from '../utils/errors';

// ============================================================================
// GET LOYALTY BALANCE
// ============================================================================

/**
 * Get Loyalty Balance
 * GET /api/v1/loyalty/balance
 * 
 * Returns user's current points balance, tier, and expiring points info
 */
export const getBalance = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const balance = await loyaltyService.getLoyaltyBalance(req.user._id.toString());

    res.json({
      success: true,
      data: {
        balance: balance.balance,
        tier: balance.tier,
        tierBenefits: getTierBenefits(balance.tier),
        nextTier: getNextTier(balance.tier),
        rates: {
          earnRate: `${loyaltyService.LAK_PER_POINT.toLocaleString()} LAK = 1 point`,
          redeemRate: `10 points = ${(10 * loyaltyService.POINTS_TO_LAK_RATE).toLocaleString()} LAK discount`,
        },
        expiring: balance.expiringPoints
          ? {
              amount: balance.expiringPoints.amount,
              expiryDate: balance.expiringPoints.expiryDate,
              daysRemaining: Math.ceil(
                (balance.expiringPoints.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              ),
            }
          : null,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get loyalty balance', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'GET_BALANCE_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// GET LOYALTY HISTORY
// ============================================================================

/**
 * Get Loyalty History
 * GET /api/v1/loyalty/history
 * 
 * @query type - Filter by transaction type (earn, redeem, expire)
 * @query limit - Number of records to return (default: 20)
 * @query skip - Number of records to skip for pagination
 * @query startDate - Filter from date (YYYY-MM-DD)
 * @query endDate - Filter to date (YYYY-MM-DD)
 */
export const getHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const {
      type,
      limit = '20',
      skip = '0',
      startDate,
      endDate,
    } = req.query;

    // Build query
    const query: any = { userId: req.user._id };

    if (type) {
      query.type = type;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate as string);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate as string);
      }
    }

    const [transactions, total] = await Promise.all([
      LoyaltyTransaction.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit as string))
        .skip(parseInt(skip as string))
        .lean(),
      LoyaltyTransaction.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: transactions.map(formatTransactionResponse),
      pagination: {
        limit: parseInt(limit as string),
        skip: parseInt(skip as string),
        total,
        hasMore: parseInt(skip as string) + transactions.length < total,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get loyalty history', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'GET_HISTORY_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// PREVIEW REDEMPTION
// ============================================================================

/**
 * Preview Points Redemption
 * POST /api/v1/loyalty/preview-redemption
 * 
 * Validates and previews how many points can be redeemed for an order
 * 
 * @body points - Number of points to redeem
 * @body orderTotal - Total amount of the order
 */
export const previewRedemption = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { points, orderTotal } = req.body;

    if (!points || !orderTotal) {
      throw new ValidationError('points and orderTotal are required');
    }

    const pointsNumber = parseInt(points);
    const orderTotalNumber = parseFloat(orderTotal);

    if (isNaN(pointsNumber) || pointsNumber < 0) {
      throw new ValidationError('points must be a positive number');
    }

    if (isNaN(orderTotalNumber) || orderTotalNumber <= 0) {
      throw new ValidationError('orderTotal must be a positive number');
    }

    // Get user's current balance
    const balance = await loyaltyService.getLoyaltyBalance(req.user._id.toString());

    // Validate redemption
    const validation = loyaltyService.validatePointsRedemption(
      balance.balance,
      pointsNumber,
      orderTotalNumber
    );

    if (!validation.valid) {
      res.json({
        success: true,
        data: {
          valid: false,
          error: validation.error,
          currentBalance: balance.balance,
          requestedPoints: pointsNumber,
          maxRedeemable: validation.maxRedeemable,
          maxDiscount: validation.maxRedeemable
            ? loyaltyService.calculateLoyaltyDiscount(validation.maxRedeemable)
            : 0,
        },
      });
      return;
    }

    const discountAmount = loyaltyService.calculateLoyaltyDiscount(pointsNumber);
    const newTotal = orderTotalNumber - discountAmount;
    const remainingBalance = balance.balance - pointsNumber;

    res.json({
      success: true,
      data: {
        valid: true,
        pointsToRedeem: pointsNumber,
        discountAmount,
        originalTotal: orderTotalNumber,
        newTotal,
        currentBalance: balance.balance,
        remainingBalance,
        summary: `Redeem ${pointsNumber} points for ${discountAmount.toLocaleString()} LAK discount`,
      },
    });
  } catch (error: any) {
    logger.error('Failed to preview redemption', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'PREVIEW_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// REDEEM POINTS
// ============================================================================

/**
 * Redeem Points
 * POST /api/v1/loyalty/redeem
 * 
 * Redeems points for an order discount
 * 
 * @body points - Number of points to redeem
 * @body orderId - The order ID to apply the discount to
 * @body orderTotal - Total amount of the order (for validation)
 */
export const redeemPoints = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { points, orderId, orderTotal } = req.body;

    if (!points || !orderId || !orderTotal) {
      throw new ValidationError('points, orderId, and orderTotal are required');
    }

    const pointsNumber = parseInt(points);
    const orderTotalNumber = parseFloat(orderTotal);

    if (isNaN(pointsNumber) || pointsNumber <= 0) {
      throw new ValidationError('points must be a positive number');
    }

    if (isNaN(orderTotalNumber) || orderTotalNumber <= 0) {
      throw new ValidationError('orderTotal must be a positive number');
    }

    // Execute redemption
    const result = await loyaltyService.redeemPoints(
      req.user._id.toString(),
      pointsNumber,
      orderId,
      orderTotalNumber
    );

    logger.info('Points redeemed', {
      userId: req.user._id.toString(),
      points: pointsNumber,
      discountAmount: result.discountAmount,
      orderId,
    });

    res.json({
      success: true,
      data: {
        pointsRedeemed: pointsNumber,
        discountAmount: result.discountAmount,
        newBalance: result.newBalance,
        orderId,
        message: `Successfully redeemed ${pointsNumber} points for ${result.discountAmount.toLocaleString()} LAK discount`,
      },
    });
  } catch (error: any) {
    logger.error('Failed to redeem points', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'REDEEM_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// GET TIER INFO
// ============================================================================

/**
 * Get Tier Information
 * GET /api/v1/loyalty/tiers
 * 
 * Returns information about all loyalty tiers and their benefits
 */
export const getTiers = async (req: Request, res: Response): Promise<void> => {
  try {
    const tiers = [
      {
        name: 'bronze',
        displayName: 'Bronze',
        minPoints: loyaltyService.TIER_THRESHOLDS.bronze,
        benefits: getTierBenefits('bronze'),
        icon: '🥉',
      },
      {
        name: 'silver',
        displayName: 'Silver',
        minPoints: loyaltyService.TIER_THRESHOLDS.silver,
        benefits: getTierBenefits('silver'),
        icon: '🥈',
      },
      {
        name: 'gold',
        displayName: 'Gold',
        minPoints: loyaltyService.TIER_THRESHOLDS.gold,
        benefits: getTierBenefits('gold'),
        icon: '🥇',
      },
      {
        name: 'platinum',
        displayName: 'Platinum',
        minPoints: loyaltyService.TIER_THRESHOLDS.platinum,
        benefits: getTierBenefits('platinum'),
        icon: '💎',
      },
    ];

    // Include user's current tier if authenticated
    let userTier = null;
    if (req.user) {
      const balance = await loyaltyService.getLoyaltyBalance(req.user._id.toString());
      userTier = {
        current: balance.tier,
        balance: balance.balance,
        nextTier: getNextTier(balance.tier),
      };
    }

    res.json({
      success: true,
      data: {
        tiers,
        userTier,
        rates: {
          earnRate: loyaltyService.LAK_PER_POINT,
          redeemRate: loyaltyService.POINTS_TO_LAK_RATE,
          expiryDays: loyaltyService.POINTS_EXPIRY_DAYS,
        },
      },
    });
  } catch (error: any) {
    logger.error('Failed to get tier info', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'GET_TIERS_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// GET EARNING OPPORTUNITIES
// ============================================================================

/**
 * Get Earning Opportunities
 * GET /api/v1/loyalty/earn
 * 
 * Returns ways to earn points
 */
export const getEarningOpportunities = async (req: Request, res: Response): Promise<void> => {
  try {
    const opportunities = [
      {
        type: 'order',
        title: 'Order Food',
        description: `Earn 1 point for every ${loyaltyService.LAK_PER_POINT.toLocaleString()} LAK spent`,
        icon: '🍽️',
        multiplier: 1,
      },
      {
        type: 'review',
        title: 'Write a Review',
        description: 'Earn 3,000 points for each restaurant review',
        icon: '⭐',
        points: 3000,
      },
      {
        type: 'referral',
        title: 'Refer a Friend',
        description: 'Earn 5,000 points when your friend makes their first order',
        icon: '👥',
        points: 5000,
      },
      {
        type: 'first_order',
        title: 'First Order Bonus',
        description: 'New users get 2x points on their first order',
        icon: '🎉',
        multiplier: 2,
      },
    ];

    res.json({
      success: true,
      data: opportunities,
    });
  } catch (error: any) {
    logger.error('Failed to get earning opportunities', { error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'GET_OPPORTUNITIES_FAILED',
        message: error.message,
      },
    });
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get benefits for a tier
 */
function getTierBenefits(tier: string): string[] {
  const benefits: Record<string, string[]> = {
    bronze: [
      'Earn 1 point per 1,000 LAK spent',
      'Redeem points for discounts',
      'Birthday bonus points',
    ],
    silver: [
      'All Bronze benefits',
      '1.2x points multiplier',
      'Early access to promotions',
      'Free delivery on orders over 100,000 LAK',
    ],
    gold: [
      'All Silver benefits',
      '1.5x points multiplier',
      'Priority customer support',
      'Exclusive Gold member offers',
      'Free delivery on all orders',
    ],
    platinum: [
      'All Gold benefits',
      '2x points multiplier',
      'VIP customer support',
      'Exclusive Platinum events',
      'Complimentary upgrades',
      'Personal account manager',
    ],
  };

  return benefits[tier] || benefits.bronze;
}

/**
 * Get next tier information
 */
function getNextTier(currentTier: string): { name: string; pointsNeeded: number } | null {
  const tierOrder = ['bronze', 'silver', 'gold', 'platinum'];
  const currentIndex = tierOrder.indexOf(currentTier);

  if (currentIndex === -1 || currentIndex >= tierOrder.length - 1) {
    return null; // Already at highest tier or invalid tier
  }

  const nextTierName = tierOrder[currentIndex + 1];
  const thresholds = loyaltyService.TIER_THRESHOLDS;

  return {
    name: nextTierName,
    pointsNeeded: thresholds[nextTierName as keyof typeof thresholds],
  };
}

/**
 * Format transaction for API response
 */
function formatTransactionResponse(transaction: any): any {
  return {
    id: transaction._id,
    type: transaction.type,
    amount: transaction.amount,
    source: transaction.source,
    description: transaction.description,
    balanceBefore: transaction.balanceBefore,
    balanceAfter: transaction.balanceAfter,
    expiresAt: transaction.expiresAt,
    createdAt: transaction.createdAt,
  };
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  getBalance,
  getHistory,
  previewRedemption,
  redeemPoints,
  getTiers,
  getEarningOpportunities,
};
