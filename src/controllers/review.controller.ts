import { Request, Response } from 'express';
import * as reviewService from '../services/review.service';
import logger from '../utils/logger';
import { ValidationError } from '../utils/errors';

/**
 * Review Controller for AppZap Consumer API V2
 * Handles HTTP requests for reviews and ratings
 */

// ============================================================================
// GET REVIEWS
// ============================================================================

/**
 * @route   GET /api/v1/reviews
 * @desc    Get reviews for a store with rating statistics
 * @access  Public
 * @query   storeId (required), page, limit
 */
export const getStoreReviews = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { storeId, page = '1', limit = '10' } = req.query;

    if (!storeId) {
      throw new ValidationError('Store ID is required');
    }

    const result = await reviewService.getStoreReviews({
      storeId: storeId as string,
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Get store reviews failed', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_REVIEWS_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
        details: error.details,
      },
    });
  }
};

/**
 * @route   GET /api/v1/reviews/my-reviews
 * @desc    Get current user's reviews
 * @access  Private
 * @query   page, limit
 */
export const getMyReviews = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { page = '1', limit = '10' } = req.query;

    const result = await reviewService.getUserReviews({
      userId: req.user._id.toString(),
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Get my reviews failed', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_USER_REVIEWS_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
        details: error.details,
      },
    });
  }
};

/**
 * @route   GET /api/v1/reviews/:id
 * @desc    Get a single review by ID
 * @access  Public
 */
export const getReviewById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const review = await reviewService.getReviewById(id);

    res.status(200).json({
      success: true,
      data: review,
    });
  } catch (error: any) {
    logger.error('Get review by ID failed', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_REVIEW_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
        details: error.details,
      },
    });
  }
};

/**
 * @route   GET /api/v1/reviews/stats/:storeId
 * @desc    Get review statistics for a store
 * @access  Public
 */
export const getStoreReviewStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { storeId } = req.params;

    const stats = await reviewService.getStoreReviewStats(storeId);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    logger.error('Get store review stats failed', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_STATS_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
        details: error.details,
      },
    });
  }
};

// ============================================================================
// CREATE REVIEW
// ============================================================================

/**
 * @route   POST /api/v1/reviews
 * @desc    Create a new review and earn points
 * @access  Private
 * @body    storeId (required), star (required), comment, images, storeName, storeImage
 */
export const createReview = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { storeId, star, comment, images, storeName, storeImage } = req.body;

    // Validate required fields
    if (!storeId) {
      throw new ValidationError('Store ID is required');
    }

    if (!star) {
      throw new ValidationError('Star rating is required');
    }

    const result = await reviewService.createReview(req.user._id.toString(), {
      storeId,
      star,
      comment,
      images,
      storeName,
      storeImage,
    });

    res.status(201).json({
      success: true,
      message: `Review submitted successfully. You earned ${result.pointsAwarded} points!`,
      data: {
        review: result.review,
        pointsAwarded: result.pointsAwarded,
      },
    });
  } catch (error: any) {
    logger.error('Create review failed', {
      error: error.message,
      userId: req.user?._id,
    });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'CREATE_REVIEW_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
        details: error.details,
      },
    });
  }
};

// ============================================================================
// UPDATE REVIEW
// ============================================================================

/**
 * @route   PUT /api/v1/reviews/:id
 * @desc    Update an existing review
 * @access  Private (owner only)
 * @body    star, comment, images
 */
export const updateReview = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { id } = req.params;
    const { star, comment, images } = req.body;

    const review = await reviewService.updateReview(
      id,
      req.user._id.toString(),
      { star, comment, images }
    );

    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      data: review,
    });
  } catch (error: any) {
    logger.error('Update review failed', {
      error: error.message,
      reviewId: req.params.id,
      userId: req.user?._id,
    });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'UPDATE_REVIEW_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
        details: error.details,
      },
    });
  }
};

// ============================================================================
// DELETE REVIEW
// ============================================================================

/**
 * @route   DELETE /api/v1/reviews/:id
 * @desc    Delete a review
 * @access  Private (owner only)
 */
export const deleteReview = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { id } = req.params;

    await reviewService.deleteReview(id, req.user._id.toString());

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (error: any) {
    logger.error('Delete review failed', {
      error: error.message,
      reviewId: req.params.id,
      userId: req.user?._id,
    });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'DELETE_REVIEW_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
        details: error.details,
      },
    });
  }
};
