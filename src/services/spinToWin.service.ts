import PromotionalReward from '../models/PromotionalReward';
import * as loyaltyService from './loyalty.service';
import logger from '../utils/logger';
import { codeGenerators } from '../utils/helpers';

/**
 * Spin to Win Service
 * Manages promotional rewards and gamification
 */

// ============================================================================
// REWARD CONFIGURATION
// ============================================================================

interface RewardConfig {
  type: 'beer' | 'discount' | 'points' | 'voucher' | 'free_item' | 'cashback';
  value: number;
  title: string;
  description: string;
  probability: number; // 0-100
  imageUrl?: string;
}

const REWARD_CONFIGS: RewardConfig[] = [
  {
    type: 'beer',
    value: 1,
    title: 'FREE Beer!',
    description: 'Get 1 FREE beer on your next restaurant order',
    probability: 15,
    imageUrl: '/assets/rewards/beer.png',
  },
  {
    type: 'discount',
    value: 20000,
    title: '20,000 LAK Discount',
    description: 'Get 20,000 LAK off your next order',
    probability: 10,
    imageUrl: '/assets/rewards/discount-20k.png',
  },
  {
    type: 'discount',
    value: 10000,
    title: '10,000 LAK Discount',
    description: 'Get 10,000 LAK off your next order',
    probability: 20,
    imageUrl: '/assets/rewards/discount-10k.png',
  },
  {
    type: 'points',
    value: 500,
    title: '500 Loyalty Points',
    description: 'Get 500 bonus loyalty points',
    probability: 25,
    imageUrl: '/assets/rewards/points-500.png',
  },
  {
    type: 'points',
    value: 200,
    title: '200 Loyalty Points',
    description: 'Get 200 bonus loyalty points',
    probability: 30,
    imageUrl: '/assets/rewards/points-200.png',
  },
];

// ============================================================================
// SPIN TO WIN
// ============================================================================

/**
 * Create spin reward for order (called when order is placed)
 */
export const createSpinRewardForOrder = async (params: {
  userId: string;
  orderId: string;
  source: 'web_order' | 'first_app_order';
  deepLinkId?: string;
}): Promise<any> => {
  try {
    // Create a pending spin reward (not yet spun)
    const reward = await PromotionalReward.create({
      userId: params.userId,
      orderId: params.orderId,
      rewardType: 'points', // Placeholder, will be determined on spin
      rewardValue: 0,
      rewardTitle: 'Spin the Wheel!',
      rewardDescription: 'Spin to win FREE rewards!',
      gameType: 'spin_wheel',
      spinCount: 1,
      isWon: false,
      isRedeemed: false,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      source: params.source,
      deepLinkId: params.deepLinkId,
    });

    logger.info('Spin reward created for order', {
      userId: params.userId,
      orderId: params.orderId,
      rewardId: reward._id,
    });

    return {
      rewardId: reward._id,
      spinCount: reward.spinCount,
      expiresAt: reward.expiresAt,
    };
  } catch (error: any) {
    logger.error('Failed to create spin reward', { error: error.message, params });
    throw error;
  }
};

/**
 * Execute spin and determine reward
 */
export const executeSpin = async (params: {
  userId: string;
  rewardId: string;
}): Promise<any> => {
  try {
    const reward = await PromotionalReward.findById(params.rewardId);

    if (!reward) {
      throw new Error('Reward not found');
    }

    if (reward.userId.toString() !== params.userId) {
      throw new Error('Reward does not belong to user');
    }

    if (reward.isWon) {
      throw new Error('Reward already claimed');
    }

    if (reward.spinCount <= 0) {
      throw new Error('No spins remaining');
    }

    if (reward.expiresAt < new Date()) {
      throw new Error('Reward has expired');
    }

    // Determine reward using weighted probability
    const wonReward = selectReward();

    // Update reward
    reward.rewardType = wonReward.type;
    reward.rewardValue = wonReward.value;
    reward.rewardTitle = wonReward.title;
    reward.rewardDescription = wonReward.description;
    reward.rewardImageUrl = wonReward.imageUrl;
    reward.isWon = true;
    reward.wonAt = new Date();
    reward.spinCount -= 1;
    reward.redemptionCode = codeGenerators.orderCode('REWARD');

    await reward.save();

    // Auto-apply points rewards immediately
    if (wonReward.type === 'points') {
      await loyaltyService.awardPoints(
        params.userId,
        wonReward.value,
        'spin_to_win',
        reward._id.toString(),
        `Spin to Win: ${wonReward.title}`
      );

      reward.isRedeemed = true;
      reward.redeemedAt = new Date();
      await reward.save();

      logger.info('Points reward auto-applied', {
        userId: params.userId,
        points: wonReward.value,
      });
    }

    logger.info('Spin executed successfully', {
      userId: params.userId,
      rewardId: reward._id,
      wonReward: wonReward.title,
    });

    return {
      success: true,
      reward: {
        id: reward._id,
        type: reward.rewardType,
        value: reward.rewardValue,
        title: reward.rewardTitle,
        description: reward.rewardDescription,
        imageUrl: reward.rewardImageUrl,
        redemptionCode: reward.redemptionCode,
        isRedeemed: reward.isRedeemed,
        expiresAt: reward.expiresAt,
      },
    };
  } catch (error: any) {
    logger.error('Failed to execute spin', { error: error.message, params });
    throw error;
  }
};

