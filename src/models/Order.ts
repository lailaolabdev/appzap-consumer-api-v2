import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOrderModifier {
  id: string;
  name: string;
  price: number;
}

export interface IOrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  modifiers: IOrderModifier[];
  specialInstructions?: string;
  itemTotal: number;
  status: 'pending' | 'cooking' | 'ready' | 'served';
}

export interface ISupplementItem {
  supplementId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface ISplitDetail {
  userId: mongoose.Types.ObjectId;
  amount: number;
  status: 'pending' | 'paid' | 'failed';
  paymentId?: string;
  paidAt?: Date;
}

export interface IOrder extends Document {
  orderCode: string;
  userId: mongoose.Types.ObjectId;
  
  // Order Details
  orderType: 'dine_in' | 'takeaway' | 'subscription';
  productType: 'eats' | 'live';
  
  // Restaurant
  restaurantId: string;
  restaurantName?: string;
  tableId?: string;
  
  // Items
  items: IOrderItem[];
  supplements?: ISupplementItem[];
  
  // Pricing
  subtotal: number;
  discount: number;
  discountType?: string;
  tip?: number;
  serviceCharge?: number;
  tax?: number;
  total: number;
  
  // Loyalty
  pointsEarned?: number;
  pointsRedeemed?: number;
  
  // Payment
  paymentMethod: 'phapay' | 'cash' | 'credit_term';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentId?: string;
  paidAt?: Date;
  
  // Status
  status: 'pending' | 'confirmed' | 'cooking' | 'ready' | 'served' | 'completed' | 'cancelled';
  
  // POS Integration
  posOrderId?: string;
  posSyncStatus: 'synced' | 'pending' | 'failed';
  posSyncError?: string;
  posSyncedAt?: Date;
  
  // Split Bill
  isSplit: boolean;
  splitDetails?: ISplitDetail[];
  
  // Deep Link Attribution
  source?: string;
  referralCode?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  
  // Methods
  markAsPaid(paymentId: string): Promise<IOrder>;
  syncToPOS(): Promise<boolean>;
  calculatePointsEarned(): number;
}

// Sub-schemas
const OrderModifierSchema = new Schema<IOrderModifier>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const OrderItemSchema = new Schema<IOrderItem>(
  {
    menuItemId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    modifiers: [OrderModifierSchema],
    specialInstructions: { type: String, trim: true, maxlength: 500 },
    itemTotal: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'cooking', 'ready', 'served'],
      default: 'pending',
    },
  },
  { _id: true }
);

const SupplementItemSchema = new Schema<ISupplementItem>(
  {
    supplementId: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

const SplitDetailSchema = new Schema<ISplitDetail>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },
    paymentId: { type: String },
    paidAt: { type: Date },
  },
  { _id: true }
);

// Main Order Schema
const OrderSchema = new Schema<IOrder>(
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
    
    // Order Details
    orderType: {
      type: String,
      enum: ['dine_in', 'takeaway', 'subscription'],
      required: true,
    },
    productType: {
      type: String,
      enum: ['eats', 'live'],
      default: 'eats',
    },
    
    // Restaurant
    restaurantId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    restaurantName: {
      type: String,
      trim: true,
    },
    tableId: {
      type: String,
      trim: true,
    },
    
    // Items
    items: {
      type: [OrderItemSchema],
      required: true,
      validate: {
        validator: (items: IOrderItem[]) => items.length > 0,
        message: 'Order must have at least one item',
      },
    },
    supplements: [SupplementItemSchema],
    
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
      enum: ['voucher', 'loyalty', 'app_download', 'promotion'],
    },
    tip: {
      type: Number,
      default: 0,
      min: 0,
    },
    serviceCharge: {
      type: Number,
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
    
    // Loyalty
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
      enum: ['pending', 'confirmed', 'cooking', 'ready', 'served', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    
    // POS Integration
    posOrderId: {
      type: String,
      trim: true,
    },
    posSyncStatus: {
      type: String,
      enum: ['synced', 'pending', 'failed'],
      default: 'pending',
      index: true,
    },
    posSyncError: {
      type: String,
    },
    posSyncedAt: {
      type: Date,
    },
    
    // Split Bill
    isSplit: {
      type: Boolean,
      default: false,
    },
    splitDetails: [SplitDetailSchema],
    
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
    completedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'orders',
  }
);

// Indexes
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ paymentStatus: 1, createdAt: -1 });
OrderSchema.index({ restaurantId: 1, status: 1 });
OrderSchema.index({ orderCode: 1 }, { unique: true });
OrderSchema.index({ posSyncStatus: 1 });

// Methods
OrderSchema.methods.markAsPaid = async function (paymentId: string): Promise<IOrder> {
  this.paymentStatus = 'paid';
  this.paymentId = paymentId;
  this.paidAt = new Date();
  this.status = 'confirmed';
  
  // Calculate points earned
  this.pointsEarned = this.calculatePointsEarned();
  
  return await this.save();
};

OrderSchema.methods.calculatePointsEarned = function (): number {
  // Business logic: 1000 LAK = 1 point
  // Don't earn points on discounted amount
  const earnableAmount = this.total - (this.discount || 0);
  return Math.floor(earnableAmount / 1000);
};

OrderSchema.methods.syncToPOS = async function (): Promise<boolean> {
  try {
    // This will be implemented in the service layer
    // For now, just mark as pending
    this.posSyncStatus = 'pending';
    await this.save();
    return true;
  } catch (error) {
    this.posSyncStatus = 'failed';
    this.posSyncError = error instanceof Error ? error.message : 'Unknown error';
    await this.save();
    return false;
  }
};

// Virtual for order age
OrderSchema.virtual('orderAge').get(function () {
  return Date.now() - this.createdAt.getTime();
});

// Model
const Order: Model<IOrder> = mongoose.model<IOrder>('Order', OrderSchema);

export default Order;

