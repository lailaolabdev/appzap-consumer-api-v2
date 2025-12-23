import mongoose, { Schema, Document, Model } from 'mongoose';
import { IDeliveryInfo } from './MarketOrder';
import { IDeliverySchedule, IPaymentPlan } from './Subscription';

export interface IMealSubscription extends Document {
  subscriptionCode: string;
  userId: mongoose.Types.ObjectId;
  healthProfileId?: mongoose.Types.ObjectId;
  
  // Meal Plan Reference
  mealPlanId: mongoose.Types.ObjectId;
  mealPlanCode: string;
  mealPlanName: string;
  
  // Subscription Details
  duration: number; // days
  mealsPerDay: number;
  totalMeals: number;
  
  // Delivery
  deliveryInfo: IDeliveryInfo;
  deliverySchedule: IDeliverySchedule[];
  nextDeliveryDate: Date;
  lastDeliveryDate?: Date;
  
  // Payment
  paymentPlan: IPaymentPlan;
  
  // Pricing
  planPrice: number;
  pricePerMeal: number;
  discount: number;
  total: number;
  
  // Supplements (optional add-ons)
  supplements?: {
    supplementId: mongoose.Types.ObjectId;
    name: string;
    quantity: number;
    price: number;
  }[];
  supplementsTotal: number;
  
  // Status
  status: 'active' | 'paused' | 'cancelled' | 'completed';
  
  // Auto-generation
  totalOrdersGenerated: number;
  startDate: Date;
  endDate?: Date;
  pausedAt?: Date;
  pausedReason?: string;
  cancelledAt?: Date;
  cancelledReason?: string;
  
  // Customization
  excludeIngredients?: string[];
  specialInstructions?: string;
  preferredDeliveryTime?: string;
  
  // Feedback & Ratings
  overallRating?: number;
  feedbackNotes?: string;
  
  // Attribution
  source?: string;
  referralCode?: string;
  campaignId?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  calculateNextDeliveryDate(): Date;
  generateMealOrder(): Promise<Document>; // Returns a MealOrder
  pause(reason?: string): Promise<IMealSubscription>;
  resume(): Promise<IMealSubscription>;
  cancel(reason?: string): Promise<IMealSubscription>;
  calculateTotals(): void;
  addSupplement(supplementId: string, quantity: number): Promise<IMealSubscription>;
  removeSupplement(supplementId: string): Promise<IMealSubscription>;
}