/**
 * Select reward based on probability
 */
const selectReward = (): RewardConfig => {
  const random = Math.random() * 100;
  let cumulative = 0;

  for (const config of REWARD_CONFIGS) {
    cumulative += config.probability;
    if (random <= cumulative) {
      return config;
    }
  }

  // Fallback to last reward
  return REWARD_CONFIGS[REWARD_CONFIGS.length - 1];
};

// ============================================================================
// REWARD MANAGEMENT
// ============================================================================

/**
 * Get user's available rewards
 */
export const getUserRewards = async (params: {
  userId: string;
  includeExpired?: boolean;
}): Promise<any[]> => {
  const query: any = {
    userId: params.userId,
  };

  if (!params.includeExpired) {
    query.expiresAt = { $gte: new Date() };
  }

  const rewards = await PromotionalReward.find(query)
    .sort({ createdAt: -1 })
    .lean();

  return rewards;
};

/**
 * Redeem reward
 */
export const redeemReward = async (params: {
  userId: string;
  rewardId: string;
  orderId?: string;
}): Promise<any> => {
  try {
    const reward = await PromotionalReward.findById(params.rewardId);

    if (!reward) {
      throw new Error('Reward not found');
    }

    if (reward.userId.toString() !== params.userId) {
      throw new Error('Reward does not belong to user');
    }

    if (!reward.isWon) {
      throw new Error('Reward not won yet. Please spin first.');
    }

    await reward.redeem();

    logger.info('Reward redeemed', {
      userId: params.userId,
      rewardId: reward._id,
      rewardType: reward.rewardType,
      orderId: params.orderId,
    });

    return {
      success: true,
      redemptionCode: reward.redemptionCode,
      rewardType: reward.rewardType,
      rewardValue: reward.rewardValue,
    };
  } catch (error: any) {
    logger.error('Failed to redeem reward', { error: error.message, params });
    throw error;
  }
};

/**
 * Get reward statistics
 */
export const getRewardStatistics = async (params: {
  userId?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<any> => {
  const query: any = {};

  if (params.userId) query.userId = params.userId;
  if (params.startDate || params.endDate) {
    query.createdAt = {};
    if (params.startDate) query.createdAt.$gte = params.startDate;
    if (params.endDate) query.createdAt.$lte = params.endDate;
  }

  const rewards = await PromotionalReward.find(query);

  const stats = {
    totalRewards: rewards.length,
    totalSpins: rewards.reduce((sum, r) => sum + (r.isWon ? 1 : 0), 0),
    totalWins: rewards.filter((r) => r.isWon).length,
    totalRedeemed: rewards.filter((r) => r.isRedeemed).length,
    byType: {} as Record<string, number>,
    bySource: {} as Record<string, number>,
    totalValue: 0,
  };

  rewards.forEach((r) => {
    if (r.isWon) {
      stats.byType[r.rewardType] = (stats.byType[r.rewardType] || 0) + 1;
      stats.bySource[r.source] = (stats.bySource[r.source] || 0) + 1;

      if (r.rewardType === 'discount' || r.rewardType === 'cashback') {
        stats.totalValue += r.rewardValue;
      }
    }
  });

  return stats;
};

// ============================================================================
// EXPORT
// ============================================================================

export default {
  createSpinRewardForOrder,
  executeSpin,
  getUserRewards,
  redeemReward,
  getRewardStatistics,
};

