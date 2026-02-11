import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import logger from '../utils/logger';

/**
 * Analytics Controller - Handles HTTP requests for analytics & reporting
 */
export class AnalyticsController {
  
  /**
   * GET /api/v1/restaurants/:restaurantId/analytics
   * Get analytics dashboard for a restaurant
   */
  static async getRestaurantDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { restaurantId } = req.params;
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      
      const dashboard = await AnalyticsService.getRestaurantDashboard(
        restaurantId,
        start,
        end
      );
      
      res.json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      logger.error('Error getting restaurant dashboard:', error);
      next(error);
    }
  }
  
  /**
   * GET /api/v1/admin/analytics
   * Get admin dashboard (all restaurants)
   */
  static async getAdminDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      
      const dashboard = await AnalyticsService.getAdminDashboard(start, end);
      
      res.json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      logger.error('Error getting admin dashboard:', error);
      next(error);
    }
  }
  
  /**
   * GET /api/v1/promotions/:id/analytics
   * Get analytics for a specific promotion
   */
  static async getPromotionReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      const report = await AnalyticsService.getPromotionReport(id);
      
      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      if ((error as any).message === 'Promotion not found') {
        res.status(404).json({
          success: false,
          message: 'Promotion not found',
        });
        return;
      }
      logger.error('Error getting promotion report:', error);
      next(error);
    }
  }
  
  /**
   * GET /api/v1/coupons/:id/analytics
   * Get analytics for a specific coupon
   */
  static async getCouponReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      const report = await AnalyticsService.getCouponReport(id);
      
      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      if ((error as any).message === 'Coupon not found') {
        res.status(404).json({
          success: false,
          message: 'Coupon not found',
        });
        return;
      }
      logger.error('Error getting coupon report:', error);
      next(error);
    }
  }
}
