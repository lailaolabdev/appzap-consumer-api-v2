import User, { IUser } from '../models/User';
import LoyaltyTransaction from '../models/LoyaltyTransaction';
import logger from '../utils/logger';
import { InsufficientPointsError, BusinessLogicError } from '../utils/errors';

/**
 * Loyalty Points Service
 * Handles earning, redeeming, and managing loyalty points
 */

// ============================================================================
// CONSTANTS
// ============================================================================

// 1000 LAK = 1 point
export const LAK_PER_POINT = 1000;

// 10 points = 500 LAK discount
export const POINTS_TO_LAK_RATE = 50;

// Points expiry: 1 year
export const POINTS_EXPIRY_DAYS = 365;

// Tier thresholds
export const TIER_THRESHOLDS = {
  bronze: 0,
  silver: 2000,
  gold: 5000,
  platinum: 10000,
};

// ============================================================================
// EARN POINTS
// ============================================================================

/**
 * Calculate points to earn from order amount
 */
export const calculateEarnedPoints = (orderTotal: number): number => {
  // 1000 LAK = 1 point
  return Math.floor(orderTotal / LAK_PER_POINT);
};

/**
 * Award points to user
 */
export const awardPoints = async (
  userId: string,
  points: number,
  source: string,
  sourceId: string,
  description: string
): Promise<void> => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new BusinessLogicError('User not found', 'USER_NOT_FOUND');
    }

    const balanceBefore = user.points.balance;
    const balanceAfter = balanceBefore + points;

    // Create loyalty transaction
    await LoyaltyTransaction.create({
      userId: user._id,
      type: 'earn',
      amount: points,
      source,
      sourceId,
      description,
      balanceBefore,
      balanceAfter,
      expiresAt: new Date(Date.now() + POINTS_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    });

    // Update user points
    user.points.balance = balanceAfter;
    user.points.totalEarned += points;
    await user.save();

    logger.info('Points awarded to user', {
      userId: user._id.toString(),
      points,
      balanceAfter,
      source,
    });
  } catch (error) {
    logger.error('Failed to award points', { userId, points, error });
    throw error;
  }
};

// ============================================================================
// REDEEM POINTS
// ============================================================================

/**
 * Calculate discount from points
 */
export const calculateLoyaltyDiscount = (pointsToRedeem: number): number => {
  // 10 points = 500 LAK
  return pointsToRedeem * POINTS_TO_LAK_RATE;
};

/**
 * Validate points redemption
 */
export const validatePointsRedemption = (
  userBalance: number,
  pointsToRedeem: number,
  orderTotal: number
): { valid: boolean; error?: string; maxRedeemable?: number } => {
  // Check if user has enough points
  if (pointsToRedeem > userBalance) {
    return {
      valid: false,
      error: 'Insufficient points',
      maxRedeemable: userBalance,
    };
  }

  // Calculate discount
  const discount = calculateLoyaltyDiscount(pointsToRedeem);

  // Discount cannot exceed order total
  if (discount > orderTotal) {
    const maxRedeemablePoints = Math.floor(orderTotal / POINTS_TO_LAK_RATE);
    return {
      valid: false,
      error: 'Discount cannot exceed order total',
      maxRedeemable: maxRedeemablePoints,
    };
  }

  return { valid: true };
};

/**
 * Redeem points for discount
 */
export const redeemPoints = async (
  userId: string,
  pointsToRedeem: number,
  orderId: string,
  orderTotal: number
): Promise<{ discountAmount: number; newBalance: number }> => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new BusinessLogicError('User not found', 'USER_NOT_FOUND');
    }

    // Validate redemption
    const validation = validatePointsRedemption(
      user.points.balance,
      pointsToRedeem,
      orderTotal
    );

    if (!validation.valid) {
      throw new InsufficientPointsError(pointsToRedeem, user.points.balance);
    }

    const discountAmount = calculateLoyaltyDiscount(pointsToRedeem);
    const balanceBefore = user.points.balance;
    const balanceAfter = balanceBefore - pointsToRedeem;

    // Create loyalty transaction
    await LoyaltyTransaction.create({
      userId: user._id,
      type: 'redeem',
      amount: -pointsToRedeem,
      source: 'redemption',
      sourceId: orderId,
      description: `Redeemed for ${discountAmount.toLocaleString()} LAK discount`,
      balanceBefore,
      balanceAfter,
    });

    // Update user points
    user.points.balance = balanceAfter;
    user.points.totalRedeemed += pointsToRedeem;
    await user.save();

    logger.info('Points redeemed', {
      userId: user._id.toString(),
      pointsRedeemed: pointsToRedeem,
      discountAmount,
      balanceAfter,
    });

    return {
      discountAmount,
      newBalance: balanceAfter,
    };
  } catch (error) {
    logger.error('Failed to redeem points', { userId, pointsToRedeem, error });
    throw error;
  }
};

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get user loyalty balance
 */
