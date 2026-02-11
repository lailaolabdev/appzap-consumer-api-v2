import mongoose from 'mongoose';
import { Coupon, ICoupon } from '../models/Coupon';
import { CouponPurchase, ICouponPurchase, CouponPurchaseStatus } from '../models/CouponPurchase';
import { recordAnalyticsEvent, PromotionAnalytics } from '../models/PromotionAnalytics';
import User from '../models/User';
import logger from '../utils/logger';

/**
 * Coupon Service - Handles coupon marketplace operations
 */
export class CouponService {
  
  /**
   * Get available coupons for purchase
   */
  static async getAvailableCoupons(options: {
    restaurantId?: string;
    featured?: boolean;
    minDiscount?: number;
    page?: number;
    limit?: number;
    sortBy?: 'popular' | 'discount' | 'endingSoon' | 'price';
  } = {}): Promise<{ coupons: ICoupon[]; total: number; hasMore: boolean }> {
    const {
      restaurantId,
      featured,
      minDiscount,
      page = 1,
      limit = 20,
      sortBy = 'popular',
    } = options;
    
    const now = new Date();
    const query: any = {
      isActive: true,
      isApproved: true,
      purchaseStartDate: { $lte: now },
      purchaseEndDate: { $gte: now },
      remainingQuantity: { $gt: 0 },
    };
    
    if (restaurantId) {
      query.restaurantId = restaurantId;
    }
    if (featured) {
      query.isFeatured = true;
    }
    if (minDiscount) {
      query.discountPercentage = { $gte: minDiscount };
    }
    
    // Sort options
    let sort: any = {};
    switch (sortBy) {
      case 'discount':
        sort = { discountPercentage: -1 };
        break;
      case 'endingSoon':
        sort = { purchaseEndDate: 1 };
        break;
      case 'price':
        sort = { sellingPrice: 1 };
        break;
      case 'popular':
      default:
        sort = { purchaseCount: -1, priority: -1 };
    }
    
    const skip = (page - 1) * limit;
    
    const [coupons, total] = await Promise.all([
      Coupon.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Coupon.countDocuments(query),
    ]);
    
    return {
      coupons: coupons as unknown as ICoupon[],
      total,
      hasMore: skip + coupons.length < total,
    };
  }
  
  /**
   * Get featured/hot coupons for home page
   */
  static async getFeaturedCoupons(limit: number = 10): Promise<ICoupon[]> {
    const now = new Date();
    
    const coupons = await Coupon.find({
      isActive: true,
      isApproved: true,
      isFeatured: true,
      purchaseStartDate: { $lte: now },
      purchaseEndDate: { $gte: now },
      remainingQuantity: { $gt: 0 },
    })
    .sort({ priority: -1, purchaseCount: -1 })
    .limit(limit)
    .lean();
    
    return coupons as unknown as ICoupon[];
  }
  
  /**
   * Get coupon by ID
   */
  static async getCouponById(couponId: string): Promise<ICoupon | null> {
    const coupon = await Coupon.findById(couponId).lean();
    return coupon as ICoupon | null;
  }
  
  /**
   * Record coupon view
   */
  static async recordView(couponId: string, userId?: string): Promise<void> {
    const coupon = await Coupon.findByIdAndUpdate(
      couponId,
      { $inc: { viewCount: 1 } },
      { new: true }
    );
    
    if (coupon) {
      await recordAnalyticsEvent('coupon_view', {
        restaurantId: coupon.restaurantId,
        couponId,
        userId,
      });
    }
  }
  
