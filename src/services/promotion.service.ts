import { Promotion, IPromotion, PromotionType } from '../models/Promotion';
import { recordAnalyticsEvent } from '../models/PromotionAnalytics';
import logger from '../utils/logger';

/**
 * Promotion Service - Handles promotion-related business logic
 */
export class PromotionService {
  
  /**
   * Get all active promotions with optional filters
   */
  static async getActivePromotions(options: {
    restaurantId?: string;
    type?: PromotionType;
    isFlashSale?: boolean;
    page?: number;
    limit?: number;
    sortBy?: 'priority' | 'endDate' | 'discountPercentage';
  } = {}): Promise<{ promotions: IPromotion[]; total: number; hasMore: boolean }> {
    const {
      restaurantId,
      type,
      isFlashSale,
      page = 1,
      limit = 20,
      sortBy = 'priority',
    } = options;
    
    const now = new Date();
    const query: any = {
      isActive: true,
      isApproved: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $or: [
        { remainingQuantity: { $gt: 0 } },
        { remainingQuantity: { $exists: false } },
        { totalQuantity: { $exists: false } },
      ],
    };
    
    if (restaurantId) {
      query.restaurantId = restaurantId;
    }
    if (type) {
      query.type = type;
    }
    if (isFlashSale !== undefined) {
      query.isFlashSale = isFlashSale;
    }
    
    // Sort options
    let sort: any = {};
    switch (sortBy) {
      case 'endDate':
        sort = { endDate: 1 };  // Ending soon first
        break;
      case 'discountPercentage':
        sort = { discountPercentage: -1 };  // Biggest discount first
        break;
      default:
        sort = { priority: -1, createdAt: -1 };
    }
    
    const skip = (page - 1) * limit;
    
    const [promotions, total] = await Promise.all([
      Promotion.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Promotion.countDocuments(query),
    ]);
    
    return {
      promotions: promotions as unknown as IPromotion[],
      total,
      hasMore: skip + promotions.length < total,
    };
  }
  
  /**
   * Get flash sales (time-limited deals)
   */
  static async getFlashSales(limit: number = 10): Promise<IPromotion[]> {
    const now = new Date();
    
    const flashSales = await Promotion.find({
      isActive: true,
      isApproved: true,
      isFlashSale: true,
      startDate: { $lte: now },
      flashSaleEndsAt: { $gte: now },
      $or: [
        { remainingQuantity: { $gt: 0 } },
        { remainingQuantity: { $exists: false } },
      ],
    })
    .sort({ flashSaleEndsAt: 1 })  // Ending soonest first
    .limit(limit)
    .lean();
    
    return flashSales as unknown as IPromotion[];
  }
  
  /**
   * Get promotion by ID
   */
  static async getPromotionById(promotionId: string): Promise<IPromotion | null> {
    const promotion = await Promotion.findById(promotionId).lean();
    return promotion as IPromotion | null;
  }
  
  /**
   * Record promotion view
   */
  static async recordView(promotionId: string, userId?: string): Promise<void> {
    const promotion = await Promotion.findByIdAndUpdate(
      promotionId,
      { $inc: { viewCount: 1 } },
      { new: true }
    );
    
    if (promotion) {
      await recordAnalyticsEvent('promotion_view', {
        restaurantId: promotion.restaurantId,
        promotionId,
        userId,
      });
    }
  }
  
  /**
   * Record promotion click
   */
  static async recordClick(promotionId: string, userId?: string): Promise<void> {
    const promotion = await Promotion.findByIdAndUpdate(
      promotionId,
      { $inc: { clickCount: 1 } },
      { new: true }
    );
    
    if (promotion) {
      await recordAnalyticsEvent('promotion_click', {
        restaurantId: promotion.restaurantId,
        promotionId,
        userId,
      });
    }
  }
  
