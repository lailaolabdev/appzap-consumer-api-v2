import { Router, Request, Response, NextFunction } from 'express';
import PublicEvent from '../models/PublicEvent';
import { authenticate } from '../middleware/auth.middleware';
import logger from '../utils/logger';

/**
 * Public Events Discovery Routes — Feature 11
 *
 * PUBLIC:
 *   GET /api/v1/discover/events   — published, non-expired events sorted by startDate ASC
 *
 * ADMIN:
 *   POST   /api/v1/discover/events/admin       — create event (isDraft=true by default)
 *   PUT    /api/v1/discover/events/admin/:id   — update event
 *   PATCH  /api/v1/discover/events/admin/:id/publish — toggle isDraft
 *   DELETE /api/v1/discover/events/admin/:id   — hard delete
 *   GET    /api/v1/discover/events/admin       — all events including drafts
 */

const router = Router();

// ── Public Consumer Feed ──────────────────────────────────────────────────────

/**
 * GET /api/v1/discover/events
 * Returns published, non-expired events sorted chronologically (soonest first).
 * MongoDB TTL index auto-purges documents 24h after endDate, but we also
 * apply an application-level filter for the 24h grace window.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const now = new Date();
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

        const events = await PublicEvent.find({
            isDraft: false,
            // Only events that haven't ended yet
            endDate: { $gte: now },
        })
            .sort({ startDate: 1 })    // soonest first
            .limit(limit)
            .select('-createdBy -__v')
            .lean();

        return res.json({
            success: true,
            count: events.length,
            data: events,
        });
    } catch (error) {
        return next(error);
    }
});

// ── Admin Routes ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/discover/events/admin
 * All events (including drafts) for the admin dashboard.
 */
router.get('/admin', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;
        const isDraftFilter = req.query.isDraft !== undefined
            ? req.query.isDraft === 'true'
            : undefined;

        const filter: Record<string, any> = {};
        if (isDraftFilter !== undefined) filter.isDraft = isDraftFilter;

        const [events, total] = await Promise.all([
            PublicEvent.find(filter)
                .sort({ startDate: 1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            PublicEvent.countDocuments(filter),
        ]);

        return res.json({
            success: true,
            data: events,
            pagination: {
                total,
                totalPages: Math.ceil(total / limit),
                currentPage: page,
                limit,
            },
        });
    } catch (error) {
        return next(error);
    }
});

/**
 * POST /api/v1/discover/events/admin
 * Create a new event (starts as draft unless isDraft: false explicitly sent).
 */
router.post('/admin', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const adminId = (req as any).user?.userId || 'unknown_admin';
        const {
            title, description, coverImage, latitude, longitude,
            locationName, restaurantId, restaurantName,
            startDate, endDate, isDraft, tags,
        } = req.body;

        // Validate required
        if (!title || !coverImage || !latitude || !longitude || !locationName || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                error: { code: 'MISSING_FIELDS', message: 'title, coverImage, latitude, longitude, locationName, startDate, endDate are required' },
            });
        }

        if (new Date(endDate) <= new Date(startDate)) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_DATES', message: 'endDate must be after startDate' },
            });
        }

        const event = await PublicEvent.create({
            title, description, coverImage,
            latitude, longitude, locationName,
            restaurantId, restaurantName,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            isDraft: isDraft !== false,   // default to draft
            tags: tags ?? [],
            createdBy: adminId,
        });

        logger.info(`[Events] Admin ${adminId} created event ${event._id}: ${event.title}`);

        return res.status(201).json({
            success: true,
            data: event,
        });
    } catch (error) {
        return next(error);
    }
});

/**
 * PUT /api/v1/discover/events/admin/:id
 * Full update of an event.
 */
router.put('/admin/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const event = await PublicEvent.findByIdAndUpdate(
            id,
            { $set: req.body },
            { new: true, runValidators: true }
        );

        if (!event) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } });
        }

        return res.json({ success: true, data: event });
    } catch (error) {
        return next(error);
    }
});

/**
 * PATCH /api/v1/discover/events/admin/:id/publish
 * Toggle isDraft. Body: { publish: boolean }
 */
router.patch('/admin/:id/publish', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { publish } = req.body;

        if (typeof publish !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_BODY', message: '`publish` must be a boolean' },
            });
        }

        const event = await PublicEvent.findByIdAndUpdate(
            id,
            { isDraft: !publish },
            { new: true }
        );

        if (!event) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } });
        }

        return res.json({
            success: true,
            message: publish ? 'Event published successfully' : 'Event moved to draft',
            data: { eventId: id, isDraft: event.isDraft },
        });
    } catch (error) {
        return next(error);
    }
});

/**
 * DELETE /api/v1/discover/events/admin/:id
 * Hard delete an event.
 */
router.delete('/admin/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const event = await PublicEvent.findByIdAndDelete(id);

        if (!event) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } });
        }

        return res.json({ success: true, message: 'Event deleted', data: { eventId: id } });
    } catch (error) {
        return next(error);
    }
});

export default router;