  /**
   * Purchase a coupon
   */
  static async purchaseCoupon(
    couponId: string,
    userId: string,
    paymentMethod: 'wallet' | 'card' | 'bank_transfer' | 'points' = 'wallet',
    paymentReference?: string
  ): Promise<{ success: boolean; message: string; purchase?: ICouponPurchase }> {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Get coupon and user
      const [coupon, user] = await Promise.all([
        Coupon.findById(couponId).session(session),
        User.findById(userId).session(session),
      ]);
      
      if (!coupon) {
        await session.abortTransaction();
        return { success: false, message: 'Coupon not found' };
      }
      
      if (!user) {
        await session.abortTransaction();
        return { success: false, message: 'User not found' };
      }
      
      const now = new Date();
      
      // Validation
      if (!coupon.isActive || !coupon.isApproved) {
        await session.abortTransaction();
        return { success: false, message: 'Coupon is not available' };
      }
      
      if (coupon.purchaseStartDate > now || coupon.purchaseEndDate < now) {
        await session.abortTransaction();
        return { success: false, message: 'Coupon purchase period has ended' };
      }
      
      if (coupon.remainingQuantity <= 0) {
        await session.abortTransaction();
        return { success: false, message: 'Coupon has sold out' };
      }
      
      // Check max per user
      const userPurchaseCount = await CouponPurchase.countDocuments({
        userId: new mongoose.Types.ObjectId(userId),
        couponId: new mongoose.Types.ObjectId(couponId),
        status: { $nin: ['refunded', 'cancelled'] },
      }).session(session);
      
      if (userPurchaseCount >= coupon.maxPerUser) {
        await session.abortTransaction();
        return { success: false, message: `You can only purchase ${coupon.maxPerUser} of this coupon` };
      }
      
      // Calculate expiry
      let expiresAt: Date;
      if (coupon.expiryDate) {
        expiresAt = coupon.expiryDate;
      } else {
        expiresAt = new Date(now.getTime() + coupon.validityDays * 24 * 60 * 60 * 1000);
      }
      
      // Create purchase record
      const purchase = new CouponPurchase({
        userId: new mongoose.Types.ObjectId(userId),
        userPhone: user.phone,
        userName: user.fullName || user.phone,
        couponId: new mongoose.Types.ObjectId(couponId),
        restaurantId: coupon.restaurantId,
        posRestaurantId: coupon.posRestaurantId,
        posVersion: coupon.posVersion,
        restaurantName: coupon.restaurantName,
        couponTitle: coupon.title,
        originalValue: coupon.originalValue,
        purchasePrice: coupon.sellingPrice,
        savings: coupon.originalValue - coupon.sellingPrice,
        remainingValue: coupon.originalValue,
        expiresAt,
        paymentMethod,
        paymentReference,
        paymentStatus: 'completed',  // Assuming instant payment
        status: 'active',
        purchasedAt: now,
      });
      
      await purchase.save({ session });
      
      // Update coupon inventory
      await Coupon.findByIdAndUpdate(
        couponId,
        {
          $inc: {
            soldQuantity: 1,
            remainingQuantity: -1,
            purchaseCount: 1,
            totalRevenue: coupon.sellingPrice,
          },
        },
        { session }
      );
      
      // Record analytics
      await recordAnalyticsEvent('coupon_purchase', {
        restaurantId: coupon.restaurantId,
        couponId,
        userId,
        amount: coupon.sellingPrice,
      });
      
      await session.commitTransaction();
      
      logger.info(`Coupon purchased: ${purchase._id} by user ${userId}`);
      
      return {
        success: true,
        message: 'Coupon purchased successfully',
        purchase: purchase as ICouponPurchase,
      };
      
    } catch (error) {
      await session.abortTransaction();
      logger.error('Coupon purchase failed:', error);
      return { success: false, message: 'Purchase failed. Please try again.' };
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Get user's purchased coupons
   */
  static async getUserCoupons(
    userId: string,
    status?: CouponPurchaseStatus | 'usable'
  ): Promise<ICouponPurchase[]> {
    const query: any = { userId: new mongoose.Types.ObjectId(userId) };
    
    if (status === 'usable') {
      // Get coupons that can still be used
      const now = new Date();
      query.status = { $in: ['active', 'partially_used'] };
      query.expiresAt = { $gt: now };
      query.remainingValue = { $gt: 0 };
    } else if (status) {
      query.status = status;
    }
    
    const purchases = await CouponPurchase.find(query)
      .sort({ purchasedAt: -1 })
      .lean();
    
    return purchases as unknown as ICouponPurchase[];
  }
  
  /**
   * Get coupon purchase by redemption code (for POS)
   */
  static async getCouponByCode(code: string): Promise<ICouponPurchase | null> {
    const purchase = await CouponPurchase.findOne({
      redemptionCode: code.toUpperCase(),
    }).lean();
    
    return purchase as unknown as ICouponPurchase | null;
  }
  
  /**
   * Redeem coupon at POS
   */
  static async redeemCoupon(
    redemptionCode: string,
    amountToUse: number,
    posData: {
      orderId?: string;
      posOrderId?: string;
      usedBy?: string;
    }
  ): Promise<{ success: boolean; message: string; purchase?: ICouponPurchase }> {
    const purchase = await CouponPurchase.findOne({
      redemptionCode: redemptionCode.toUpperCase(),
    });
    
    if (!purchase) {
      return { success: false, message: 'Invalid coupon code' };
    }
    
    const now = new Date();
    
    // Validation
    if (purchase.status === 'used') {
      return { success: false, message: 'Coupon has already been fully used' };
    }
    
    if (purchase.status === 'expired' || purchase.expiresAt < now) {
      return { success: false, message: 'Coupon has expired' };
    }
    
    if (purchase.status === 'refunded') {
      return { success: false, message: 'Coupon has been refunded' };
    }
    
    if (purchase.paymentStatus !== 'completed') {
      return { success: false, message: 'Coupon payment is not complete' };
    }
    
    if (amountToUse > purchase.remainingValue) {
      return { 
        success: false, 
        message: `Cannot use ฿${amountToUse}. Only ฿${purchase.remainingValue} remaining on this coupon` 
      };
    }
    
    // Record usage
    purchase.usageHistory.push({
      usedAt: now,
      amountUsed: amountToUse,
      orderId: posData.orderId,
      posOrderId: posData.posOrderId,
      usedBy: posData.usedBy,
    });
    
    purchase.remainingValue -= amountToUse;
    
    if (purchase.remainingValue <= 0) {
      purchase.status = 'used';
      purchase.usedAt = now;
    } else {
      purchase.status = 'partially_used';
    }
    
    await purchase.save();
    
    // Record analytics
    await recordAnalyticsEvent('coupon_redeem', {
      restaurantId: purchase.restaurantId,
      couponId: purchase.couponId.toString(),
      userId: purchase.userId.toString(),
      amount: amountToUse,
    });
    
    // Update coupon redemption count
    await Coupon.findByIdAndUpdate(purchase.couponId, {
      $inc: { redemptionCount: 1 },
    });
    
    logger.info(`Coupon redeemed: ${redemptionCode} for ฿${amountToUse}`);
    
    return {
      success: true,
      message: `Successfully used ฿${amountToUse}. Remaining: ฿${purchase.remainingValue}`,
      purchase: purchase as ICouponPurchase,
    };
  }
  
  /**
   * Validate coupon code (for POS verification)
   */
  static async validateCouponCode(code: string): Promise<{
    valid: boolean;
    message: string;
    purchase?: ICouponPurchase;
  }> {
    const purchase = await CouponPurchase.findOne({
      redemptionCode: code.toUpperCase(),
    }).lean();
    
    if (!purchase) {
      return { valid: false, message: 'Invalid coupon code' };
    }
    
    const now = new Date();
    
    if (purchase.status === 'used') {
      return { valid: false, message: 'Coupon has been fully used', purchase: purchase as unknown as ICouponPurchase };
    }
    
    if (purchase.expiresAt < now) {
      return { valid: false, message: 'Coupon has expired', purchase: purchase as unknown as ICouponPurchase };
    }
    
    if (purchase.paymentStatus !== 'completed') {
      return { valid: false, message: 'Payment not completed', purchase: purchase as unknown as ICouponPurchase };
    }
    
    return {
      valid: true,
      message: `Valid coupon. Remaining value: ฿${purchase.remainingValue}`,
      purchase: purchase as unknown as ICouponPurchase,
    };
  }
  
  /**
   * Create a new coupon (for restaurant admin)
   */
  static async createCoupon(data: Partial<ICoupon>): Promise<ICoupon> {
    const coupon = new Coupon({
      ...data,
      remainingQuantity: data.totalQuantity,
      soldQuantity: 0,
      isApproved: false,  // Requires admin approval
    });
    
    await coupon.save();
    logger.info(`New coupon created: ${coupon._id} for restaurant ${data.restaurantId}`);
    
    return coupon;
  }
  
  /**
   * Update coupon
   */
  static async updateCoupon(couponId: string, data: Partial<ICoupon>): Promise<ICoupon | null> {
    const coupon = await Coupon.findByIdAndUpdate(
      couponId,
      { $set: data },
      { new: true }
    );
    
    return coupon;
  }
  
  /**
   * Approve coupon (admin only)
   */
  static async approveCoupon(couponId: string): Promise<ICoupon | null> {
    const coupon = await Coupon.findByIdAndUpdate(
      couponId,
      { $set: { isApproved: true } },
      { new: true }
    );
    
    logger.info(`Coupon approved: ${couponId}`);
    return coupon;
  }
  
  /**
   * Get coupons for a restaurant (admin view)
   */
  static async getRestaurantCoupons(
    restaurantId: string,
    includeInactive: boolean = false
  ): Promise<ICoupon[]> {
    const query: any = { restaurantId };
    
    if (!includeInactive) {
      query.isActive = true;
    }
    
    const coupons = await Coupon.find(query)
      .sort({ createdAt: -1 })
      .lean();
    
    return coupons as unknown as ICoupon[];
  }
  
  /**
   * Check and expire old coupons (scheduled job)
   */
  static async expireOldPurchases(): Promise<number> {
    const now = new Date();
    
    const result = await CouponPurchase.updateMany(
      {
        status: { $in: ['active', 'partially_used'] },
        expiresAt: { $lt: now },
      },
      { $set: { status: 'expired' } }
    );
    
    logger.info(`Expired ${result.modifiedCount} coupon purchases`);
    return result.modifiedCount;
  }
}
