import { Request, Response } from 'express';
import * as spinToWinService from '../services/spinToWin.service';
import logger from '../utils/logger';
import { ValidationError, NotFoundError } from '../utils/errors';

// ============================================================================
// SPIN TO WIN
// ============================================================================

/**
 * Execute Spin
 * POST /api/v1/spin-to-win/:rewardId/spin
 */
export const executeSpin = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { rewardId } = req.params;

    const result = await spinToWinService.executeSpin({
      userId: req.user._id.toString(),
      rewardId,
    });

    res.json({
      success: true,
      message: `🎉 Congratulations! You won: ${result.reward.title}`,
      reward: result.reward,
    });
  } catch (error: any) {
    logger.error('Failed to execute spin', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'SPIN_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Get User Rewards
 * GET /api/v1/spin-to-win/rewards
 */
export const getUserRewards = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { includeExpired } = req.query;

    const rewards = await spinToWinService.getUserRewards({
      userId: req.user._id.toString(),
      includeExpired: includeExpired === 'true',
    });

    res.json({
      data: rewards,
      total: rewards.length,
    });
  } catch (error: any) {
    logger.error('Failed to get user rewards', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_REWARDS_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Redeem Reward
 * POST /api/v1/spin-to-win/:rewardId/redeem
 */
export const redeemReward = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { rewardId } = req.params;
    const { orderId } = req.body;

    const result = await spinToWinService.redeemReward({
      userId: req.user._id.toString(),
      rewardId,
      orderId,
    });

    res.json({
      success: true,
      message: 'Reward redeemed successfully!',
      redemption: result,
    });
  } catch (error: any) {
    logger.error('Failed to redeem reward', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'REDEEM_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Get Reward Statistics
 * GET /api/v1/spin-to-win/statistics
 */
export const getStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { startDate, endDate } = req.query;

    const stats = await spinToWinService.getRewardStatistics({
      userId: req.user._id.toString(),
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json(stats);
  } catch (error: any) {
    logger.error('Failed to get statistics', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_STATISTICS_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

export default {
  executeSpin,
  getUserRewards,
  redeemReward,
  getStatistics,
};


