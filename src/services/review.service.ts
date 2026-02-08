import mongoose from 'mongoose';
import Review, { IReview, IReviewStats } from '../models/Review';
import User from '../models/User';
import LoyaltyTransaction from '../models/LoyaltyTransaction';
import logger from '../utils/logger';
import {
  NotFoundError,
  ValidationError,
  BusinessLogicError,
  AuthorizationError,
} from '../utils/errors';

/**
 * Review Service for AppZap Consumer API V2
 * Handles review creation, retrieval, and rating statistics
 */

// ============================================================================
// CONSTANTS
// ============================================================================

// Points awarded for submitting a review (same as V1)
export const REVIEW_POINTS_REWARD = 3000;

// Points expiry: 1 year
export const POINTS_EXPIRY_DAYS = 365;

// Maximum images per review
export const MAX_REVIEW_IMAGES = 5;

// ============================================================================
// TYPES
// ============================================================================

export interface CreateReviewInput {
  storeId: string;
  storeName?: string;
  storeImage?: string;
  star: number;
  comment?: string;
  images?: string[];
}

export interface GetReviewsParams {
  storeId: string;
  page?: number;
  limit?: number;
}

export interface GetReviewsResponse {
  reviews: IReview[];
  reviewRating: IReviewStats;
  pagination: {
    total: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
}

export interface GetUserReviewsParams {
  userId: string;
  page?: number;
  limit?: number;
}

// ============================================================================
// CREATE REVIEW
// ============================================================================

/**
 * Create a new review for a store
 * Awards loyalty points to the user
 */
export const createReview = async (
  userId: string,
  input: CreateReviewInput
): Promise<{ review: IReview; pointsAwarded: number }> => {
  try {
    // Validate star rating
    if (!input.star || input.star < 1 || input.star > 5) {
      throw new ValidationError('Star rating must be between 1 and 5');
    }

    // Validate images count
    if (input.images && input.images.length > MAX_REVIEW_IMAGES) {
      throw new ValidationError(
        `Cannot upload more than ${MAX_REVIEW_IMAGES} images per review`
      );
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    // Check for daily review limit (one review per store per day per user)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingReview = await Review.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      storeId: new mongoose.Types.ObjectId(input.storeId),
      createdAt: { $gte: today, $lt: tomorrow },
    });

    if (existingReview) {
      throw new BusinessLogicError(
        'You can only review each store once per day',
        'REVIEW_LIMIT_EXCEEDED',
        { nextReviewAvailable: tomorrow }
      );
    }

    // Create the review
    const review = await Review.create({
      storeId: new mongoose.Types.ObjectId(input.storeId),
      storeName: input.storeName,
      storeImage: input.storeImage,
      star: input.star,
      comment: input.comment,
      images: input.images || [],
      userId: new mongoose.Types.ObjectId(userId),
      userName: user.fullName,
      userPhone: user.phone,
      userImage: user.image,
      pointsAwarded: REVIEW_POINTS_REWARD,
      isVerifiedPurchase: false, // TODO: Check if user has ordered from this store
    });

    // Award loyalty points
    await awardReviewPoints(userId, review._id.toString(), input.storeName || 'store');

    logger.info('Review created', {
      reviewId: review._id,
      userId,
      storeId: input.storeId,
      star: input.star,
      pointsAwarded: REVIEW_POINTS_REWARD,
    });

    return {
      review,
      pointsAwarded: REVIEW_POINTS_REWARD,
    };
  } catch (error) {
    logger.error('Failed to create review', { userId, input, error });
    throw error;
  }
};

// ============================================================================
// GET REVIEWS
// ============================================================================

/**
 * Get reviews for a store with rating statistics
 */