export const getLoyaltyBalance = async (
  userId: string
): Promise<{
  balance: number;
  tier: string;
  earnRate: number;
  redeemRate: number;
  expiringPoints?: { amount: number; expiryDate: Date };
}> => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new BusinessLogicError('User not found', 'USER_NOT_FOUND');
    }

    // Get expiring points (next 30 days)
    const expiringDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const expiringTransactions = await LoyaltyTransaction.find({
      userId: user._id,
      type: 'earn',
      expiresAt: { $lt: expiringDate, $gt: new Date() },
    });

    const expiringPoints = expiringTransactions.reduce(
      (sum, txn) => sum + txn.amount,
      0
    );

    return {
      balance: user.points.balance,
      tier: user.points.tier,
      earnRate: 1, // 1000 LAK = 1 point
      redeemRate: POINTS_TO_LAK_RATE, // 10 points = 500 LAK
      ...(expiringPoints > 0 && {
        expiringPoints: {
          amount: expiringPoints,
          expiryDate: expiringTransactions[0].expiresAt!,
        },
      }),
    };
  } catch (error) {
    logger.error('Failed to get loyalty balance', { userId, error });
    throw error;
  }
};

/**
 * Get loyalty transaction history
 */
export const getLoyaltyHistory = async (
  userId: string,
  params?: { limit?: number; skip?: number }
): Promise<any[]> => {
  try {
    const limit = params?.limit || 20;
    const skip = params?.skip || 0;

    const transactions = await LoyaltyTransaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    return transactions;
  } catch (error) {
    logger.error('Failed to get loyalty history', { userId, error });
    throw error;
  }
};

// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================

/**
 * Award bonus points (admin/marketing)
 */
export const awardBonusPoints = async (
  userId: string,
  points: number,
  reason: string
): Promise<void> => {
  await awardPoints(userId, points, 'admin', 'bonus', `Bonus: ${reason}`);
};

/**
 * Expire old points (cron job)
 */
export const expireOldPoints = async (): Promise<void> => {
  try {
    const now = new Date();

    // Find expired transactions
    const expiredTransactions = await LoyaltyTransaction.find({
      type: 'earn',
      expiresAt: { $lt: now },
    });

    for (const transaction of expiredTransactions) {
      const user = await User.findById(transaction.userId);
      if (!user) continue;

      const pointsToExpire = transaction.amount;
      if (pointsToExpire <= 0) continue;

      const balanceBefore = user.points.balance;
      const balanceAfter = Math.max(0, balanceBefore - pointsToExpire);

      // Create expiry transaction
      await LoyaltyTransaction.create({
        userId: user._id,
        type: 'expire',
        amount: -(balanceBefore - balanceAfter),
        source: 'expiry',
        sourceId: transaction._id,
        description: 'Points expired after 1 year',
        balanceBefore,
        balanceAfter,
      });

      // Update user balance
      user.points.balance = balanceAfter;
      await user.save();

      logger.info('Points expired', {
        userId: user._id.toString(),
        pointsExpired: balanceBefore - balanceAfter,
        balanceAfter,
      });
    }

    logger.info('Expired old points completed', {
      transactionsProcessed: expiredTransactions.length,
    });
  } catch (error) {
    logger.error('Failed to expire old points', { error });
    throw error;
  }
};

// ============================================================================
// EXPORT
// ============================================================================

export default {
  calculateEarnedPoints,
  calculateLoyaltyDiscount,
  awardPoints,
  redeemPoints,
  validatePointsRedemption,
  getLoyaltyBalance,
  getLoyaltyHistory,
  awardBonusPoints,
  expireOldPoints,
};

