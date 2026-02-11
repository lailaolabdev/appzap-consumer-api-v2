import { Request, Response, NextFunction } from 'express';
import { CouponService } from '../services/coupon.service';
import logger from '../utils/logger';

/**
 * Coupon Controller - Handles HTTP requests for coupons marketplace
 */
export class CouponController {
  
  /**
   * GET /api/v1/coupons
   * Get available coupons for purchase
   */
  static async getCoupons(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        restaurantId,
        featured,
        minDiscount,
        page = '1',
        limit = '20',
        sortBy = 'popular',
      } = req.query;
      
      const result = await CouponService.getAvailableCoupons({
        restaurantId: restaurantId as string,
        featured: featured === 'true',
        minDiscount: minDiscount ? parseInt(minDiscount as string) : undefined,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        sortBy: sortBy as any,
      });
      
      res.json({
        success: true,
        data: result.coupons,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: result.total,
          hasMore: result.hasMore,
        },
      });
    } catch (error) {
      logger.error('Error getting coupons:', error);
      next(error);
    }
  }
  
  /**
   * GET /api/v1/coupons/featured
   * Get featured coupons for home page
   */
  static async getFeaturedCoupons(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const coupons = await CouponService.getFeaturedCoupons(limit);
      
      res.json({
        success: true,
        data: coupons,
      });
    } catch (error) {
      logger.error('Error getting featured coupons:', error);
      next(error);
    }
  }
  
  /**
   * GET /api/v1/coupons/:id
   * Get coupon details
   */
  static async getCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      
      const coupon = await CouponService.getCouponById(id);
      
      if (!coupon) {
        res.status(404).json({
          success: false,
          message: 'Coupon not found',
        });
        return;
      }
      
      // Record view
      await CouponService.recordView(id, userId);
      
      res.json({
        success: true,
        data: coupon,
      });
    } catch (error) {
      logger.error('Error getting coupon:', error);
      next(error);
    }
  }
  
  /**
   * POST /api/v1/coupons/:id/purchase
   * Purchase a coupon
   */
  static async purchaseCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const { paymentMethod, paymentReference } = req.body;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }
      
      const result = await CouponService.purchaseCoupon(
        id,
        userId,
        paymentMethod || 'wallet',
        paymentReference
      );
      
      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.message,
        });
        return;
      }
      
      res.status(201).json({
        success: true,
        message: result.message,
        data: result.purchase,
      });
    } catch (error) {
      logger.error('Error purchasing coupon:', error);
      next(error);
    }
  }
  
  /**
   * GET /api/v1/users/me/coupons
   * Get user's purchased coupons
   */
  static async getMyCoupons(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { status } = req.query;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }
      
      const coupons = await CouponService.getUserCoupons(
        userId,
        status as any
      );
      
      res.json({
        success: true,
        data: coupons,
      });
    } catch (error) {
      logger.error('Error getting user coupons:', error);
      next(error);
    }
  }
  
  /**
   * GET /api/v1/coupons/validate/:code
   * Validate a coupon code (for POS)
   */
  static async validateCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code } = req.params;
      
      const result = await CouponService.validateCouponCode(code);
      
      res.json({
        success: true,
        valid: result.valid,
        message: result.message,
        data: result.purchase,
      });
    } catch (error) {
      logger.error('Error validating coupon code:', error);
      next(error);
    }
  }
  
  /**
   * POST /api/v1/coupons/redeem
   * Redeem a coupon at POS
   */
  static async redeemCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, amount, orderId, posOrderId, usedBy } = req.body;
      
      if (!code || !amount) {
        res.status(400).json({
          success: false,
          message: 'Redemption code and amount are required',
        });
        return;
      }
      
      const result = await CouponService.redeemCoupon(
        code,
        amount,
        { orderId, posOrderId, usedBy }
      );
      
      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.message,
        });
        return;
      }
      
      res.json({
        success: true,
        message: result.message,
        data: result.purchase,
      });
    } catch (error) {
      logger.error('Error redeeming coupon:', error);
      next(error);
    }
  }
  
  /**
   * GET /api/v1/restaurants/:restaurantId/coupons
   * Get coupons for a specific restaurant
   */
  static async getRestaurantCoupons(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { restaurantId } = req.params;
      const { includeInactive } = req.query;
      
      const coupons = await CouponService.getRestaurantCoupons(
        restaurantId,
        includeInactive === 'true'
      );
      
      res.json({
        success: true,
        data: coupons,
      });
    } catch (error) {
      logger.error('Error getting restaurant coupons:', error);
      next(error);
    }
  }
  
  /**
   * POST /api/v1/coupons
   * Create a new coupon (restaurant admin)
   */
  static async createCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const coupon = await CouponService.createCoupon(req.body);
      
      res.status(201).json({
        success: true,
        message: 'Coupon created. Pending approval.',
        data: coupon,
      });
    } catch (error) {
      logger.error('Error creating coupon:', error);
      next(error);
    }
  }
  
  /**
   * PUT /api/v1/coupons/:id
   * Update a coupon
   */
  static async updateCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      const coupon = await CouponService.updateCoupon(id, req.body);
      
      if (!coupon) {
        res.status(404).json({
          success: false,
          message: 'Coupon not found',
        });
        return;
      }
      
      res.json({
        success: true,
        message: 'Coupon updated',
        data: coupon,
      });
    } catch (error) {
      logger.error('Error updating coupon:', error);
      next(error);
    }
  }
  
  /**
   * POST /api/v1/admin/coupons/:id/approve
   * Approve a coupon (admin only)
   */
  static async approveCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      const coupon = await CouponService.approveCoupon(id);
      
      if (!coupon) {
        res.status(404).json({
          success: false,
          message: 'Coupon not found',
        });
        return;
      }
      
      res.json({
        success: true,
        message: 'Coupon approved',
        data: coupon,
      });
    } catch (error) {
      logger.error('Error approving coupon:', error);
      next(error);
    }
  }
}