  /**
   * Use/redeem a promotion
   */
  static async redeemPromotion(
    promotionId: string, 
    userId: string,
    orderId?: string
  ): Promise<{ success: boolean; message: string; promotion?: IPromotion }> {
    const promotion = await Promotion.findById(promotionId);
    
    if (!promotion) {
      return { success: false, message: 'Promotion not found' };
    }
    
    const now = new Date();
    
    // Validation checks
    if (!promotion.isActive || !promotion.isApproved) {
      return { success: false, message: 'Promotion is not active' };
    }
    
    if (promotion.startDate > now || promotion.endDate < now) {
      return { success: false, message: 'Promotion has expired or not started' };
    }
    
    if (promotion.remainingQuantity !== undefined && promotion.remainingQuantity <= 0) {
      return { success: false, message: 'Promotion has sold out' };
    }
    
    // Update promotion
    const update: any = {
      $inc: { 
        usageCount: 1, 
        redemptionCount: 1,
      },
    };
    
    if (promotion.remainingQuantity !== undefined) {
      update.$inc.remainingQuantity = -1;
    }
    
    const updatedPromotion = await Promotion.findByIdAndUpdate(
      promotionId,
      update,
      { new: true }
    );
    
    // Record analytics
    await recordAnalyticsEvent('promotion_redeem', {
      restaurantId: promotion.restaurantId,
      promotionId,
      userId,
    });
    
    logger.info(`Promotion redeemed: ${promotionId} by user ${userId}`);
    
    return {
      success: true,
      message: 'Promotion redeemed successfully',
      promotion: updatedPromotion as IPromotion,
    };
  }
  
  /**
   * Create a new promotion (for restaurant admin)
   */
  static async createPromotion(data: Partial<IPromotion>): Promise<IPromotion> {
    const promotion = new Promotion({
      ...data,
      remainingQuantity: data.totalQuantity,
      isApproved: false,  // Requires admin approval
    });
    
    await promotion.save();
    logger.info(`New promotion created: ${promotion._id} for restaurant ${data.restaurantId}`);
    
    return promotion;
  }
  
  /**
   * Update promotion
   */
  static async updatePromotion(
    promotionId: string, 
    data: Partial<IPromotion>
  ): Promise<IPromotion | null> {
    const promotion = await Promotion.findByIdAndUpdate(
      promotionId,
      { $set: data },
      { new: true }
    );
    
    return promotion;
  }
  
  /**
   * Approve promotion (admin only)
   */
  static async approvePromotion(promotionId: string): Promise<IPromotion | null> {
    const promotion = await Promotion.findByIdAndUpdate(
      promotionId,
      { $set: { isApproved: true } },
      { new: true }
    );
    
    logger.info(`Promotion approved: ${promotionId}`);
    return promotion;
  }
  
  /**
   * Deactivate promotion
   */
  static async deactivatePromotion(promotionId: string): Promise<IPromotion | null> {
    const promotion = await Promotion.findByIdAndUpdate(
      promotionId,
      { $set: { isActive: false } },
      { new: true }
    );
    
    return promotion;
  }
  
  /**
   * Get promotions for a specific restaurant
   */
  static async getRestaurantPromotions(
    restaurantId: string,
    includeInactive: boolean = false
  ): Promise<IPromotion[]> {
    const query: any = { restaurantId };
    
    if (!includeInactive) {
      const now = new Date();
      query.isActive = true;
      query.isApproved = true;
      query.startDate = { $lte: now };
      query.endDate = { $gte: now };
    }
    
    const promotions = await Promotion.find(query)
      .sort({ priority: -1, createdAt: -1 })
      .lean();
    
    return promotions as unknown as IPromotion[];
  }
  
  /**
   * Check if user can use promotion
   */
  static async canUserUsePromotion(
    promotionId: string, 
    userId: string
  ): Promise<{ canUse: boolean; reason?: string }> {
    const promotion = await Promotion.findById(promotionId);
    
    if (!promotion) {
      return { canUse: false, reason: 'Promotion not found' };
    }
    
    const now = new Date();
    
    if (!promotion.isActive || !promotion.isApproved) {
      return { canUse: false, reason: 'Promotion is not active' };
    }
    
    if (promotion.startDate > now) {
      return { canUse: false, reason: 'Promotion has not started yet' };
    }
    
    if (promotion.endDate < now) {
      return { canUse: false, reason: 'Promotion has expired' };
    }
    
    if (promotion.remainingQuantity !== undefined && promotion.remainingQuantity <= 0) {
      return { canUse: false, reason: 'Promotion has sold out' };
    }
    
    // TODO: Check max usage per user
    // TODO: Check if user is new (for newUsersOnly promotions)
    
    return { canUse: true };
  }
}
