import { Request, Response, NextFunction } from 'express';
import { PromotionService } from '../services/promotion.service';
import logger from '../utils/logger';

/**
 * Promotion Controller - Handles HTTP requests for promotions
 */
export class PromotionController {
  
  /**
   * GET /api/v1/promotions
   * Get all active promotions
   */
  static async getPromotions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        restaurantId,
        type,
        isFlashSale,
        page = '1',
        limit = '20',
        sortBy = 'priority',
      } = req.query;
      
      const result = await PromotionService.getActivePromotions({
        restaurantId: restaurantId as string,
        type: type as any,
        isFlashSale: isFlashSale === 'true',
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        sortBy: sortBy as any,
      });
      
      res.json({
        success: true,
        data: result.promotions,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: result.total,
          hasMore: result.hasMore,
        },
      });
    } catch (error) {
      logger.error('Error getting promotions:', error);
      next(error);
    }
  }
  
  /**
   * GET /api/v1/promotions/flash-sales
   * Get current flash sales
   */
  static async getFlashSales(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const flashSales = await PromotionService.getFlashSales(limit);
      
      res.json({
        success: true,
        data: flashSales,
      });
    } catch (error) {
      logger.error('Error getting flash sales:', error);
      next(error);
    }
  }
  
  /**
   * GET /api/v1/promotions/:id
   * Get promotion details
   */
  static async getPromotion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      
      const promotion = await PromotionService.getPromotionById(id);
      
      if (!promotion) {
        res.status(404).json({
          success: false,
          message: 'Promotion not found',
        });
        return;
      }
      
      // Record view
      await PromotionService.recordView(id, userId);
      
      res.json({
        success: true,
        data: promotion,
      });
    } catch (error) {
      logger.error('Error getting promotion:', error);
      next(error);
    }
  }
  
  /**
   * POST /api/v1/promotions/:id/click
   * Record promotion click
   */
  static async recordClick(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      
      await PromotionService.recordClick(id, userId);
      
      res.json({
        success: true,
        message: 'Click recorded',
      });
    } catch (error) {
      logger.error('Error recording click:', error);
      next(error);
    }
  }
  
  /**
   * POST /api/v1/promotions/:id/redeem
   * Redeem a promotion
   */
  static async redeemPromotion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const { orderId } = req.body;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }
      
      const result = await PromotionService.redeemPromotion(id, userId, orderId);
      
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
        data: result.promotion,
      });
    } catch (error) {
      logger.error('Error redeeming promotion:', error);
      next(error);
    }
  }
  
  /**
   * GET /api/v1/restaurants/:restaurantId/promotions
   * Get promotions for a specific restaurant
   */
  static async getRestaurantPromotions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { restaurantId } = req.params;
      
      const promotions = await PromotionService.getRestaurantPromotions(restaurantId);
      
      res.json({
        success: true,
        data: promotions,
      });
    } catch (error) {
      logger.error('Error getting restaurant promotions:', error);
      next(error);
    }
  }
  
  /**
   * POST /api/v1/promotions
   * Create a new promotion (restaurant admin)
   */
  static async createPromotion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const promotion = await PromotionService.createPromotion(req.body);
      
      res.status(201).json({
        success: true,
        message: 'Promotion created. Pending approval.',
        data: promotion,
      });
    } catch (error) {
      logger.error('Error creating promotion:', error);
      next(error);
    }
  }
  
  /**
   * PUT /api/v1/promotions/:id
   * Update a promotion
   */
  static async updatePromotion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      const promotion = await PromotionService.updatePromotion(id, req.body);
      
      if (!promotion) {
        res.status(404).json({
          success: false,
          message: 'Promotion not found',
        });
        return;
      }
      
      res.json({
        success: true,
        message: 'Promotion updated',
        data: promotion,
      });
    } catch (error) {
      logger.error('Error updating promotion:', error);
      next(error);
    }
  }
  
  /**
   * POST /api/v1/admin/promotions/:id/approve
   * Approve a promotion (admin only)
   */
  static async approvePromotion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      const promotion = await PromotionService.approvePromotion(id);
      
      if (!promotion) {
        res.status(404).json({
          success: false,
          message: 'Promotion not found',
        });
        return;
      }
      
      res.json({
        success: true,
        message: 'Promotion approved',
        data: promotion,
      });
    } catch (error) {
      logger.error('Error approving promotion:', error);
      next(error);
    }
  }
  
  /**
   * DELETE /api/v1/promotions/:id
   * Deactivate a promotion
   */
  static async deactivatePromotion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      const promotion = await PromotionService.deactivatePromotion(id);
      
      if (!promotion) {
        res.status(404).json({
          success: false,
          message: 'Promotion not found',
        });
        return;
      }
      
      res.json({
        success: true,
        message: 'Promotion deactivated',
      });
    } catch (error) {
      logger.error('Error deactivating promotion:', error);
      next(error);
    }
  }
  
  /**
   * GET /api/v1/promotions/:id/eligibility
   * Check if user can use a promotion
   */
  static async checkEligibility(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }
      
      const result = await PromotionService.canUserUsePromotion(id, userId);
      
      res.json({
        success: true,
        canUse: result.canUse,
        reason: result.reason,
      });
    } catch (error) {
      logger.error('Error checking eligibility:', error);
      next(error);
    }
  }
}
