import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISubscriptionItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unit: string;
  priceType: 'retail' | 'wholesale';
  unitPrice: number;
  itemTotal: number;
}

export interface IDeliverySchedule {
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  dayOfWeek?: number; // 0-6 for weekly (0 = Sunday)
  dayOfMonth?: number; // 1-31 for monthly
  timeSlot?: string; // e.g., "09:00-12:00"
  nextDeliveryDate: Date;
}

export interface ISubscription extends Document {
  subscriptionCode: string;
  userId: mongoose.Types.ObjectId;
  
  // Identity Context
  profileType: 'personal' | 'merchant';
  merchantProfileId?: mongoose.Types.ObjectId;
  
  // Items
  items: ISubscriptionItem[];
  
  // Pricing
  subtotal: number;
  deliveryFee: number;
  estimatedTotal: number; // Total per order
  
  // Delivery
  deliveryAddressId: mongoose.Types.ObjectId; // Reference to saved address
  deliverySchedule: IDeliverySchedule;
  
  // Payment
  paymentMethod: 'phapay' | 'cash' | 'credit_term';
  autoPayment: boolean; // Auto-charge on order generation
  
  // Status
  status: 'active' | 'paused' | 'cancelled';
  
  // Order Generation
  ordersGenerated: number; // Count of orders created
  lastOrderGeneratedAt?: Date;
  nextOrderScheduledAt: Date;
  
  // Lifecycle
  startDate: Date;
  endDate?: Date; // Optional: subscription end date
  pausedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  generateNextOrder(): Promise<mongoose.Types.ObjectId>; // Returns MarketOrder ID
  calculateNextDeliveryDate(): Date;
  pause(): Promise<ISubscription>;
  resume(): Promise<ISubscription>;
  cancel(reason?: string): Promise<ISubscription>;
  updateSchedule(schedule: Partial<IDeliverySchedule>): Promise<ISubscription>;
}

// Sub-schemas
const SubscriptionItemSchema = new Schema<ISubscriptionItem>(
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

const DeliveryScheduleSchema = new Schema<IDeliverySchedule>(
  {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'biweekly', 'monthly'],
      required: true,
    },
    dayOfWeek: {
      type: Number,
      min: 0,
      max: 6,
    },
    dayOfMonth: {
      type: Number,
      min: 1,
      max: 31,
    },
    timeSlot: {
      type: String,
      trim: true,
    },
    nextDeliveryDate: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { _id: false }
);

// Main Subscription Schema
const SubscriptionSchema = new Schema<ISubscription>(
  {
    subscriptionCode: {
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
    
    // Items
    items: {
      type: [SubscriptionItemSchema],
      required: true,
      validate: {
        validator: (items: ISubscriptionItem[]) => items.length > 0,
        message: 'Subscription must have at least one item',
      },
    },
    
    // Pricing
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    deliveryFee: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    estimatedTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    
    // Delivery
    deliveryAddressId: {
      type: Schema.Types.ObjectId,
      ref: 'DeliveryAddress',
      required: true,
    },
    deliverySchedule: {
      type: DeliveryScheduleSchema,
      required: true,
    },
    
    // Payment
    paymentMethod: {
      type: String,
      enum: ['phapay', 'cash', 'credit_term'],
      required: true,
    },
    autoPayment: {
      type: Boolean,
      default: false,
    },
    
    // Status
    status: {
      type: String,
      enum: ['active', 'paused', 'cancelled'],
      default: 'active',
      index: true,
    },
    
    // Order Generation
    ordersGenerated: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastOrderGeneratedAt: {
      type: Date,
    },
    nextOrderScheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    
    // Lifecycle
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
    pausedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'subscriptions',
  }
);

// Indexes
SubscriptionSchema.index({ userId: 1, status: 1, createdAt: -1 });
SubscriptionSchema.index({ status: 1, nextOrderScheduledAt: 1 }); // For order generation cron job
SubscriptionSchema.index({ profileType: 1, userId: 1 });
SubscriptionSchema.index({ subscriptionCode: 1 }, { unique: true });

// Methods
SubscriptionSchema.methods.calculateNextDeliveryDate = function (): Date {
  const schedule = this.deliverySchedule;
  const now = new Date();
  let nextDate = new Date(now);
  
  switch (schedule.frequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
      
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      if (schedule.dayOfWeek !== undefined) {
        // Adjust to specific day of week
        const currentDay = nextDate.getDay();
        const daysUntilTarget = (schedule.dayOfWeek - currentDay + 7) % 7;
        nextDate.setDate(nextDate.getDate() + daysUntilTarget);
      }
      break;
      
    case 'biweekly':
      nextDate.setDate(nextDate.getDate() + 14);
      break;
      
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      if (schedule.dayOfMonth !== undefined) {
        nextDate.setDate(schedule.dayOfMonth);
      }
      break;
  }
  
  // Set to start of day
  nextDate.setHours(0, 0, 0, 0);
  
  return nextDate;
};

SubscriptionSchema.methods.generateNextOrder = async function (): Promise<mongoose.Types.ObjectId> {
  // This will be implemented in the subscription service
  // It creates a new MarketOrder based on this subscription
  throw new Error('generateNextOrder must be called through SubscriptionService');
};

SubscriptionSchema.methods.pause = async function (): Promise<ISubscription> {
  this.status = 'paused';
  this.pausedAt = new Date();
  return await this.save();
};

SubscriptionSchema.methods.resume = async function (): Promise<ISubscription> {
  this.status = 'active';
  this.pausedAt = undefined;
  
  // Recalculate next delivery date
  this.deliverySchedule.nextDeliveryDate = this.calculateNextDeliveryDate();
  this.nextOrderScheduledAt = this.deliverySchedule.nextDeliveryDate;
  
  return await this.save();
};

SubscriptionSchema.methods.cancel = async function (reason?: string): Promise<ISubscription> {
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.cancellationReason = reason;
  return await this.save();
};

SubscriptionSchema.methods.updateSchedule = async function (
  schedule: Partial<IDeliverySchedule>
): Promise<ISubscription> {
  // Update schedule fields
  Object.assign(this.deliverySchedule, schedule);
  
  // Recalculate next delivery date if frequency changed
  if (schedule.frequency || schedule.dayOfWeek || schedule.dayOfMonth) {
    this.deliverySchedule.nextDeliveryDate = this.calculateNextDeliveryDate();
    this.nextOrderScheduledAt = this.deliverySchedule.nextDeliveryDate;
  }
  
  return await this.save();
};

// Pre-save middleware
SubscriptionSchema.pre('save', function (next) {
  // Calculate estimated total
  this.subtotal = this.items.reduce((sum, item) => sum + item.itemTotal, 0);
  this.estimatedTotal = this.subtotal + this.deliveryFee;
  
  // Sync nextOrderScheduledAt with deliverySchedule
  if (this.isModified('deliverySchedule.nextDeliveryDate')) {
    this.nextOrderScheduledAt = this.deliverySchedule.nextDeliveryDate;
  }
  
  next();
});

// Model
const Subscription: Model<ISubscription> = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);

export default Subscription;

