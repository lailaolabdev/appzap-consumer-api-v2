import mongoose from 'mongoose';
import { PromotionAnalytics, IPromotionAnalytics } from '../models/PromotionAnalytics';
import { Promotion } from '../models/Promotion';
import { Coupon } from '../models/Coupon';
import { CouponPurchase } from '../models/CouponPurchase';
import logger from '../utils/logger';

/**
 * Analytics Service - Handles reporting and statistics
 */
export class AnalyticsService {
  
  /**
   * Get dashboard summary for a restaurant
   */
  static async getRestaurantDashboard(
    restaurantId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    summary: {
      totalPromotionViews: number;
      totalPromotionRedemptions: number;
      totalCouponsSold: number;
      totalCouponsRedeemed: number;
      totalRevenue: number;
      totalCommission: number;
    };
    promotions: {
      active: number;
      totalViews: number;
      totalRedemptions: number;
      conversionRate: number;
    };
    coupons: {
      active: number;
      totalSold: number;
      totalRedeemed: number;
      revenue: number;
      redemptionRate: number;
    };
    trends: IPromotionAnalytics[];
  }> {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);  // Last 30 days
    const end = endDate || new Date();
    
    // Get aggregated analytics
    const analyticsAgg = await PromotionAnalytics.aggregate([
      {
        $match: {
          restaurantId,
          date: { $gte: start, $lte: end },
          period: 'daily',
        },
      },
      {
        $group: {
          _id: null,
          totalPromotionViews: { $sum: '$promotionViews' },
          totalPromotionClicks: { $sum: '$promotionClicks' },
          totalPromotionRedemptions: { $sum: '$promotionRedemptions' },
          totalCouponViews: { $sum: '$couponViews' },
          totalCouponPurchases: { $sum: '$couponPurchases' },
          totalCouponRedemptions: { $sum: '$couponRedemptions' },
          totalCouponSalesRevenue: { $sum: '$couponSalesRevenue' },
          totalAppzapCommission: { $sum: '$appzapCommission' },
          totalRestaurantRevenue: { $sum: '$restaurantRevenue' },
        },
      },
    ]);
    
    const analytics = analyticsAgg[0] || {
      totalPromotionViews: 0,
      totalPromotionClicks: 0,
      totalPromotionRedemptions: 0,
      totalCouponViews: 0,
      totalCouponPurchases: 0,
      totalCouponRedemptions: 0,
      totalCouponSalesRevenue: 0,
      totalAppzapCommission: 0,
      totalRestaurantRevenue: 0,
    };
    
    // Get active promotions count
    const now = new Date();
    const [activePromotions, activeCoupons] = await Promise.all([
      Promotion.countDocuments({
        restaurantId,
        isActive: true,
        isApproved: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
      }),
      Coupon.countDocuments({
        restaurantId,
        isActive: true,
        isApproved: true,
        purchaseStartDate: { $lte: now },
        purchaseEndDate: { $gte: now },
        remainingQuantity: { $gt: 0 },
      }),
    ]);
    
    // Get daily trends
    const trends = await PromotionAnalytics.find({
      restaurantId,
      date: { $gte: start, $lte: end },
      period: 'daily',
    })
    .sort({ date: 1 })
    .lean();
    
    // Calculate rates
    const promotionConversionRate = analytics.totalPromotionClicks > 0
      ? (analytics.totalPromotionRedemptions / analytics.totalPromotionClicks) * 100
      : 0;
    
    const couponRedemptionRate = analytics.totalCouponPurchases > 0
      ? (analytics.totalCouponRedemptions / analytics.totalCouponPurchases) * 100
      : 0;
    
