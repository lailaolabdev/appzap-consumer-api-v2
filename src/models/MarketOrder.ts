import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMarketOrderItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unit: string; // e.g., "kg", "piece", "box"
  priceType: 'retail' | 'wholesale';
  unitPrice: number;
  itemTotal: number;
}

export interface IDeliveryAddress {
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  district: string;
  city: string;
  province: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

export interface IDeliveryInfo {
  address: IDeliveryAddress;
  deliveryDate?: Date;
  deliveryTimeSlot?: string; // e.g., "09:00-12:00"
  deliveryMethod: 'standard' | 'express' | 'scheduled';
  deliveryFee: number;
  driverName?: string;
  driverPhone?: string;
  trackingNumber?: string;
}

export interface IMarketOrder extends Document {
  orderCode: string;
  userId: mongoose.Types.ObjectId;
  
  // Identity Context
  profileType: 'personal' | 'merchant'; // B2C vs B2B
  merchantProfileId?: mongoose.Types.ObjectId;
  
  // Order Type
  orderType: 'one_time' | 'subscription';
  subscriptionId?: mongoose.Types.ObjectId;
  
  // Items
  items: IMarketOrderItem[];
  
  // Pricing
  subtotal: number;
  discount: number;
  discountType?: string;
  deliveryFee: number;
  tax?: number;
  total: number;
  
  // Delivery
  deliveryInfo: IDeliveryInfo;
  
  // Payment
  paymentMethod: 'phapay' | 'cash' | 'credit_term';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentId?: string;
  paidAt?: Date;
  
  // Status
  status: 'pending' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'completed' | 'cancelled';
  
  // Supplier Integration
  supplierOrderId?: string;
  supplierSyncStatus: 'synced' | 'pending' | 'failed';
  supplierSyncError?: string;
  supplierSyncedAt?: Date;
  
  // Loyalty (only for B2C)
  pointsEarned?: number;
  pointsRedeemed?: number;
  
