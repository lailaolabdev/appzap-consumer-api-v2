import { Router, Request, Response } from 'express';
import advertiserService from '../services/advertiser.service';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { ContractStatus, AdvertiserCategory } from '../models/Advertiser';

const router = Router();

// Admin middleware combines authentication + role check
const adminAuth = [authenticate, requireRoles('admin')];

/**
 * @route   GET /api/v1/advertisers
 * @desc    Get all advertisers (admin only)
 * @access  Admin
 */
router.get('/', adminAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, category, productScope } = req.query;
    
    const advertisers = await advertiserService.getAdvertisers({
      status: status as ContractStatus | undefined,
      category: category as AdvertiserCategory | undefined,
      productScope: productScope as string | undefined,
    });

    res.json({
      success: true,
      data: advertisers,
      count: advertisers.length,
    });
  } catch (error) {
    console.error('Error getting advertisers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get advertisers',
    });
  }
});

/**
 * @route   POST /api/v1/advertisers
 * @desc    Create new advertiser (admin only)
 * @access  Admin
 */
router.post('/', adminAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const advertiser = await advertiserService.createAdvertiser(req.body);
    
    res.status(201).json({
      success: true,
      data: advertiser,
    });
  } catch (error) {
    console.error('Error creating advertiser:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create advertiser',
    });
  }
});

/**
 * @route   GET /api/v1/advertisers/:id
 * @desc    Get advertiser by ID
 * @access  Admin
 */
router.get('/:id', adminAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const advertiser = await advertiserService.getAdvertiserById(req.params.id);
    
    if (!advertiser) {
      res.status(404).json({
        success: false,
        error: 'Advertiser not found',
      });
      return;
    }

    res.json({
      success: true,
      data: advertiser,
    });
  } catch (error) {
    console.error('Error getting advertiser:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get advertiser',
    });
  }
});

/**
 * @route   PUT /api/v1/advertisers/:id
 * @desc    Update advertiser
 * @access  Admin
 */
router.put('/:id', adminAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const advertiser = await advertiserService.updateAdvertiser(req.params.id, req.body);
    
    if (!advertiser) {
      res.status(404).json({
        success: false,
        error: 'Advertiser not found',
      });
      return;
    }

    res.json({
      success: true,
      data: advertiser,
    });
  } catch (error) {
    console.error('Error updating advertiser:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update advertiser',
    });
  }
});

/**
 * @route   PATCH /api/v1/advertisers/:id/status
 * @desc    Update advertiser status
 * @access  Admin
 */
router.patch('/:id/status', adminAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    
    if (!status) {
      res.status(400).json({
        success: false,
        error: 'Status is required',
      });
      return;
    }

    const advertiser = await advertiserService.updateStatus(req.params.id, status);
    
    if (!advertiser) {
      res.status(404).json({
        success: false,
        error: 'Advertiser not found',
      });
      return;
    }

    res.json({
      success: true,
      data: advertiser,
    });
  } catch (error) {
    console.error('Error updating advertiser status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update advertiser status',
    });
  }
});

/**
 * @route   GET /api/v1/advertisers/:id/analytics
 * @desc    Get comprehensive analytics for a sponsor (ROI report)
 * @access  Admin
 */
router.get('/:id/analytics', adminAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    
    // Default to current month if not provided
    const now = new Date();
    const start = startDate 
      ? new Date(startDate as string) 
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate 
      ? new Date(endDate as string) 
      : new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const analytics = await advertiserService.getSponsorAnalytics(
      req.params.id,
      start,
      end
    );

    if (!analytics.sponsor) {
      res.status(404).json({
        success: false,
        error: 'Advertiser not found',
      });
      return;
    }

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('Error getting sponsor analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sponsor analytics',
    });
  }
});

/**
 * @route   GET /api/v1/advertisers/:id/ads
 * @desc    Get all ads by sponsor
 * @access  Admin
 */
router.get('/:id/ads', adminAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const ads = await advertiserService.getAdsBySponsor(req.params.id);

    res.json({
      success: true,
      data: ads,
      count: ads.length,
    });
  } catch (error) {
    console.error('Error getting sponsor ads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sponsor ads',
    });
  }
});

/**
 * @route   GET /api/v1/advertisers/check-exclusivity/:placement
 * @desc    Check if a placement is exclusively held
 * @access  Admin
 */
router.get('/check-exclusivity/:placement', adminAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await advertiserService.checkPlacementExclusivity(req.params.placement);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error checking exclusivity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check exclusivity',
    });
  }
});

export default router;
