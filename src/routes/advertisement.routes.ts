/**
 * Advertisement Routes
 * API endpoints for ad serving and management
 */

import { Router, Request, Response } from 'express';
import advertisementService from '../services/advertisement.service';
import { authenticate } from '../middleware/auth.middleware';
import logger from '../utils/logger';
import { AdPlacement, AdType, AdStatus } from '../models/Advertisement';

const router = Router();

// ============================================
// PUBLIC ROUTES (Ad Serving)
// ============================================

/**
 * GET /api/v1/ads
 * Get ads for a specific placement
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      placement,
      province,
      language,
      nationality,
      userType,
      device,
      limit,
    } = req.query;

    if (!placement) {
      return res.status(400).json({
        success: false,
        error: 'Placement is required',
      });
    }

    const ads = await advertisementService.getAdsForPlacement({
      placement: placement as AdPlacement,
      province: province as string,
      language: language as string,
      nationality: nationality as string,
      userType: userType as 'new' | 'returning' | 'premium' | 'inactive',
      device: device as 'ios' | 'android',
      limit: limit ? parseInt(limit as string) : 5,
    });

    return res.json({
      success: true,
      data: ads,
    });
  } catch (error) {
    logger.error('[AdvertisementRoutes] Error getting ads:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get ads',
    });
  }
});

/**
 * POST /api/v1/ads/:id/impression
 * Track ad impression
 */
router.post('/:id/impression', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sessionId, userId } = req.body;

    await advertisementService.trackImpression(id, sessionId, userId);

    return res.json({
      success: true,
      message: 'Impression tracked',
    });
  } catch (error) {
    logger.error('[AdvertisementRoutes] Error tracking impression:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to track impression',
    });
  }
});

/**
 * POST /api/v1/ads/:id/click
 * Track ad click and return redirect URL
 */
router.post('/:id/click', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sessionId, userId } = req.body;

    const redirectUrl = await advertisementService.trackClick(id, sessionId, userId);

    return res.json({
      success: true,
      message: 'Click tracked',
      redirectUrl,
    });
  } catch (error) {
    logger.error('[AdvertisementRoutes] Error tracking click:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to track click',
    });
  }
});

/**
 * POST /api/v1/ads/:id/conversion
 * Track ad conversion
 */
router.post('/:id/conversion', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { revenue } = req.body;

    await advertisementService.trackConversion(id, revenue);

    return res.json({
      success: true,
      message: 'Conversion tracked',
    });
  } catch (error) {
    logger.error('[AdvertisementRoutes] Error tracking conversion:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to track conversion',
    });
  }
});

// ============================================
// ADMIN ROUTES (Protected)
// ============================================

/**
 * GET /api/v1/ads/admin/all
 * Get all ads (Admin)
 */
router.get('/admin/all', authenticate, async (req: Request, res: Response) => {
  try {
    const { status, type, placement, skip, limit } = req.query;

    const result = await advertisementService.getAllAds({
      status: status as AdStatus,
      type: type as AdType,
      placement: placement as AdPlacement,
      skip: skip ? parseInt(skip as string) : 0,
      limit: limit ? parseInt(limit as string) : 20,
    });

    return res.json({
      success: true,
      data: result.ads,
      total: result.total,
    });
  } catch (error) {
    logger.error('[AdvertisementRoutes] Error getting all ads:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get ads',
    });
  }
});

/**
 * GET /api/v1/ads/admin/revenue
 * Get revenue summary (Admin)
 */
router.get('/admin/revenue', authenticate, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const summary = await advertisementService.getRevenueSummary({
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    return res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error('[AdvertisementRoutes] Error getting revenue summary:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get revenue summary',
    });
  }
});

/**
 * GET /api/v1/ads/admin/:id
 * Get ad details with analytics (Admin)
 */
router.get('/admin/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await advertisementService.getAdAnalytics(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Ad not found',
      });
    }

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('[AdvertisementRoutes] Error getting ad analytics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get ad analytics',
    });
  }
});

/**
 * POST /api/v1/ads/admin
 * Create a new ad (Admin)
 */
router.post('/admin', authenticate, async (req: Request, res: Response) => {
  try {
    const ad = await advertisementService.createAd(req.body);

    return res.status(201).json({
      success: true,
      data: ad,
      message: 'Ad created successfully',
    });
  } catch (error) {
    logger.error('[AdvertisementRoutes] Error creating ad:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create ad',
    });
  }
});

/**
 * PUT /api/v1/ads/admin/:id
 * Update an ad (Admin)
 */
router.put('/admin/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const ad = await advertisementService.updateAd(id, req.body);

    if (!ad) {
      return res.status(404).json({
        success: false,
        error: 'Ad not found',
      });
    }

    return res.json({
      success: true,
      data: ad,
      message: 'Ad updated successfully',
    });
  } catch (error) {
    logger.error('[AdvertisementRoutes] Error updating ad:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update ad',
    });
  }
});

/**
 * POST /api/v1/ads/admin/:id/approve
 * Approve an ad (Admin)
 */
router.post('/admin/:id/approve', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?._id?.toString() || 'system';

    const ad = await advertisementService.approveAd(id, userId);

    if (!ad) {
      return res.status(404).json({
        success: false,
        error: 'Ad not found',
      });
    }

    return res.json({
      success: true,
      data: ad,
      message: 'Ad approved successfully',
    });
  } catch (error) {
    logger.error('[AdvertisementRoutes] Error approving ad:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to approve ad',
    });
  }
});

/**
 * POST /api/v1/ads/admin/:id/reject
 * Reject an ad (Admin)
 */
router.post('/admin/:id/reject', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason is required',
      });
    }

    const ad = await advertisementService.rejectAd(id, reason);

    if (!ad) {
      return res.status(404).json({
        success: false,
        error: 'Ad not found',
      });
    }

    return res.json({
      success: true,
      data: ad,
      message: 'Ad rejected',
    });
  } catch (error) {
    logger.error('[AdvertisementRoutes] Error rejecting ad:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reject ad',
    });
  }
});

/**
 * PATCH /api/v1/ads/admin/:id/status
 * Change ad status (Admin)
 */
router.patch('/admin/:id/status', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['draft', 'pending_approval', 'approved', 'active', 'paused', 'ended', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
      });
    }

    const success = await advertisementService.updateAdStatus(id, status);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Ad not found',
      });
    }

    return res.json({
      success: true,
      message: `Ad status updated to ${status}`,
    });
  } catch (error) {
    logger.error('[AdvertisementRoutes] Error updating ad status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update ad status',
    });
  }
});

export default router;
