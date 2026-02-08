import { Router } from 'express';
import * as reviewController from '../controllers/review.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';

/**
 * Review Routes for AppZap Consumer API V2
 *
 * Endpoints:
 * - GET  /api/v1/reviews              - Get reviews for a store (public)
 * - GET  /api/v1/reviews/my-reviews   - Get current user's reviews (auth)
 * - GET  /api/v1/reviews/stats/:storeId - Get store review statistics (public)
 * - GET  /api/v1/reviews/:id          - Get a single review (public)
 * - POST /api/v1/reviews              - Create a review (auth, earns points)
 * - PUT  /api/v1/reviews/:id          - Update a review (auth, owner only)
 * - DELETE /api/v1/reviews/:id        - Delete a review (auth, owner only)
 */

const router = Router();

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

/**
 * @route   GET /api/v1/reviews
 * @desc    Get reviews for a store with rating statistics
 * @access  Public
 * @query   storeId (required) - The store ID to get reviews for
 * @query   page (optional) - Page number (default: 1)
 * @query   limit (optional) - Items per page (default: 10)
 */
router.get('/', reviewController.getStoreReviews);

/**
 * @route   GET /api/v1/reviews/my-reviews
 * @desc    Get the current user's submitted reviews
 * @access  Private
 * @query   page (optional) - Page number (default: 1)
 * @query   limit (optional) - Items per page (default: 10)
 * @note    This route MUST be defined before /:id to avoid matching "my-reviews" as an ID
 */
router.get('/my-reviews', authenticate, reviewController.getMyReviews);

/**
 * @route   GET /api/v1/reviews/stats/:storeId
 * @desc    Get review statistics for a store (average rating, star counts)
 * @access  Public
 */
router.get('/stats/:storeId', reviewController.getStoreReviewStats);

/**
 * @route   GET /api/v1/reviews/:id
 * @desc    Get a single review by ID
 * @access  Public
 */
router.get('/:id', reviewController.getReviewById);

// ============================================================================
// AUTHENTICATED ROUTES
// ============================================================================

/**
 * @route   POST /api/v1/reviews
 * @desc    Create a new review for a store (awards loyalty points)
 * @access  Private
 * @body    storeId (required) - The store ID to review
 * @body    star (required) - Star rating (1-5)
 * @body    comment (optional) - Review comment
 * @body    images (optional) - Array of image URLs (max 5)
 * @body    storeName (optional) - Store name for denormalization
 * @body    storeImage (optional) - Store image for denormalization
 */
router.post('/', authenticate, reviewController.createReview);

/**
 * @route   PUT /api/v1/reviews/:id
 * @desc    Update an existing review (owner only)
 * @access  Private
 * @body    star (optional) - Star rating (1-5)
 * @body    comment (optional) - Review comment
 * @body    images (optional) - Array of image URLs (max 5)
 */
router.put('/:id', authenticate, reviewController.updateReview);

/**
 * @route   DELETE /api/v1/reviews/:id
 * @desc    Delete a review (owner only)
 * @access  Private
 */
router.delete('/:id', authenticate, reviewController.deleteReview);

export default router;