export const getStoreReviews = async (
  params: GetReviewsParams
): Promise<GetReviewsResponse> => {
  try {
    const { storeId, page = 1, limit = 10 } = params;

    if (!storeId) {
      throw new ValidationError('Store ID is required');
    }

    const skip = (page - 1) * limit;

    // Fetch reviews with pagination and stats in parallel
    const [reviews, stats] = await Promise.all([
      Review.find({ storeId: new mongoose.Types.ObjectId(storeId) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.getStoreStats(storeId),
    ]);

    return {
      reviews: reviews as unknown as IReview[],
      reviewRating: stats,
      pagination: {
        total: stats.totalReviews,
        totalPages: Math.ceil(stats.totalReviews / limit),
        currentPage: page,
        limit,
      },
    };
  } catch (error) {
    logger.error('Failed to get store reviews', { params, error });
    throw error;
  }
};

/**
 * Get reviews submitted by a user
 */
export const getUserReviews = async (
  params: GetUserReviewsParams
): Promise<{ reviews: IReview[]; pagination: any }> => {
  try {
    const { userId, page = 1, limit = 10 } = params;

    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      Review.find({ userId: new mongoose.Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments({ userId: new mongoose.Types.ObjectId(userId) }),
    ]);

    return {
      reviews: reviews as unknown as IReview[],
      pagination: {
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        limit,
      },
    };
  } catch (error) {
    logger.error('Failed to get user reviews', { params, error });
    throw error;
  }
};

/**
 * Get a single review by ID
 */
export const getReviewById = async (reviewId: string): Promise<IReview> => {
  try {
    const review = await Review.findById(reviewId).lean();

    if (!review) {
      throw new NotFoundError('Review', reviewId);
    }

    return review as unknown as IReview;
  } catch (error) {
    logger.error('Failed to get review', { reviewId, error });
    throw error;
  }
};

// ============================================================================
// UPDATE REVIEW
// ============================================================================

/**
 * Update an existing review
 * Only the review owner can update their review
 */
export const updateReview = async (
  reviewId: string,
  userId: string,
  updates: { star?: number; comment?: string; images?: string[] }
): Promise<IReview> => {
  try {
    const review = await Review.findById(reviewId);

    if (!review) {
      throw new NotFoundError('Review', reviewId);
    }

    // Check ownership
    if (review.userId.toString() !== userId) {
      throw new AuthorizationError(
        'Not authorized to update this review',
        'NOT_REVIEW_OWNER'
      );
    }

    // Validate star rating if provided
    if (updates.star !== undefined && (updates.star < 1 || updates.star > 5)) {
      throw new ValidationError('Star rating must be between 1 and 5');
    }

    // Validate images count
    if (updates.images && updates.images.length > MAX_REVIEW_IMAGES) {
      throw new ValidationError(
        `Cannot upload more than ${MAX_REVIEW_IMAGES} images per review`
      );
    }

    // Apply updates
    if (updates.star !== undefined) review.star = updates.star;
    if (updates.comment !== undefined) review.comment = updates.comment;
    if (updates.images !== undefined) review.images = updates.images;

    await review.save();

    logger.info('Review updated', { reviewId, userId, updates });

    return review;
  } catch (error) {
    logger.error('Failed to update review', { reviewId, userId, error });
    throw error;
  }
};

// ============================================================================
// DELETE REVIEW
// ============================================================================

/**
 * Delete a review
 * Only the review owner can delete their review
 */
export const deleteReview = async (
  reviewId: string,
  userId: string
): Promise<void> => {
  try {
    const review = await Review.findById(reviewId);

    if (!review) {
      throw new NotFoundError('Review', reviewId);
    }

    // Check ownership
    if (review.userId.toString() !== userId) {
      throw new AuthorizationError(
        'Not authorized to delete this review',
        'NOT_REVIEW_OWNER'
      );
    }

    await Review.findByIdAndDelete(reviewId);

    logger.info('Review deleted', { reviewId, userId });
  } catch (error) {
    logger.error('Failed to delete review', { reviewId, userId, error });
    throw error;
  }
};

// ============================================================================
// LOYALTY POINTS INTEGRATION
// ============================================================================

/**
 * Award loyalty points for submitting a review
 */
const awardReviewPoints = async (
  userId: string,
  reviewId: string,
  storeName: string
): Promise<void> => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      logger.error('User not found for awarding review points', { userId });
      return;
    }

    const balanceBefore = user.points.balance;
    const balanceAfter = balanceBefore + REVIEW_POINTS_REWARD;

    // Create loyalty transaction
    await LoyaltyTransaction.create({
      userId: user._id,
      type: 'earn',
      amount: REVIEW_POINTS_REWARD,
      source: 'review' as any, // Will need to update LoyaltyTransaction enum
      sourceId: reviewId,
      description: `Points earned for reviewing ${storeName}`,
      balanceBefore,
      balanceAfter,
      expiresAt: new Date(Date.now() + POINTS_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    });

    // Update user points
    user.points.balance = balanceAfter;
    user.points.totalEarned += REVIEW_POINTS_REWARD;
    await user.save();

    logger.info('Review points awarded', {
      userId,
      reviewId,
      points: REVIEW_POINTS_REWARD,
      balanceAfter,
    });
  } catch (error) {
    logger.error('Failed to award review points', { userId, reviewId, error });
    // Don't throw - review was still created successfully
  }
};

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get aggregated review statistics for a store
 */
export const getStoreReviewStats = async (
  storeId: string
): Promise<IReviewStats> => {
  try {
    return await Review.getStoreStats(storeId);
  } catch (error) {
    logger.error('Failed to get store review stats', { storeId, error });
    throw error;
  }
};

// ============================================================================
// EXPORT
// ============================================================================

export default {
  createReview,
  getStoreReviews,
  getUserReviews,
  getReviewById,
  updateReview,
  deleteReview,
  getStoreReviewStats,
  REVIEW_POINTS_REWARD,
};
