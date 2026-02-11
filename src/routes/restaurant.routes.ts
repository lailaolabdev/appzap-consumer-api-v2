/**
 * Restaurant Routes
 * 
 * Endpoints for restaurant discovery and monetization:
 * - Featured restaurants (premium listings)
 * - New restaurants (spotlight section)
 * - Restaurants with table availability
 * - Package management
 */

import { Router, Request, Response } from 'express';
import { restaurantPackageService } from '../services/restaurantPackage.service';
import { unifiedRestaurantService } from '../services/unifiedRestaurant.service';
import { authenticate } from '../middleware/auth.middleware';
import logger from '../utils/logger';

const router = Router();

// ============================================================================
// PUBLIC ENDPOINTS - Consumer App
// ============================================================================

/**
 * GET /api/v1/restaurants/featured
 * Get premium/featured restaurants for home page
 */
router.get('/featured', async (req: Request, res: Response) => {
  try {
    const { limit, province, lat, lng } = req.query;

    const restaurants = await restaurantPackageService.getFeaturedRestaurants({
      limit: limit ? parseInt(limit as string) : 10,
      province: province as string,
      lat: lat ? parseFloat(lat as string) : undefined,
      lng: lng ? parseFloat(lng as string) : undefined,
    });

    res.json({
      success: true,
      data: restaurants,
      total: restaurants.length,
    });
  } catch (error) {
    logger.error('[RestaurantRoutes] Failed to get featured restaurants:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get featured restaurants',
    });
  }
});

/**
 * GET /api/v1/restaurants/new
 * Get new restaurants for "New" section
 */
router.get('/new', async (req: Request, res: Response) => {
  try {
    const { limit, daysBack } = req.query;

    const restaurants = await restaurantPackageService.getNewRestaurants({
      limit: limit ? parseInt(limit as string) : 10,
      daysBack: daysBack ? parseInt(daysBack as string) : 30,
    });

    res.json({
      success: true,
      data: restaurants,
      total: restaurants.length,
    });
  } catch (error) {
    logger.error('[RestaurantRoutes] Failed to get new restaurants:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get new restaurants',
    });
  }
});

/**
 * GET /api/v1/restaurants/with-tables
 * Get restaurants with available tables (for booking section)
 */
router.get('/with-tables', async (req: Request, res: Response) => {
  try {
    const { date, time, partySize, limit } = req.query;

    const restaurants = await restaurantPackageService.getRestaurantsWithAvailability({
      date: date as string,
      time: time as string,
      partySize: partySize ? parseInt(partySize as string) : undefined,
      limit: limit ? parseInt(limit as string) : 20,
    });

    res.json({
      success: true,
      data: restaurants,
      total: restaurants.length,
    });
  } catch (error) {
    logger.error('[RestaurantRoutes] Failed to get restaurants with tables:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get restaurants with availability',
    });
  }
});

/**
 * GET /api/v1/restaurants/search
 * Search restaurants with filters
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, cuisine, isReservable, skip, limit } = req.query;

    const result = await unifiedRestaurantService.getAllRestaurants({
      search: q as string,
      cuisine: cuisine as string,
      isReservable: isReservable === 'true',
      skip: skip ? parseInt(skip as string) : 0,
      limit: limit ? parseInt(limit as string) : 20,
    });

    res.json({
      success: true,
      data: result.data,
      total: result.total,
      page: Math.floor((parseInt(skip as string) || 0) / (parseInt(limit as string) || 20)) + 1,
    });
  } catch (error) {
    logger.error('[RestaurantRoutes] Failed to search restaurants:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search restaurants',
    });
  }
});

/**
 * GET /api/v1/restaurants/:id
 * Get restaurant details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { posVersion } = req.query;

    const restaurant = await unifiedRestaurantService.getRestaurantById(
      id,
      posVersion as 'v1' | 'v2' | undefined
    );

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        error: 'Restaurant not found',
      });
    }

    // Track click if restaurant has a package
    const pkg = await restaurantPackageService.getRestaurantPackage(
      restaurant.posRestaurantId
    );
    if (pkg) {
      await restaurantPackageService.trackClick(pkg._id.toString());
    }

    return res.json({
      success: true,
      data: restaurant,
    });
  } catch (error) {
    logger.error('[RestaurantRoutes] Failed to get restaurant:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get restaurant',
    });
  }
});

/**
 * GET /api/v1/restaurants/:id/menu
 * Get restaurant menu
 */
