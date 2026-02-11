/**
 * Landmark Routes
 * API endpoints for landmark discovery and search
 */

import { Router, Request, Response } from 'express';
import landmarkService from '../services/landmark.service';
import { authenticate } from '../middleware/auth.middleware';
import logger from '../utils/logger';
import { LandmarkType } from '../models/Landmark';

const router = Router();

/**
 * GET /api/v1/landmarks
 * Get all landmarks with optional filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      q,
      type,
      province,
      popular,
      lat,
      lng,
      maxDistance,
      skip,
      limit,
    } = req.query;

    const result = await landmarkService.getLandmarks({
      query: q as string,
      type: type as LandmarkType,
      province: province as string,
      isPopular: popular === 'true' ? true : popular === 'false' ? false : undefined,
      lat: lat ? parseFloat(lat as string) : undefined,
      lng: lng ? parseFloat(lng as string) : undefined,
      maxDistance: maxDistance ? parseInt(maxDistance as string) : undefined,
      skip: skip ? parseInt(skip as string) : 0,
      limit: limit ? parseInt(limit as string) : 20,
    });

    return res.json({
      success: true,
      data: result.landmarks,
      total: result.total,
      hasMore: result.hasMore,
    });
  } catch (error) {
    logger.error('[LandmarkRoutes] Error getting landmarks:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get landmarks',
    });
  }
});

/**
 * GET /api/v1/landmarks/popular
 * Get popular landmarks for quick selection
 */
router.get('/popular', async (req: Request, res: Response) => {
  try {
    const { province, limit } = req.query;

    const landmarks = await landmarkService.getPopularLandmarks({
      province: province as string,
      limit: limit ? parseInt(limit as string) : 10,
    });

    return res.json({
      success: true,
      data: landmarks,
    });
  } catch (error) {
    logger.error('[LandmarkRoutes] Error getting popular landmarks:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get popular landmarks',
    });
  }
});

/**
 * GET /api/v1/landmarks/search
 * Search landmarks by keyword
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

    const landmarks = await landmarkService.searchLandmarks(
      q as string,
      limit ? parseInt(limit as string) : 10
    );

    return res.json({
      success: true,
      data: landmarks,
    });
  } catch (error) {
    logger.error('[LandmarkRoutes] Error searching landmarks:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to search landmarks',
    });
  }
});

/**
 * GET /api/v1/landmarks/types
 * Get all landmark types with counts
 */
router.get('/types', async (_req: Request, res: Response) => {
  try {
    const types = await landmarkService.getLandmarkTypes();

    return res.json({
      success: true,
      data: types,
    });
  } catch (error) {
    logger.error('[LandmarkRoutes] Error getting landmark types:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get landmark types',
    });
  }
});

/**
 * GET /api/v1/landmarks/provinces
 * Get all provinces with landmark counts
 */
router.get('/provinces', async (_req: Request, res: Response) => {
  try {
    const provinces = await landmarkService.getProvinces();

    return res.json({
      success: true,
      data: provinces,
    });
  } catch (error) {
    logger.error('[LandmarkRoutes] Error getting provinces:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get provinces',
    });
  }
});

/**
 * GET /api/v1/landmarks/nearby
 * Get landmarks near a location
 */
router.get('/nearby', async (req: Request, res: Response) => {
  try {
    const { lat, lng, maxDistance, limit } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'lat and lng are required',
      });
    }

    const landmarks = await landmarkService.getNearbyLandmarks(
      parseFloat(lng as string),
      parseFloat(lat as string),
      maxDistance ? parseInt(maxDistance as string) : 5000,
      limit ? parseInt(limit as string) : 10
    );

    return res.json({
      success: true,
      data: landmarks,
    });
  } catch (error) {
    logger.error('[LandmarkRoutes] Error getting nearby landmarks:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get nearby landmarks',
    });
  }
});

/**
 * GET /api/v1/landmarks/by-type/:type
 * Get landmarks by type
 */
router.get('/by-type/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const { limit } = req.query;

    const validTypes = ['district', 'attraction', 'mall', 'university', 'transport', 'market', 'hospital', 'hotel_area', 'embassy', 'other'];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    const landmarks = await landmarkService.getLandmarksByType(
      type as LandmarkType,
      limit ? parseInt(limit as string) : 20
    );

    return res.json({
      success: true,
      data: landmarks,
    });
  } catch (error) {
    logger.error('[LandmarkRoutes] Error getting landmarks by type:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get landmarks',
    });
  }
});

/**
 * GET /api/v1/landmarks/:id
 * Get landmark details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const landmark = await landmarkService.getLandmarkById(id);

    if (!landmark) {
      return res.status(404).json({
        success: false,
        error: 'Landmark not found',
      });
    }

    return res.json({
      success: true,
      data: landmark,
    });
  } catch (error) {
    logger.error('[LandmarkRoutes] Error getting landmark:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get landmark',
    });
  }
});

// ============================================
// ADMIN ROUTES (Protected)
// ============================================

/**
 * POST /api/v1/landmarks
 * Create a new landmark (Admin)
 */
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const landmark = await landmarkService.createLandmark(req.body);

    return res.status(201).json({
      success: true,
      data: landmark,
      message: 'Landmark created successfully',
    });
  } catch (error) {
    logger.error('[LandmarkRoutes] Error creating landmark:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create landmark',
    });
  }
});

/**
 * PUT /api/v1/landmarks/:id
 * Update a landmark (Admin)
 */
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const landmark = await landmarkService.updateLandmark(id, req.body);

    if (!landmark) {
      return res.status(404).json({
        success: false,
        error: 'Landmark not found',
      });
    }

    return res.json({
      success: true,
      data: landmark,
      message: 'Landmark updated successfully',
    });
  } catch (error) {
    logger.error('[LandmarkRoutes] Error updating landmark:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update landmark',
    });
  }
});

/**
 * DELETE /api/v1/landmarks/:id
 * Deactivate a landmark (Admin)
 */
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const success = await landmarkService.deactivateLandmark(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Landmark not found',
      });
    }

    return res.json({
      success: true,
      message: 'Landmark deactivated successfully',
    });
  } catch (error) {
    logger.error('[LandmarkRoutes] Error deactivating landmark:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to deactivate landmark',
    });
  }
});

export default router;
