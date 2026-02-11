import mongoose, { Document, Schema } from 'mongoose';

/**
 * CouponPurchase - Tracks a user's purchased coupon
 * Each purchase generates a unique redemption code
 */
export type CouponPurchaseStatus = 
  | 'pending_payment'  // Awaiting payment
  | 'active'           // Purchased and ready to use
  | 'used'             // Fully redeemed
  | 'partially_used'   // For multi-use coupons
  | 'expired'          // Past validity date
  | 'refunded'         // Payment refunded
  | 'cancelled';       // Cancelled by user/admin

export interface ICouponPurchase extends Document {
  // User info
  userId: mongoose.Types.ObjectId;
  userPhone: string;
  userName?: string;
  
  // Coupon info (denormalized for history)
  couponId: mongoose.Types.ObjectId;
  restaurantId: string;
  posRestaurantId: string;
  posVersion: 'v1' | 'v2';
  restaurantName: string;
  couponTitle: string;
  
  // Value
  originalValue: number;
  purchasePrice: number;
  savings: number;
  
  // Redemption
  redemptionCode: string;  // Unique code for POS
  qrCodeData: string;  // QR code content
  status: CouponPurchaseStatus;
  
  // Usage tracking
  remainingValue: number;  // For partial redemptions
  usageHistory: Array<{
    usedAt: Date;
    amountUsed: number;
    orderId?: string;
    posOrderId?: string;
    usedBy?: string;  // Staff who processed
  }>;
  
  // Validity
  purchasedAt: Date;
  expiresAt: Date;
  
  // Payment
  paymentMethod: 'wallet' | 'card' | 'bank_transfer' | 'points';
  paymentReference?: string;
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  
  // Analytics
  viewedCount: number;  // How many times user viewed this coupon
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  usedAt?: Date;
  refundedAt?: Date;
}

const CouponPurchaseSchema = new Schema<ICouponPurchase>({
  // User info
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userPhone: { type: String, required: true },
  userName: { type: String },
  
  // Coupon info
  couponId: { type: Schema.Types.ObjectId, ref: 'Coupon', required: true, index: true },
  restaurantId: { type: String, required: true, index: true },
  posRestaurantId: { type: String, required: true },
  posVersion: { type: String, enum: ['v1', 'v2'], required: true },
  restaurantName: { type: String, required: true },
  couponTitle: { type: String, required: true },
  
  // Value
  originalValue: { type: Number, required: true },
  purchasePrice: { type: Number, required: true },
  savings: { type: Number, required: true },
  
  // Redemption
  redemptionCode: { type: String, required: true, unique: true, index: true },
  qrCodeData: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending_payment', 'active', 'used', 'partially_used', 'expired', 'refunded', 'cancelled'],
    default: 'pending_payment'
  },
  
  // Usage tracking
  remainingValue: { type: Number, required: true },
  usageHistory: [{
    usedAt: { type: Date, required: true },
    amountUsed: { type: Number, required: true },
    orderId: { type: String },
    posOrderId: { type: String },
    usedBy: { type: String },
  }],
  
  // Validity
  purchasedAt: { type: Date },
  expiresAt: { type: Date, required: true, index: true },
  
  // Payment
  paymentMethod: { 
    type: String, 
    enum: ['wallet', 'card', 'bank_transfer', 'points'],
    default: 'wallet'
  },
  paymentReference: { type: String },
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  
  // Analytics
  viewedCount: { type: Number, default: 0 },
  
  // Timestamps
  usedAt: { type: Date },
  refundedAt: { type: Date },
}, {
  timestamps: true,
});

// Compound indexes
CouponPurchaseSchema.index({ userId: 1, status: 1 });
CouponPurchaseSchema.index({ restaurantId: 1, status: 1 });
CouponPurchaseSchema.index({ status: 1, expiresAt: 1 });

// Generate unique redemption code
CouponPurchaseSchema.pre('save', function(next) {
  if (!this.redemptionCode) {
    // Format: AZ-XXXX-XXXX (easy to read/type)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'AZ-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    code += '-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.redemptionCode = code;
  }
  
  if (!this.qrCodeData) {
    // QR code contains: appzap://coupon/{redemptionCode}
    this.qrCodeData = `appzap://coupon/${this.redemptionCode}`;
  }
  
  if (!this.remainingValue) {
    this.remainingValue = this.originalValue;
  }
  
  next();
});

// Virtual for checking if coupon can be used
CouponPurchaseSchema.virtual('canBeUsed').get(function() {
  const now = new Date();
  return (
    this.status === 'active' &&
    this.paymentStatus === 'completed' &&
    this.expiresAt > now &&
    this.remainingValue > 0
  );
});

// Virtual for days until expiry
CouponPurchaseSchema.virtual('daysUntilExpiry').get(function() {
  const now = new Date();
  const diff = this.expiresAt.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Method to use coupon
CouponPurchaseSchema.methods.use = async function(
  amountToUse: number, 
  orderId?: string, 
  posOrderId?: string,
  usedBy?: string
) {
  if (amountToUse > this.remainingValue) {
    throw new Error('Amount exceeds remaining value');
  }
  
  this.usageHistory.push({
    usedAt: new Date(),
    amountUsed: amountToUse,
    orderId,
    posOrderId,
    usedBy,
  });
  
  this.remainingValue -= amountToUse;
  
  if (this.remainingValue <= 0) {
    this.status = 'used';
    this.usedAt = new Date();
  } else {
    this.status = 'partially_used';
  }
  
  await this.save();
  return this;
};

export const CouponPurchase = mongoose.model<ICouponPurchase>('CouponPurchase', CouponPurchaseSchema);