  // Attribution
  source?: string;
  referralCode?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  confirmedAt?: Date;
  deliveredAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  
  // Methods
  markAsPaid(paymentId: string): Promise<IMarketOrder>;
  syncToSupplier(): Promise<boolean>;
  calculatePointsEarned(): number;
  canEarnPoints(): boolean;
}

// Sub-schemas
const MarketOrderItemSchema = new Schema<IMarketOrderItem>(
  {
    productId: { type: String, required: true },
    sku: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String, required: true, trim: true },
    priceType: { type: String, enum: ['retail', 'wholesale'], required: true },
    unitPrice: { type: Number, required: true, min: 0 },
    itemTotal: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

const DeliveryAddressSchema = new Schema<IDeliveryAddress>(
  {
    recipientName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, trim: true },
    district: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    province: { type: String, required: true, trim: true },
    postalCode: { type: String, trim: true },
    latitude: { type: Number },
    longitude: { type: Number },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false }
);

const DeliveryInfoSchema = new Schema<IDeliveryInfo>(
  {
    address: { type: DeliveryAddressSchema, required: true },
    deliveryDate: { type: Date },
    deliveryTimeSlot: { type: String, trim: true },
    deliveryMethod: {
      type: String,
      enum: ['standard', 'express', 'scheduled'],
      default: 'standard',
    },
    deliveryFee: { type: Number, required: true, default: 0, min: 0 },
    driverName: { type: String, trim: true },
    driverPhone: { type: String, trim: true },
    trackingNumber: { type: String, trim: true },
  },
  { _id: false }
);

// Main Market Order Schema
const MarketOrderSchema = new Schema<IMarketOrder>(
  {
    orderCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    
    // Identity Context
    profileType: {
      type: String,
      enum: ['personal', 'merchant'],
      required: true,
      default: 'personal',
      index: true,
    },
    merchantProfileId: {
      type: Schema.Types.ObjectId,
      index: true,
    },
    
    // Order Type
    orderType: {
      type: String,
      enum: ['one_time', 'subscription'],
      required: true,
      default: 'one_time',
      index: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
      index: true,
    },
    
    // Items
    items: {
      type: [MarketOrderItemSchema],
      required: true,
      validate: {
        validator: (items: IMarketOrderItem[]) => items.length > 0,
        message: 'Order must have at least one item',
      },
    },
    
    // Pricing
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountType: {
      type: String,
      enum: ['voucher', 'loyalty', 'bulk', 'promotion'],
    },
    deliveryFee: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    
    // Delivery
    deliveryInfo: {
      type: DeliveryInfoSchema,
      required: true,
    },
    
    // Payment
    paymentMethod: {
      type: String,
      enum: ['phapay', 'cash', 'credit_term'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },
    paymentId: {
      type: String,
      trim: true,
    },
    paidAt: {
      type: Date,
    },
    
    // Status
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    
    // Supplier Integration
    supplierOrderId: {
      type: String,
      trim: true,
      index: true,
    },
    supplierSyncStatus: {
      type: String,
      enum: ['synced', 'pending', 'failed'],
      default: 'pending',
      index: true,
    },
    supplierSyncError: {
      type: String,
    },
    supplierSyncedAt: {
      type: Date,
    },
    
    // Loyalty (only for B2C)
    pointsEarned: {
      type: Number,
      default: 0,
      min: 0,
    },
    pointsRedeemed: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    // Attribution
    source: {
      type: String,
      enum: ['app', 'web', 'deeplink'],
      default: 'app',
    },
    referralCode: {
      type: String,
      trim: true,
    },
    
    // Completion
    confirmedAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'market_orders',
  }
);

// Indexes
MarketOrderSchema.index({ userId: 1, createdAt: -1 });
MarketOrderSchema.index({ status: 1, createdAt: -1 });
MarketOrderSchema.index({ paymentStatus: 1, createdAt: -1 });
MarketOrderSchema.index({ orderCode: 1 }, { unique: true });
MarketOrderSchema.index({ supplierSyncStatus: 1 });
MarketOrderSchema.index({ profileType: 1, userId: 1 });
MarketOrderSchema.index({ orderType: 1, subscriptionId: 1 });
MarketOrderSchema.index({ 'deliveryInfo.address.province': 1 });
MarketOrderSchema.index({ 'deliveryInfo.address.city': 1 });

// Methods
MarketOrderSchema.methods.markAsPaid = async function (paymentId: string): Promise<IMarketOrder> {
  this.paymentStatus = 'paid';
  this.paymentId = paymentId;
  this.paidAt = new Date();
  this.status = 'confirmed';
  this.confirmedAt = new Date();
  
  // Calculate points earned (only for B2C orders)
  if (this.canEarnPoints()) {
    this.pointsEarned = this.calculatePointsEarned();
  }
  
  return await this.save();
};

MarketOrderSchema.methods.canEarnPoints = function (): boolean {
  // Only personal (B2C) orders earn points
  // Merchant (B2B) orders don't earn points
  return this.profileType === 'personal';
};

MarketOrderSchema.methods.calculatePointsEarned = function (): number {
  // Only B2C orders earn points
  if (!this.canEarnPoints()) {
    return 0;
  }
  
  // Business logic: 1000 LAK = 1 point
  // Don't earn points on discounted amount
  const earnableAmount = this.total - (this.discount || 0);
  return Math.floor(earnableAmount / 1000);
};

MarketOrderSchema.methods.syncToSupplier = async function (): Promise<boolean> {
  try {
    // This will be implemented in the service layer
    // For now, just mark as pending
    this.supplierSyncStatus = 'pending';
    await this.save();
    return true;
  } catch (error) {
    this.supplierSyncStatus = 'failed';
    this.supplierSyncError = error instanceof Error ? error.message : 'Unknown error';
    await this.save();
    return false;
  }
};

// Virtual for order age
MarketOrderSchema.virtual('orderAge').get(function () {
  return Date.now() - this.createdAt.getTime();
});

// Model
const MarketOrder: Model<IMarketOrder> = mongoose.model<IMarketOrder>('MarketOrder', MarketOrderSchema);

export default MarketOrder;

