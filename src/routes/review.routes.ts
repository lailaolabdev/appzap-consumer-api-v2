import { Router, Request, Response, NextFunction } from 'express';
import * as reviewController from '../controllers/review.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { hideReview, adminDeleteReview, adminGetAllReviews } from '../services/review.service';
import logger from '../utils/logger';

/**
 * Review Routes for AppZap Consumer API V2
 *
 * PUBLIC:
 *   GET  /api/v1/reviews              - Get reviews for a store (isHidden excluded)
 *   GET  /api/v1/reviews/stats/:storeId - Review stats (hidden excluded from avg)
 *   GET  /api/v1/reviews/:id          - Single review
 *
 * AUTHENTICATED:
 *   GET  /api/v1/reviews/my-reviews   - Current user's reviews
 *   POST /api/v1/reviews              - Submit review (orderId duplicate guard)
 *   PUT  /api/v1/reviews/:id          - Update own review
 *   DELETE /api/v1/reviews/:id        - Delete own review
 *
 * ADMIN:
 *   GET    /api/v1/reviews/admin              - All reviews (including hidden) paginated
 *   PATCH  /api/v1/reviews/admin/:id/hide     - Toggle isHidden flag
 *   DELETE /api/v1/reviews/admin/:id          - Hard delete any review
 */

const router = Router();

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

/**
 * GET /api/v1/reviews?storeId=xxx&page=1&limit=10
 * Returns visible (isHidden: false) reviews only.
 */
router.get('/', reviewController.getStoreReviews);

/**
 * GET /api/v1/reviews/my-reviews
 * NOTE: Must be declared BEFORE /:id to prevent "my-reviews" matching as an ObjectId.
 */
router.get('/my-reviews', authenticate, reviewController.getMyReviews);

/**
 * GET /api/v1/reviews/stats/:storeId
 * Rating statistics (average, star distribution). Hidden reviews excluded.
 */
router.get('/stats/:storeId', reviewController.getStoreReviewStats);

// ============================================================================
// ADMIN ROUTES
// NOTE: /admin routes must also be declared BEFORE /:id to avoid ObjectId match.
// ============================================================================

/**
 * GET /api/v1/reviews/admin?page=1&limit=20&storeId=xxx&isHidden=true
 * Returns ALL reviews (including hidden) for admin moderation.
 */
router.get('/admin', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const storeId = req.query.storeId as string | undefined;
        const isHiddenParam = req.query.isHidden as string | undefined;
        const isHiddenFilter =
            isHiddenParam === 'true' ? true : isHiddenParam === 'false' ? false : undefined;
        const minStar = req.query.minStar ? parseInt(req.query.minStar as string) : undefined;
        const maxStar = req.query.maxStar ? parseInt(req.query.maxStar as string) : undefined;

        const result = await adminGetAllReviews({
            page,
            limit,
            storeId,
            isHidden: isHiddenFilter,
            minStar,
            maxStar,
        });

        return res.json({ success: true, ...result });
    } catch (error) {
        return next(error);
    }
});

/**
 * PATCH /api/v1/reviews/admin/:id/hide
 * Body: { hide: boolean }
 * Toggles isHidden. Hidden reviews are removed from all public responses.
 */
router.patch(
    '/admin/:id/hide',
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const { hide } = req.body;
            const adminId = (req as any).user?.userId || 'unknown_admin';

            if (typeof hide !== 'boolean') {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_BODY', message: '`hide` must be a boolean' },
                });
            }

            const review = await hideReview(id, adminId, hide);

            logger.info(`Admin ${adminId} ${hide ? 'hid' : 'unhid'} review ${id}`);

            return res.json({
                success: true,
                message: hide ? 'Review hidden from public feed' : 'Review restored to public feed',
                data: { reviewId: id, isHidden: review.isHidden },
            });
        } catch (error) {
            return next(error);
        }
    }
);

/**
 * DELETE /api/v1/reviews/admin/:id
 * Hard delete any review regardless of ownership. Admin only.
 */
router.delete(
    '/admin/:id',
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const adminId = (req as any).user?.userId || 'unknown_admin';

            await adminDeleteReview(id, adminId);

            return res.json({
                success: true,
                message: 'Review permanently deleted',
                data: { reviewId: id },
            });
        } catch (error) {
            return next(error);
        }
    }
);

// ============================================================================
// SINGLE REVIEW — must come after named routes like /admin, /stats, /my-reviews
// ============================================================================

/**
 * GET /api/v1/reviews/:id
 */
router.get('/:id', reviewController.getReviewById);

// ============================================================================
// AUTHENTICATED USER ROUTES
// ============================================================================

/**
 * POST /api/v1/reviews
 * Body: { storeId, star, comment?, images?, orderId? }
 * orderId enables the duplicate-review-per-order guard.
 */
router.post('/', authenticate, reviewController.createReview);

/**
 * PUT /api/v1/reviews/:id — edit own review
 */
router.put('/:id', authenticate, reviewController.updateReview);

/**
 * DELETE /api/v1/reviews/:id — delete own review
 */
router.delete('/:id', authenticate, reviewController.deleteReview);

export default router;
