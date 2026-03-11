import { Router, Request, Response, NextFunction } from 'express';
import { PromotionController } from '../controllers/promotion.controller';
import { optionalAuthenticate, authenticate } from '../middleware/auth.middleware';
import { Promotion } from '../models/Promotion';
import logger from '../utils/logger';

const router = Router();

/**
 * Public routes (authentication optional - improves tracking)
 */

// Consumer feed: admin-pinned first, then priority, then chrono
// GET /api/v1/promotions/feed?limit=20&type=percentage_off&isFlashSale=true
router.get('/feed', optionalAuthenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const now = new Date();
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
        const type = req.query.type as string | undefined;
        const isFlashSale = req.query.isFlashSale === 'true' ? true : req.query.isFlashSale === 'false' ? false : undefined;

        const query: any = {
            isActive: true,
            isApproved: true,
            startDate: { $lte: now },
            endDate: { $gte: now },
            $or: [
                { remainingQuantity: { $gt: 0 } },
                { remainingQuantity: { $exists: false } },
                { totalQuantity: { $exists: false } },
            ],
        };
        if (type) query.type = type;
        if (isFlashSale !== undefined) query.isFlashSale = isFlashSale;

        // Sort: pinned items first (adminPinOrder ASC), then priority DESC, then newest
        const promotions = await Promotion.find(query)
            .sort({ isPinnedByAdmin: -1, adminPinOrder: 1, priority: -1, createdAt: -1 })
            .limit(limit)
            .lean();

        return res.json({
            success: true,
            data: promotions,
            total: promotions.length,
        });
    } catch (error) {
        return next(error);
    }
});

// Get all active promotions
router.get('/', optionalAuthenticate, PromotionController.getPromotions);

// Get flash sales
router.get('/flash-sales', optionalAuthenticate, PromotionController.getFlashSales);

// Get promotion details
router.get('/:id', optionalAuthenticate, PromotionController.getPromotion);

// Record click (for analytics)
router.post('/:id/click', optionalAuthenticate, PromotionController.recordClick);

/**
 * Protected routes (authentication required)
 */

// Redeem a promotion
router.post('/:id/redeem', authenticate, PromotionController.redeemPromotion);

// Check eligibility
router.get('/:id/eligibility', authenticate, PromotionController.checkEligibility);

/**
 * Restaurant admin routes
 */

// Create promotion
router.post('/', authenticate, PromotionController.createPromotion);

// Update promotion
router.put('/:id', authenticate, PromotionController.updatePromotion);

// Deactivate promotion
router.delete('/:id', authenticate, PromotionController.deactivatePromotion);

/**
 * AppZap Admin routes — pin and approve controls
 */

/**
 * PATCH /api/v1/promotions/:id/pin
 * Body: { pin: boolean, pinOrder?: number }
 * Toggle admin pin. When pinned, moves promo to top of consumer feed.
 */
router.patch('/:id/pin', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { pin, pinOrder } = req.body;
        const adminId = (req as any).user?.userId || 'unknown_admin';

        if (typeof pin !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_BODY', message: '`pin` must be a boolean' },
            });
        }

        const promo = await Promotion.findByIdAndUpdate(
            id,
            {
                $set: {
                    isPinnedByAdmin: pin,
                    adminPinOrder: pin ? (pinOrder ?? 999) : 999,
                },
            },
            { new: true }
        );

        if (!promo) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Promotion not found' },
            });
        }

        logger.info(`Admin ${adminId} ${pin ? 'pinned' : 'unpinned'} promotion ${id}`);

        return res.json({
            success: true,
            message: pin ? 'Promotion pinned to top of feed' : 'Promotion unpinned',
            data: { promotionId: id, isPinnedByAdmin: promo.isPinnedByAdmin, adminPinOrder: promo.adminPinOrder },
        });
    } catch (error) {
        return next(error);
    }
});

/**
 * PATCH /api/v1/promotions/:id/approve
 * Body: { approve: boolean }
 * Toggle approval status. Only approved promos appear in the consumer feed.
 */
router.patch('/:id/approve', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { approve } = req.body;
        const adminId = (req as any).user?.userId || 'unknown_admin';

        if (typeof approve !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_BODY', message: '`approve` must be a boolean' },
            });
        }

        const promo = await Promotion.findByIdAndUpdate(
            id,
            { $set: { isApproved: approve } },
            { new: true }
        );

        if (!promo) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Promotion not found' },
            });
        }

        logger.info(`Admin ${adminId} ${approve ? 'approved' : 'rejected'} promotion ${id}`);

        return res.json({
            success: true,
            message: approve ? 'Promotion approved and visible in feed' : 'Promotion approval revoked',
            data: { promotionId: id, isApproved: promo.isApproved },
        });
    } catch (error) {
        return next(error);
    }
});

export default router;
