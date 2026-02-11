import mongoose, { Document, Schema } from 'mongoose';

/**
 * Promotion Types:
 * - percentage_off: e.g., 20% off all items
 * - fixed_amount_off: e.g., ฿50 off orders over ฿200
 * - buy_x_get_y: e.g., Buy 1 Get 1 Free
 * - free_item: e.g., Free drink with any meal
 * - flash_sale: Time-limited deep discount
 */
export type PromotionType = 
  | 'percentage_off' 
  | 'fixed_amount_off' 
  | 'buy_x_get_y' 
  | 'free_item' 
  | 'flash_sale';

export interface IPromotion extends Document {
  // Restaurant info
  restaurantId: string;  // Consumer API restaurant ID
  posRestaurantId: string;  // POS restaurant ID
  posVersion: 'v1' | 'v2';
  restaurantName: string;
  restaurantImage?: string;
  
  // Promotion details
  title: string;
  description: string;
  type: PromotionType;
  
  // Discount values
  discountPercentage?: number;  // For percentage_off
  discountAmount?: number;  // For fixed_amount_off
  minimumOrderAmount?: number;
  freeItemName?: string;  // For free_item
  buyQuantity?: number;  // For buy_x_get_y
  getQuantity?: number;  // For buy_x_get_y
  
  // Validity
  startDate: Date;
  endDate: Date;
  isFlashSale: boolean;
  flashSaleEndsAt?: Date;
  
  // Availability
  totalQuantity?: number;  // null = unlimited
  remainingQuantity?: number;
  usageCount: number;
  
  // Conditions
  applicableItems?: string[];  // Item IDs, empty = all items
  applicableCategories?: string[];
  maxUsagePerUser?: number;
  newUsersOnly: boolean;
  
  // Display
  image?: string;
  badge?: string;  // e.g., "HOT", "NEW", "LIMITED"
  priority: number;  // For sorting
  
  // Status
  isActive: boolean;
  isApproved: boolean;  // Admin approval required
  
  // Analytics
  viewCount: number;
  clickCount: number;
  redemptionCount: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const PromotionSchema = new Schema<IPromotion>({
  // Restaurant info
  restaurantId: { type: String, required: true, index: true },
  posRestaurantId: { type: String, required: true },
  posVersion: { type: String, enum: ['v1', 'v2'], required: true },
  restaurantName: { type: String, required: true },
  restaurantImage: { type: String },
  
  // Promotion details
  title: { type: String, required: true },
  description: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['percentage_off', 'fixed_amount_off', 'buy_x_get_y', 'free_item', 'flash_sale'],
    required: true 
  },
  
  // Discount values
  discountPercentage: { type: Number, min: 0, max: 100 },
  discountAmount: { type: Number, min: 0 },
  minimumOrderAmount: { type: Number, min: 0, default: 0 },
  freeItemName: { type: String },
  buyQuantity: { type: Number, min: 1 },
  getQuantity: { type: Number, min: 1 },
  
  // Validity
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isFlashSale: { type: Boolean, default: false },
  flashSaleEndsAt: { type: Date },
  
  // Availability
  totalQuantity: { type: Number },
  remainingQuantity: { type: Number },
  usageCount: { type: Number, default: 0 },
  
  // Conditions
  applicableItems: [{ type: String }],
  applicableCategories: [{ type: String }],
  maxUsagePerUser: { type: Number },
  newUsersOnly: { type: Boolean, default: false },
  
  // Display
  image: { type: String },
  badge: { type: String },
  priority: { type: Number, default: 0 },
  
  // Status
  isActive: { type: Boolean, default: true },
  isApproved: { type: Boolean, default: false },
  
  // Analytics
  viewCount: { type: Number, default: 0 },
  clickCount: { type: Number, default: 0 },
  redemptionCount: { type: Number, default: 0 },
}, {
  timestamps: true,
});

// Indexes for efficient queries
PromotionSchema.index({ isActive: 1, isApproved: 1, endDate: 1 });
PromotionSchema.index({ isFlashSale: 1, flashSaleEndsAt: 1 });
PromotionSchema.index({ type: 1 });
PromotionSchema.index({ priority: -1 });

// Virtual for checking if promotion is currently valid
PromotionSchema.virtual('isValid').get(function() {
  const now = new Date();
  return (
    this.isActive && 
    this.isApproved && 
    this.startDate <= now && 
    this.endDate >= now &&
    (this.remainingQuantity === undefined || this.remainingQuantity > 0)
  );
});

// Virtual for calculating discount display text
PromotionSchema.virtual('discountText').get(function() {
  switch (this.type) {
    case 'percentage_off':
      return `${this.discountPercentage}% OFF`;
    case 'fixed_amount_off':
      return `฿${this.discountAmount} OFF`;
    case 'buy_x_get_y':
      return `Buy ${this.buyQuantity} Get ${this.getQuantity} Free`;
    case 'free_item':
      return `FREE ${this.freeItemName}`;
    case 'flash_sale':
      return `${this.discountPercentage}% OFF`;
    default:
      return 'Special Offer';
  }
});

export const Promotion = mongoose.model<IPromotion>('Promotion', PromotionSchema);