    return {
      summary: {
        totalPromotionViews: analytics.totalPromotionViews,
        totalPromotionRedemptions: analytics.totalPromotionRedemptions,
        totalCouponsSold: analytics.totalCouponPurchases,
        totalCouponsRedeemed: analytics.totalCouponRedemptions,
        totalRevenue: analytics.totalCouponSalesRevenue,
        totalCommission: analytics.totalAppzapCommission,
      },
      promotions: {
        active: activePromotions,
        totalViews: analytics.totalPromotionViews,
        totalRedemptions: analytics.totalPromotionRedemptions,
        conversionRate: Math.round(promotionConversionRate * 100) / 100,
      },
      coupons: {
        active: activeCoupons,
        totalSold: analytics.totalCouponPurchases,
        totalRedeemed: analytics.totalCouponRedemptions,
        revenue: analytics.totalCouponSalesRevenue,
        redemptionRate: Math.round(couponRedemptionRate * 100) / 100,
      },
      trends: trends as unknown as IPromotionAnalytics[],
    };
  }
  
  /**
   * Get AppZap admin dashboard (all restaurants)
   */
  static async getAdminDashboard(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    summary: {
      totalRestaurants: number;
      totalPromotions: number;
      totalCoupons: number;
      totalCouponsSold: number;
      totalRevenue: number;
      totalCommission: number;
    };
    topRestaurants: Array<{
      restaurantId: string;
      restaurantName: string;
      couponsSold: number;
      revenue: number;
    }>;
    trends: Array<{
      date: Date;
      couponsSold: number;
      revenue: number;
    }>;
  }> {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();
    const now = new Date();
    
    // Get total counts
    const [totalRestaurants, totalPromotions, totalCoupons] = await Promise.all([
      Coupon.distinct('restaurantId').then(ids => ids.length),
      Promotion.countDocuments({ isActive: true, isApproved: true }),
      Coupon.countDocuments({ isActive: true, isApproved: true }),
    ]);
    
    // Get aggregated analytics
    const analyticsAgg = await PromotionAnalytics.aggregate([
      {
        $match: {
          date: { $gte: start, $lte: end },
          period: 'daily',
        },
      },
      {
        $group: {
          _id: null,
          totalCouponPurchases: { $sum: '$couponPurchases' },
          totalCouponSalesRevenue: { $sum: '$couponSalesRevenue' },
          totalAppzapCommission: { $sum: '$appzapCommission' },
        },
      },
    ]);
    
    const analytics = analyticsAgg[0] || {
      totalCouponPurchases: 0,
      totalCouponSalesRevenue: 0,
      totalAppzapCommission: 0,
    };
    
    // Get top restaurants
    const topRestaurantsAgg = await CouponPurchase.aggregate([
      {
        $match: {
          purchasedAt: { $gte: start, $lte: end },
          paymentStatus: 'completed',
        },
      },
      {
        $group: {
          _id: { restaurantId: '$restaurantId', restaurantName: '$restaurantName' },
          couponsSold: { $sum: 1 },
          revenue: { $sum: '$purchasePrice' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          restaurantId: '$_id.restaurantId',
          restaurantName: '$_id.restaurantName',
          couponsSold: 1,
          revenue: 1,
        },
      },
    ]);
    
    // Get daily trends
    const trendsAgg = await PromotionAnalytics.aggregate([
      {
        $match: {
          date: { $gte: start, $lte: end },
          period: 'daily',
        },
      },
      {
        $group: {
          _id: '$date',
          couponsSold: { $sum: '$couponPurchases' },
          revenue: { $sum: '$couponSalesRevenue' },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          couponsSold: 1,
          revenue: 1,
        },
      },
    ]);
    
    return {
      summary: {
        totalRestaurants,
        totalPromotions,
        totalCoupons,
        totalCouponsSold: analytics.totalCouponPurchases,
        totalRevenue: analytics.totalCouponSalesRevenue,
        totalCommission: analytics.totalAppzapCommission,
      },
      topRestaurants: topRestaurantsAgg,
      trends: trendsAgg,
    };
  }
  
  /**
   * Get performance report for a specific promotion
   */
  static async getPromotionReport(promotionId: string): Promise<{
    promotion: any;
    metrics: {
      views: number;
      clicks: number;
      redemptions: number;
      clickRate: number;
      redemptionRate: number;
    };
    dailyData: IPromotionAnalytics[];
  }> {
    const promotion = await Promotion.findById(promotionId).lean();
    
    if (!promotion) {
      throw new Error('Promotion not found');
    }
    
    const dailyData = await PromotionAnalytics.find({
      promotionId: new mongoose.Types.ObjectId(promotionId),
      period: 'daily',
    })
    .sort({ date: 1 })
    .lean();
    
    // Calculate totals
    const totals = dailyData.reduce((acc, day) => ({
      views: acc.views + day.promotionViews,
      clicks: acc.clicks + day.promotionClicks,
      redemptions: acc.redemptions + day.promotionRedemptions,
    }), { views: 0, clicks: 0, redemptions: 0 });
    
    return {
      promotion,
      metrics: {
        views: totals.views,
        clicks: totals.clicks,
        redemptions: totals.redemptions,
        clickRate: totals.views > 0 ? (totals.clicks / totals.views) * 100 : 0,
        redemptionRate: totals.clicks > 0 ? (totals.redemptions / totals.clicks) * 100 : 0,
      },
      dailyData: dailyData as unknown as IPromotionAnalytics[],
    };
  }
  
  /**
   * Get performance report for a specific coupon
   */
  static async getCouponReport(couponId: string): Promise<{
    coupon: any;
    metrics: {
      views: number;
      purchases: number;
      redemptions: number;
      purchaseRate: number;
      redemptionRate: number;
      totalRevenue: number;
    };
    dailyData: IPromotionAnalytics[];
  }> {
    const coupon = await Coupon.findById(couponId).lean();
    
    if (!coupon) {
      throw new Error('Coupon not found');
    }
    
    const dailyData = await PromotionAnalytics.find({
      couponId: new mongoose.Types.ObjectId(couponId),
      period: 'daily',
    })
    .sort({ date: 1 })
    .lean();
    
    // Calculate totals
    const totals = dailyData.reduce((acc, day) => ({
      views: acc.views + day.couponViews,
      purchases: acc.purchases + day.couponPurchases,
      redemptions: acc.redemptions + day.couponRedemptions,
      revenue: acc.revenue + day.couponSalesRevenue,
    }), { views: 0, purchases: 0, redemptions: 0, revenue: 0 });
    
    return {
      coupon,
      metrics: {
        views: totals.views,
        purchases: totals.purchases,
        redemptions: totals.redemptions,
        purchaseRate: totals.views > 0 ? (totals.purchases / totals.views) * 100 : 0,
        redemptionRate: totals.purchases > 0 ? (totals.redemptions / totals.purchases) * 100 : 0,
        totalRevenue: totals.revenue,
      },
      dailyData: dailyData as unknown as IPromotionAnalytics[],
    };
  }
  
  /**
   * Aggregate daily analytics to weekly/monthly (scheduled job)
   */
  static async aggregateAnalytics(): Promise<void> {
    const now = new Date();
    
    // Get yesterday's date
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    // Get start of week (Monday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);
    
    // Get start of month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    logger.info('Running analytics aggregation job');
    
    // This would aggregate daily data into weekly/monthly summaries
    // Implementation depends on specific requirements
  }
}
