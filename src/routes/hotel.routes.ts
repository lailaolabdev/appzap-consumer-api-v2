/**
 * Hotel Routes
 * API endpoints for hotel discovery
 */

import { Router, Request, Response } from 'express';
import hotelService from '../services/hotel.service';
import { authenticate } from '../middleware/auth.middleware';
import logger from '../utils/logger';
import { HotelType } from '../models/Hotel';

const router = Router();

/**
 * GET /api/v1/hotels
 * Get all hotels with optional filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      q,
      type,
      province,
      landmark,
      minStars,
      maxStars,
      minPrice,
      maxPrice,
      currency,
      amenities,
      featured,
      lat,
      lng,
      maxDistance,
      skip,
      limit,
      sortBy,
    } = req.query;

    const result = await hotelService.getHotels({
      query: q as string,
      hotelType: type as HotelType,
      province: province as string,
      landmarkId: landmark as string,
      minStars: minStars ? parseInt(minStars as string) : undefined,
      maxStars: maxStars ? parseInt(maxStars as string) : undefined,
      minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
      currency: currency as 'LAK' | 'USD' | 'THB',
      amenities: amenities ? (amenities as string).split(',') : undefined,
      isFeatured: featured === 'true' ? true : featured === 'false' ? false : undefined,
      lat: lat ? parseFloat(lat as string) : undefined,
      lng: lng ? parseFloat(lng as string) : undefined,
      maxDistance: maxDistance ? parseInt(maxDistance as string) : undefined,
      skip: skip ? parseInt(skip as string) : 0,
      limit: limit ? parseInt(limit as string) : 20,
      sortBy: sortBy as 'rating' | 'price' | 'distance' | 'popularity',
    });

    return res.json({
      success: true,
      data: result.hotels,
      total: result.total,
      hasMore: result.hasMore,
    });
  } catch (error) {
    logger.error('[HotelRoutes] Error getting hotels:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get hotels',
    });
  }
});

/**
 * GET /api/v1/hotels/featured
 * Get featured hotels
 */
router.get('/featured', async (req: Request, res: Response) => {
  try {
    const { province, limit } = req.query;

    const hotels = await hotelService.getFeaturedHotels({
      province: province as string,
      limit: limit ? parseInt(limit as string) : 10,
    });

    return res.json({
      success: true,
      data: hotels,
    });
  } catch (error) {
    logger.error('[HotelRoutes] Error getting featured hotels:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get featured hotels',
    });
  }
});

/**
 * GET /api/v1/hotels/search
 * Search hotels by keyword
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

    const hotels = await hotelService.searchHotels(
      q as string,
      limit ? parseInt(limit as string) : 10
    );

    return res.json({
      success: true,
      data: hotels,
    });
  } catch (error) {
    logger.error('[HotelRoutes] Error searching hotels:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to search hotels',
    });
  }
});

/**
 * GET /api/v1/hotels/types
 * Get all hotel types with counts
 */
router.get('/types', async (_req: Request, res: Response) => {
  try {
    const types = await hotelService.getHotelTypes();

    return res.json({
      success: true,
      data: types,
    });
  } catch (error) {
    logger.error('[HotelRoutes] Error getting hotel types:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get hotel types',
    });
  }
});

/**
 * GET /api/v1/hotels/amenities
 * Get all available amenities
 */
router.get('/amenities', async (_req: Request, res: Response) => {
  try {
    const amenities = await hotelService.getAmenities();

    return res.json({
      success: true,
      data: amenities,
    });
  } catch (error) {
    logger.error('[HotelRoutes] Error getting amenities:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get amenities',
    });
  }
});

/**
 * GET /api/v1/hotels/near-landmark/:landmarkId
 * Get hotels near a specific landmark
 */
router.get('/near-landmark/:landmarkId', async (req: Request, res: Response) => {
  try {
    const { landmarkId } = req.params;
    const { limit } = req.query;

    const hotels = await hotelService.getHotelsNearLandmark(
      landmarkId,
      limit ? parseInt(limit as string) : 10
    );

    return res.json({
      success: true,
      data: hotels,
    });
  } catch (error) {
    logger.error('[HotelRoutes] Error getting hotels near landmark:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get hotels near landmark',
    });
  }
});

/**
 * GET /api/v1/hotels/:id
 * Get hotel details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const hotel = await hotelService.getHotelById(id);

    if (!hotel) {
      return res.status(404).json({
        success: false,
        error: 'Hotel not found',
      });
    }

    return res.json({
      success: true,
      data: hotel,
    });
  } catch (error) {
    logger.error('[HotelRoutes] Error getting hotel:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get hotel',
    });
  }
});

/**
 * POST /api/v1/hotels/:id/inquiry
 * Track when user clicks contact (for analytics)
 */
router.post('/:id/inquiry', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await hotelService.trackInquiry(id);

    return res.json({
      success: true,
      message: 'Inquiry tracked',
    });
  } catch (error) {
    logger.error('[HotelRoutes] Error tracking inquiry:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to track inquiry',
    });
  }
});

// ============================================
// ADMIN ROUTES (Protected)
// ============================================

/**
 * POST /api/v1/hotels
 * Create a new hotel (Admin)
 */
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const hotel = await hotelService.createHotel(req.body);

    return res.status(201).json({
      success: true,
      data: hotel,
      message: 'Hotel created successfully',
    });
  } catch (error) {
    logger.error('[HotelRoutes] Error creating hotel:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create hotel',
    });
  }
});

/**
 * PUT /api/v1/hotels/:id
 * Update a hotel (Admin)
 */
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const hotel = await hotelService.updateHotel(id, req.body);

    if (!hotel) {
      return res.status(404).json({
        success: false,
        error: 'Hotel not found',
      });
    }

    return res.json({
      success: true,
      data: hotel,
      message: 'Hotel updated successfully',
    });
  } catch (error) {
    logger.error('[HotelRoutes] Error updating hotel:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update hotel',
    });
  }
});

/**
 * PATCH /api/v1/hotels/:id/status
 * Change hotel status (Admin)
 */
router.patch('/:id/status', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive', 'pending', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
      });
    }

    const success = await hotelService.updateHotelStatus(id, status);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Hotel not found',
      });
    }

    return res.json({
      success: true,
      message: `Hotel status updated to ${status}`,
    });
  } catch (error) {
    logger.error('[HotelRoutes] Error updating hotel status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update hotel status',
    });
  }
});

export default router;
