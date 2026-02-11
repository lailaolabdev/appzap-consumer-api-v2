import mongoose, { Document, Schema } from 'mongoose';

/**
 * PromotionAnalytics - Daily aggregated analytics for promotions
 */
export interface IPromotionAnalytics extends Document {
  // Reference
  promotionId?: mongoose.Types.ObjectId;  // null for aggregate stats
  couponId?: mongoose.Types.ObjectId;  // null for aggregate stats
  restaurantId: string;
  
  // Time period
  date: Date;  // The day this record represents
  period: 'daily' | 'weekly' | 'monthly';
  
  // Promotion metrics
  promotionViews: number;
  promotionClicks: number;
  promotionRedemptions: number;
  promotionClickRate: number;  // clicks / views
  promotionRedemptionRate: number;  // redemptions / clicks
  
  // Coupon metrics
  couponViews: number;
  couponPurchases: number;
  couponRedemptions: number;
  couponPurchaseRate: number;  // purchases / views
  couponRedemptionRate: number;  // redemptions / purchases
  
  // Revenue metrics
  couponSalesRevenue: number;  // Total from coupon sales
  appzapCommission: number;  // AppZap's cut
  restaurantRevenue: number;  // Restaurant's cut
  couponFaceValueRedeemed: number;  // Total face value used
  
  // User metrics
  uniqueViewers: number;
  uniqueBuyers: number;
  newUserPurchases: number;
  repeatUserPurchases: number;
  
  // Engagement
  averageTimeToRedeem: number;  // Hours from purchase to redemption
  abandonedCarts: number;  // Started purchase but didn't complete
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const PromotionAnalyticsSchema = new Schema<IPromotionAnalytics>({
  // Reference
  promotionId: { type: Schema.Types.ObjectId, ref: 'Promotion', index: true },
  couponId: { type: Schema.Types.ObjectId, ref: 'Coupon', index: true },
  restaurantId: { type: String, required: true, index: true },
  
  // Time period
  date: { type: Date, required: true, index: true },
  period: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'daily' },
  
  // Promotion metrics
  promotionViews: { type: Number, default: 0 },
  promotionClicks: { type: Number, default: 0 },
  promotionRedemptions: { type: Number, default: 0 },
  promotionClickRate: { type: Number, default: 0 },
  promotionRedemptionRate: { type: Number, default: 0 },
  
  // Coupon metrics
  couponViews: { type: Number, default: 0 },
  couponPurchases: { type: Number, default: 0 },
  couponRedemptions: { type: Number, default: 0 },
  couponPurchaseRate: { type: Number, default: 0 },
  couponRedemptionRate: { type: Number, default: 0 },
  
  // Revenue metrics
  couponSalesRevenue: { type: Number, default: 0 },
  appzapCommission: { type: Number, default: 0 },
  restaurantRevenue: { type: Number, default: 0 },
  couponFaceValueRedeemed: { type: Number, default: 0 },
  
  // User metrics
  uniqueViewers: { type: Number, default: 0 },
  uniqueBuyers: { type: Number, default: 0 },
  newUserPurchases: { type: Number, default: 0 },
  repeatUserPurchases: { type: Number, default: 0 },
  
  // Engagement
  averageTimeToRedeem: { type: Number, default: 0 },
  abandonedCarts: { type: Number, default: 0 },
}, {
  timestamps: true,
});

// Compound indexes for efficient querying
PromotionAnalyticsSchema.index({ restaurantId: 1, date: -1 });
PromotionAnalyticsSchema.index({ promotionId: 1, date: -1 });
PromotionAnalyticsSchema.index({ couponId: 1, date: -1 });
PromotionAnalyticsSchema.index({ date: -1, period: 1 });

// Calculate rates before save
PromotionAnalyticsSchema.pre('save', function(next) {
  // Promotion rates
  if (this.promotionViews > 0) {
    this.promotionClickRate = (this.promotionClicks / this.promotionViews) * 100;
  }
  if (this.promotionClicks > 0) {
    this.promotionRedemptionRate = (this.promotionRedemptions / this.promotionClicks) * 100;
  }
  
  // Coupon rates
  if (this.couponViews > 0) {
    this.couponPurchaseRate = (this.couponPurchases / this.couponViews) * 100;
  }
  if (this.couponPurchases > 0) {
    this.couponRedemptionRate = (this.couponRedemptions / this.couponPurchases) * 100;
  }
  
  next();
});

export const PromotionAnalytics = mongoose.model<IPromotionAnalytics>('PromotionAnalytics', PromotionAnalyticsSchema);


/**
 * Helper function to record analytics event
 */
export async function recordAnalyticsEvent(
  event: 'promotion_view' | 'promotion_click' | 'promotion_redeem' | 
         'coupon_view' | 'coupon_purchase' | 'coupon_redeem',
  data: {
    restaurantId: string;
    promotionId?: string;
    couponId?: string;
    userId?: string;
    amount?: number;
  }
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const update: any = {};
  
  switch (event) {
    case 'promotion_view':
      update.$inc = { promotionViews: 1 };
      break;
    case 'promotion_click':
      update.$inc = { promotionClicks: 1 };
      break;
    case 'promotion_redeem':
      update.$inc = { promotionRedemptions: 1 };
      break;
    case 'coupon_view':
      update.$inc = { couponViews: 1 };
      break;
    case 'coupon_purchase':
      update.$inc = { 
        couponPurchases: 1,
        couponSalesRevenue: data.amount || 0,
      };
      break;
    case 'coupon_redeem':
      update.$inc = { 
        couponRedemptions: 1,
        couponFaceValueRedeemed: data.amount || 0,
      };
      break;
  }
  
  await PromotionAnalytics.findOneAndUpdate(
    {
      restaurantId: data.restaurantId,
      promotionId: data.promotionId ? new mongoose.Types.ObjectId(data.promotionId) : null,
      couponId: data.couponId ? new mongoose.Types.ObjectId(data.couponId) : null,
      date: today,
      period: 'daily',
    },
    {
      ...update,
      $setOnInsert: {
        restaurantId: data.restaurantId,
        promotionId: data.promotionId,
        couponId: data.couponId,
        date: today,
        period: 'daily',
      },
    },
    { upsert: true, new: true }
  );
}
