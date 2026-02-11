/**
 * Activity Routes
 * API endpoints for activities and events discovery
 */

import { Router, Request, Response } from 'express';
import activityService from '../services/activity.service';
import { authenticate } from '../middleware/auth.middleware';
import logger from '../utils/logger';
import { ActivityCategory, EventType } from '../models/Activity';

const router = Router();

/**
 * GET /api/v1/activities
 * Get all activities with optional filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      q,
      category,
      province,
      landmark,
      eventType,
      free,
      featured,
      audience,
      difficulty,
      startDate,
      endDate,
      lat,
      lng,
      maxDistance,
      skip,
      limit,
      sortBy,
    } = req.query;

    const result = await activityService.getActivities({
      query: q as string,
      category: category as ActivityCategory,
      province: province as string,
      landmarkId: landmark as string,
      eventType: eventType as EventType,
      isFree: free === 'true' ? true : free === 'false' ? false : undefined,
      isFeatured: featured === 'true' ? true : featured === 'false' ? false : undefined,
      targetAudience: audience as string,
      difficulty: difficulty as 'easy' | 'moderate' | 'challenging',
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      lat: lat ? parseFloat(lat as string) : undefined,
      lng: lng ? parseFloat(lng as string) : undefined,
      maxDistance: maxDistance ? parseInt(maxDistance as string) : undefined,
      skip: skip ? parseInt(skip as string) : 0,
      limit: limit ? parseInt(limit as string) : 20,
      sortBy: sortBy as 'date' | 'rating' | 'popularity' | 'price',
    });

    return res.json({
      success: true,
      data: result.activities,
      total: result.total,
      hasMore: result.hasMore,
    });
  } catch (error) {
    logger.error('[ActivityRoutes] Error getting activities:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get activities',
    });
  }
});

/**
 * GET /api/v1/activities/upcoming
 * Get upcoming events
 */
router.get('/upcoming', async (req: Request, res: Response) => {
  try {
    const { province, category, limit, days } = req.query;

    const activities = await activityService.getUpcomingActivities({
      province: province as string,
      category: category as string,
      limit: limit ? parseInt(limit as string) : 10,
      daysAhead: days ? parseInt(days as string) : 30,
    });

    return res.json({
      success: true,
      data: activities,
    });
  } catch (error) {
    logger.error('[ActivityRoutes] Error getting upcoming activities:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get upcoming activities',
    });
  }
});

/**
 * GET /api/v1/activities/featured
 * Get featured activities
 */
router.get('/featured', async (req: Request, res: Response) => {
  try {
    const { province, limit } = req.query;

    const activities = await activityService.getFeaturedActivities({
      province: province as string,
      limit: limit ? parseInt(limit as string) : 10,
    });

    return res.json({
      success: true,
      data: activities,
    });
  } catch (error) {
    logger.error('[ActivityRoutes] Error getting featured activities:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get featured activities',
    });
  }
});

/**
 * GET /api/v1/activities/search
 * Search activities
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, limit } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query (q) is required',
      });
    }

    const activities = await activityService.searchActivities(
      q as string,
      limit ? parseInt(limit as string) : 10
    );

    return res.json({
      success: true,
      data: activities,
    });
  } catch (error) {
    logger.error('[ActivityRoutes] Error searching activities:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to search activities',
    });
  }
});

/**
 * GET /api/v1/activities/categories
 * Get all categories with counts
 */
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const categories = await activityService.getCategories();

    return res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    logger.error('[ActivityRoutes] Error getting categories:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get categories',
    });
  }
});

/**
 * GET /api/v1/activities/by-category/:category
 * Get activities by category
 */
router.get('/by-category/:category', async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const { limit } = req.query;

    const activities = await activityService.getActivitiesByCategory(
      category as ActivityCategory,
      limit ? parseInt(limit as string) : 20
    );

    return res.json({
      success: true,
      data: activities,
    });
  } catch (error) {
    logger.error('[ActivityRoutes] Error getting activities by category:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get activities',
    });
  }
});

/**
 * GET /api/v1/activities/near-landmark/:landmarkId
 * Get activities near a landmark
 */
router.get('/near-landmark/:landmarkId', async (req: Request, res: Response) => {
  try {
    const { landmarkId } = req.params;
    const { limit } = req.query;

    const activities = await activityService.getActivitiesNearLandmark(
      landmarkId,
      limit ? parseInt(limit as string) : 10
    );

    return res.json({
      success: true,
      data: activities,
    });
  } catch (error) {
    logger.error('[ActivityRoutes] Error getting activities near landmark:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get activities near landmark',
    });
  }
});

/**
 * GET /api/v1/activities/:id
 * Get activity details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const activity = await activityService.getActivityById(id);

    if (!activity) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found',
      });
    }

    return res.json({
      success: true,
      data: activity,
    });
  } catch (error) {
    logger.error('[ActivityRoutes] Error getting activity:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get activity',
    });
  }
});

/**
 * POST /api/v1/activities/:id/save
 * Save/bookmark activity
 */
router.post('/:id/save', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await activityService.saveActivity(id);

    return res.json({
      success: true,
      message: 'Activity saved',
    });
  } catch (error) {
    logger.error('[ActivityRoutes] Error saving activity:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to save activity',
    });
  }
});

// ============================================
// ADMIN ROUTES (Protected)
// ============================================

/**
 * POST /api/v1/activities
 * Create a new activity (Admin)
 */
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const activity = await activityService.createActivity(req.body);

    return res.status(201).json({
      success: true,
      data: activity,
      message: 'Activity created successfully',
    });
  } catch (error) {
    logger.error('[ActivityRoutes] Error creating activity:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create activity',
    });
  }
});

/**
 * PUT /api/v1/activities/:id
 * Update an activity (Admin)
 */
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const activity = await activityService.updateActivity(id, req.body);

    if (!activity) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found',
      });
    }

    return res.json({
      success: true,
      data: activity,
      message: 'Activity updated successfully',
    });
  } catch (error) {
    logger.error('[ActivityRoutes] Error updating activity:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update activity',
    });
  }
});

/**
 * PATCH /api/v1/activities/:id/status
 * Change activity status (Admin)
 */
router.patch('/:id/status', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive', 'upcoming', 'ended', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
      });
    }

    const success = await activityService.updateActivityStatus(id, status);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found',
      });
    }

    return res.json({
      success: true,
      message: `Activity status updated to ${status}`,
    });
  } catch (error) {
    logger.error('[ActivityRoutes] Error updating activity status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update activity status',
    });
  }
});

export default router;