// Main MealSubscription Schema
const MealSubscriptionSchema = new Schema<IMealSubscription>(
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
    healthProfileId: {
      type: Schema.Types.ObjectId,
      ref: 'HealthProfile',
      index: true,
    },
    
    // Meal Plan Reference
    mealPlanId: {
      type: Schema.Types.ObjectId,
      ref: 'MealPlan',
      required: true,
      index: true,
    },
    mealPlanCode: {
      type: String,
      required: true,
      trim: true,
    },
    mealPlanName: {
      type: String,
      required: true,
      trim: true,
    },
    
    // Subscription Details
    duration: {
      type: Number,
      required: true,
      min: 1,
    },
    mealsPerDay: {
      type: Number,
      required: true,
      min: 2,
      max: 6,
    },
    totalMeals: {
      type: Number,
      required: true,
      min: 1,
    },
    
    // Delivery
    deliveryInfo: {
      type: Object,
      required: true,
    },
    deliverySchedule: {
      type: [Object],
      required: true,
    },
    nextDeliveryDate: {
      type: Date,
      required: true,
      index: true,
    },
    lastDeliveryDate: {
      type: Date,
    },
    
    // Payment
    paymentPlan: {
      type: Object,
      required: true,
    },
    
    // Pricing
    planPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    pricePerMeal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    
    // Supplements
    supplements: [
      {
        supplementId: {
          type: Schema.Types.ObjectId,
          ref: 'Supplement',
          required: true,
        },
        name: {
          type: String,
          required: true,
          trim: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
    supplementsTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    // Status
    status: {
      type: String,
      enum: ['active', 'paused', 'cancelled', 'completed'],
      default: 'active',
      index: true,
    },
    
    // Auto-generation
    totalOrdersGenerated: {
      type: Number,
      default: 0,
      min: 0,
    },
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
    pausedReason: {
      type: String,
      trim: true,
    },
    cancelledAt: {
      type: Date,
    },
    cancelledReason: {
      type: String,
      trim: true,
    },
    
    // Customization
    excludeIngredients: {
      type: [String],
      default: [],
    },
    specialInstructions: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    preferredDeliveryTime: {
      type: String,
      trim: true,
    },
    
    // Feedback & Ratings
    overallRating: {
      type: Number,
      min: 0,
      max: 5,
    },
    feedbackNotes: {
      type: String,
      trim: true,
    },
    
    // Attribution
    source: {
      type: String,
      enum: ['app', 'web', 'deeplink', 'referral'],
      default: 'app',
    },
    referralCode: {
      type: String,
      trim: true,
    },
    campaignId: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'meal_subscriptions',
  }
);

// Indexes
MealSubscriptionSchema.index({ userId: 1, status: 1, createdAt: -1 });
MealSubscriptionSchema.index({ mealPlanId: 1, status: 1 });
MealSubscriptionSchema.index({ status: 1, nextDeliveryDate: 1 });
MealSubscriptionSchema.index({ subscriptionCode: 1 }, { unique: true });

// Methods
MealSubscriptionSchema.methods.calculateTotals = function (): void {
  this.supplementsTotal = this.supplements?.reduce((sum, s) => sum + s.price * s.quantity, 0) || 0;
  this.total = this.planPrice - this.discount + this.supplementsTotal;
};

MealSubscriptionSchema.methods.calculateNextDeliveryDate = function (): Date {
  const now = new Date();
  let nextDate = new Date(this.nextDeliveryDate || now);
  
  // Find the next scheduled day/time (reusing logic from Subscription model)
  let foundNext = false;
  while (!foundNext) {
    for (const schedule of this.deliverySchedule) {
      const [hours, minutes] = schedule.time.split(':').map(Number);
      const candidateDate = new Date(nextDate);
      candidateDate.setDate(candidateDate.getDate() + ((schedule.dayOfWeek - candidateDate.getDay() + 7) % 7));
      candidateDate.setHours(hours, minutes, 0, 0);
      
      if (candidateDate > now) {
        nextDate = candidateDate;
        foundNext = true;
        break;
      }
    }
    if (!foundNext) {
      nextDate = new Date(nextDate.getTime() + 7 * 24 * 60 * 60 * 1000); // Next week
    }
  }
  
  return nextDate;
};

MealSubscriptionSchema.methods.generateMealOrder = async function (): Promise<Document> {
  // This will be implemented in the service layer
  throw new Error('Method not implemented. Use mealSubscriptionService.generateOrderFromSubscription');
};

MealSubscriptionSchema.methods.pause = async function (reason?: string): Promise<IMealSubscription> {
  this.status = 'paused';
  this.pausedAt = new Date();
  if (reason) {
    this.pausedReason = reason;
  }
  return await this.save();
};

MealSubscriptionSchema.methods.resume = async function (): Promise<IMealSubscription> {
  this.status = 'active';
  this.pausedAt = undefined;
  this.pausedReason = undefined;
  this.nextDeliveryDate = this.calculateNextDeliveryDate();
  return await this.save();
};

MealSubscriptionSchema.methods.cancel = async function (reason?: string): Promise<IMealSubscription> {
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  if (reason) {
    this.cancelledReason = reason;
  }
  
  // Decrement subscriber count on meal plan
  const MealPlan = mongoose.model('MealPlan');
  await MealPlan.findByIdAndUpdate(this.mealPlanId, {
    $inc: { currentSubscribers: -1 },
  });
  
  return await this.save();
};

MealSubscriptionSchema.methods.addSupplement = async function (
  supplementId: string,
  quantity: number
): Promise<IMealSubscription> {
  const Supplement = mongoose.model('Supplement');
  const supplement = await Supplement.findById(supplementId);
  
  if (!supplement) {
    throw new Error('Supplement not found');
  }
  
  // Check if already exists
  const existing = this.supplements?.find((s: any) => s.supplementId.toString() === supplementId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    if (!this.supplements) {
      this.supplements = [];
    }
    this.supplements.push({
      supplementId: supplement._id,
      name: supplement.name,
      quantity,
      price: supplement.price,
    });
  }
  
  this.calculateTotals();
  return await this.save();
};

MealSubscriptionSchema.methods.removeSupplement = async function (
  supplementId: string
): Promise<IMealSubscription> {
  if (this.supplements) {
    this.supplements = this.supplements.filter((s: any) => s.supplementId.toString() !== supplementId);
  }
  this.calculateTotals();
  return await this.save();
};

// Pre-save middleware
MealSubscriptionSchema.pre('save', function (next) {
  if (this.isModified('supplements') || this.isModified('planPrice') || this.isModified('discount')) {
    this.calculateTotals();
  }
  
  if (this.isModified('status') && this.status === 'active' && !this.nextDeliveryDate) {
    this.nextDeliveryDate = this.calculateNextDeliveryDate();
  }
  
  next();
});

// Model
const MealSubscription: Model<IMealSubscription> = mongoose.model<IMealSubscription>(
  'MealSubscription',
  MealSubscriptionSchema
);

export default MealSubscription;

