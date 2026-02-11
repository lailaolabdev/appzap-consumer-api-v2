import mongoose, { Document, Schema } from 'mongoose';

/**
 * Coupon - A purchasable voucher that consumers can buy at a discount
 * Example: Buy a ฿100 food voucher for ฿70 (30% savings)
 */
export interface ICoupon extends Document {
  // Restaurant info
  restaurantId: string;
  posRestaurantId: string;
  posVersion: 'v1' | 'v2';
  restaurantName: string;
  restaurantImage?: string;
  
  // Coupon details
  title: string;  // e.g., "฿100 Food Voucher"
  description: string;
  
  // Pricing
  originalValue: number;  // Face value (e.g., ฿100)
  sellingPrice: number;  // Purchase price (e.g., ฿70)
  discountPercentage: number;  // Calculated: (100 - 70) / 100 = 30%
  
  // Inventory
  totalQuantity: number;
  soldQuantity: number;
  remainingQuantity: number;
  maxPerUser: number;  // Max coupons one user can buy
  
  // Validity
  purchaseStartDate: Date;  // When can users start buying
  purchaseEndDate: Date;  // When purchase window closes
  validityDays: number;  // How many days after purchase is it valid
  expiryDate?: Date;  // Absolute expiry date (if set, overrides validityDays)
  
  // Usage rules
  minimumOrderAmount?: number;  // Min order to use coupon
  applicableItems?: string[];  // Specific items only
  applicableCategories?: string[];  // Specific categories only
  excludedItems?: string[];  // Items that can't use coupon
  canCombineWithOther: boolean;  // Can use with other promotions
  
  // Display
  image?: string;
  badge?: string;  // "BESTSELLER", "NEW", "LIMITED"
  priority: number;
  termsAndConditions?: string;
  
  // Status
  isActive: boolean;
  isApproved: boolean;
  isFeatured: boolean;
  
  // Revenue sharing
  appzapCommissionPercent: number;  // AppZap takes this % of sellingPrice
  restaurantRevenue: number;  // Calculated: sellingPrice * (1 - commission)
  
  // Analytics
  viewCount: number;
  purchaseCount: number;
  redemptionCount: number;
  totalRevenue: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<ICoupon>({
  // Restaurant info
  restaurantId: { type: String, required: true, index: true },
  posRestaurantId: { type: String, required: true },
  posVersion: { type: String, enum: ['v1', 'v2'], required: true },
  restaurantName: { type: String, required: true },
  restaurantImage: { type: String },
  
  // Coupon details
  title: { type: String, required: true },
  description: { type: String, required: true },
  
  // Pricing
  originalValue: { type: Number, required: true, min: 0 },
  sellingPrice: { type: Number, required: true, min: 0 },
  discountPercentage: { type: Number, required: true, min: 0, max: 100 },
  
  // Inventory
  totalQuantity: { type: Number, required: true, min: 1 },
  soldQuantity: { type: Number, default: 0 },
  remainingQuantity: { type: Number, required: true },
  maxPerUser: { type: Number, default: 5 },
  
  // Validity
  purchaseStartDate: { type: Date, required: true },
  purchaseEndDate: { type: Date, required: true },
  validityDays: { type: Number, required: true, default: 30 },
  expiryDate: { type: Date },
  
  // Usage rules
  minimumOrderAmount: { type: Number, min: 0 },
  applicableItems: [{ type: String }],
  applicableCategories: [{ type: String }],
  excludedItems: [{ type: String }],
  canCombineWithOther: { type: Boolean, default: false },
  
  // Display
  image: { type: String },
  badge: { type: String },
  priority: { type: Number, default: 0 },
  termsAndConditions: { type: String },
  
  // Status
  isActive: { type: Boolean, default: true },
  isApproved: { type: Boolean, default: false },
  isFeatured: { type: Boolean, default: false },
  
  // Revenue sharing (default: AppZap takes 15%)
  appzapCommissionPercent: { type: Number, default: 15, min: 0, max: 100 },
  restaurantRevenue: { type: Number, default: 0 },
  
  // Analytics
  viewCount: { type: Number, default: 0 },
  purchaseCount: { type: Number, default: 0 },
  redemptionCount: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
}, {
  timestamps: true,
});

// Indexes
CouponSchema.index({ isActive: 1, isApproved: 1, purchaseEndDate: 1 });
CouponSchema.index({ isFeatured: 1, priority: -1 });
CouponSchema.index({ remainingQuantity: 1 });

// Calculate discount percentage before save
CouponSchema.pre('save', function(next) {
  if (this.originalValue > 0) {
    this.discountPercentage = Math.round(
      ((this.originalValue - this.sellingPrice) / this.originalValue) * 100
    );
  }
  this.remainingQuantity = this.totalQuantity - this.soldQuantity;
  next();
});

// Virtual for checking if coupon is available for purchase
CouponSchema.virtual('isAvailable').get(function() {
  const now = new Date();
  return (
    this.isActive &&
    this.isApproved &&
    this.purchaseStartDate <= now &&
    this.purchaseEndDate >= now &&
    this.remainingQuantity > 0
  );
});

// Virtual for savings text
CouponSchema.virtual('savingsText').get(function() {
  const savings = this.originalValue - this.sellingPrice;
  return `Save ฿${savings} (${this.discountPercentage}% off)`;
});

export const Coupon = mongoose.model<ICoupon>('Coupon', CouponSchema);
