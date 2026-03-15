import { Router, Request, Response, NextFunction } from 'express';
import Advertisement from '../models/Advertisement';
import logger from '../utils/logger';

/**
 * Ad Delivery & Lightweight Tracking Routes — Feature 10
 *
 * These are purpose-built aliases alongside the existing /ads routes:
 *
 *  GET  /api/v1/ads/delivery?zone=HOME_CAROUSEL   — returns active campaigns for a UI zone
 *  POST /api/v1/ads/track                         — fire-and-forget impression/click ping
 *
 * The /track endpoint is designed to be sub-2ms. It performs an atomic
 * $inc update directly on MongoDB (Redis would require infrastructure changes;
 * atomic $inc is safe against lock contention at AppZap's traffic scale).
 * For extremely high volume, the strategy would switch to a Redis LPUSH queue
 * drained by a cron worker — the MongoDB $inc approach is production-safe here.
 */

const router: Router = Router();

/**
 * GET /api/v1/ads/delivery?zone=HOME_CAROUSEL
 *
 * Returns up to [limit] active, approved campaigns for the specified zone.
 * Zone values map onto AdPlacement enums from the Advertisement model:
 *   HOME_CAROUSEL      → eat_hero_banner / home_top
 *   INTERSTITIAL       → between_sections
 *   SEARCH_SPONSOR     → search_results
 *   EAT_BETWEEN        → eat_between_listings
 */
router.get('/delivery', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { zone, limit = '5', device } = req.query;

        if (!zone) {
            return res.status(400).json({
                success: false,
                error: { code: 'MISSING_ZONE', message: '`zone` query parameter is required' },
            });
        }

        // Map feature-doc zone names → internal AdPlacement values
        const zoneToPlacement: Record<string, string[]> = {
            HOME_CAROUSEL: ['home_top', 'eat_hero_banner', 'home_featured_deal'],
            INTERSTITIAL: ['between_sections', 'app_open'],
            SEARCH_SPONSOR: ['search_results'],
            EAT_BETWEEN: ['eat_between_listings'],
            HOME_BOTTOM: ['home_bottom', 'home_middle'],
            CATEGORY: ['category_page'],
        };

        const placements = zoneToPlacement[(zone as string).toUpperCase()] ?? [(zone as string)];
        const now = new Date();

        const ads = await Advertisement.find({
            status: { $in: ['active', 'approved'] },
            placement: { $in: placements },
            'schedule.startDate': { $lte: now },
            'schedule.endDate': { $gte: now },
            // Respect device targeting if provided
            ...(device ? {
                $or: [
                    { 'targeting.devices': { $size: 0 } },
                    { 'targeting.devices': { $exists: false } },
                    { 'targeting.devices': device as string },
                ]
            } : {}),
        })
            .sort({ priority: -1, weight: -1 })
            .limit(parseInt(limit as string, 10))
            .select('name type placement content schedule stats priority linkedEntityId linkedEntityType')
            .lean();

        return res.json({
            success: true,
            zone: zone,
            count: ads.length,
            data: ads.map((ad) => ({
                id: ad._id,
                type: ad.type,
                placement: ad.placement,
                imageUrl: ad.content.imageUrl,
                imageUrlMobile: ad.content.imageUrlMobile,
                title: ad.content.title,
                subtitle: ad.content.subtitle,
                ctaText: ad.content.ctaText,
                ctaUrl: ad.content.ctaUrl,
                linkedEntityId: ad.linkedEntityId,
                linkedEntityType: ad.linkedEntityType,
            })),
        });
    } catch (error) {
        return next(error);
    }
});

/**
 * POST /api/v1/ads/track
 * Body: { adId, eventType: 'impression' | 'click', sessionId?, userId? }
 *
 * Fire-and-forget tracking. Returns 204 immediately.
 * Uses atomic $inc to avoid dirty-reads from parallel requests.
 */
router.post('/track', async (req: Request, res: Response) => {
    // Respond immediately — tracking must never slow the app
    res.status(204).send();

    // Process asynchronously after response is sent
    setImmediate(async () => {
        try {
            const { adId, eventType } = req.body;
            if (!adId || !['impression', 'click'].includes(eventType)) return;

            if (eventType === 'impression') {
                await Advertisement.updateOne(
                    { _id: adId },
                    {
                        $inc: { 'stats.impressions': 1 },
                        $set: {
                            'stats.ctr': {
                                $cond: [
                                    { $gt: ['$stats.impressions', 0] },
                                    { $multiply: [{ $divide: ['$stats.clicks', { $add: ['$stats.impressions', 1] }] }, 100] },
                                    0
                                ]
                            }
                        }
                    }
                );
            } else if (eventType === 'click') {
                await Advertisement.updateOne(
                    { _id: adId },
                    { $inc: { 'stats.clicks': 1 } }
                );
            }
        } catch (err) {
            logger.warn('[AdTrack] Background tracking failed', { err });
        }
    });
});

export default router;