router.get('/:id/menu', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { posVersion, categoryId, skip, limit } = req.query;

    // Parse restaurant ID to get posVersion if not provided
    const parsed = unifiedRestaurantService.parseRestaurantId(id);
    const version = (posVersion as 'v1' | 'v2') || parsed.posVersion;
    const restaurantId = parsed.posRestaurantId;

    const menu = await unifiedRestaurantService.getMenu(restaurantId, version, {
      categoryId: categoryId as string,
      skip: skip ? parseInt(skip as string) : 0,
      limit: limit ? parseInt(limit as string) : 100,
    });

    res.json({
      success: true,
      data: menu,
    });
  } catch (error) {
    logger.error('[RestaurantRoutes] Failed to get menu:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get menu',
    });
  }
});

// ============================================================================
// PACKAGE MANAGEMENT - Restaurant Admin
// ============================================================================

/**
 * GET /api/v1/restaurants/packages/available
 * Get available packages for purchase
 */
router.get('/packages/available', async (_req: Request, res: Response) => {
  try {
    const packages = restaurantPackageService.getAvailablePackages();
    res.json({
      success: true,
      data: packages,
    });
  } catch (error) {
    logger.error('[RestaurantRoutes] Failed to get available packages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get packages',
    });
  }
});

/**
 * GET /api/v1/restaurants/:id/package
 * Get restaurant's active package
 */
router.get('/:id/package', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pkg = await restaurantPackageService.getRestaurantPackage(id);
    
    res.json({
      success: true,
      data: pkg,
    });
  } catch (error) {
    logger.error('[RestaurantRoutes] Failed to get restaurant package:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get package',
    });
  }
});

/**
 * POST /api/v1/restaurants/:id/package
 * Purchase a package for a restaurant
 */
router.post('/:id/package', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { packageType, posVersion, paymentMethod, paymentReference } = req.body;

    if (!packageType || !posVersion) {
      return res.status(400).json({
        success: false,
        error: 'packageType and posVersion are required',
      });
    }

    const pkg = await restaurantPackageService.purchasePackage({
      restaurantId: id,
      posVersion,
      packageType,
      paymentMethod,
      paymentReference,
    });

    return res.json({
      success: true,
      data: pkg,
      message: pkg.isPaid 
        ? 'Package activated successfully' 
        : 'Package created, awaiting payment',
    });
  } catch (error) {
    logger.error('[RestaurantRoutes] Failed to purchase package:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to purchase package',
    });
  }
});

/**
 * POST /api/v1/restaurants/packages/:packageId/confirm-payment
 * Confirm payment for a package
 */
router.post('/packages/:packageId/confirm-payment', async (req: Request, res: Response) => {
  try {
    const { packageId } = req.params;
    const { paymentReference } = req.body;

    if (!paymentReference) {
      return res.status(400).json({
        success: false,
        error: 'paymentReference is required',
      });
    }

    const pkg = await restaurantPackageService.confirmPayment(packageId, paymentReference);

    return res.json({
      success: true,
      data: pkg,
      message: 'Payment confirmed, package is now active',
    });
  } catch (error) {
    logger.error('[RestaurantRoutes] Failed to confirm payment:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to confirm payment',
    });
  }
});

/**
 * GET /api/v1/restaurants/packages/:packageId/analytics
 * Get package analytics
 */
router.get('/packages/:packageId/analytics', async (req: Request, res: Response) => {
  try {
    const { packageId } = req.params;
    const analytics = await restaurantPackageService.getPackageAnalytics(packageId);

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    logger.error('[RestaurantRoutes] Failed to get package analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics',
    });
  }
});

// ============================================================================
// ADMIN ENDPOINTS
// ============================================================================

/**
 * GET /api/v1/restaurants/admin/revenue
 * Get revenue summary (Admin only)
 */
router.get('/admin/revenue', authenticate, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const summary = await restaurantPackageService.getRevenueSummary({
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error('[RestaurantRoutes] Failed to get revenue summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get revenue summary',
    });
  }
});

export default router;
