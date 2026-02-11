/**
 * Restaurant Package Model
 * 
 * Manages restaurant subscription packages for monetization:
 * - Premium listings (appear at top of search)
 * - New restaurant spotlight (featured in "New" section)
 * - Featured promotions
 * - Booking commission rates
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

// ============================================================================
// ENUMS & TYPES
// ============================================================================

export type PackageType = 
  | 'basic'           // Free - listed at bottom
  | 'new_spotlight'   // ฿2,500/month - NEW badge, featured section
  | 'premium'         // ฿1,500/month - top placement in search
  | 'premium_plus'    // ฿5,000/month - premium + push notifications
  | 'grand_opening';  // ฿8,000/week - banner + featured + notifications

export type PackageStatus = 'active' | 'expired' | 'pending' | 'cancelled';

export interface IPackagePricing {
  type: PackageType;
  name: string;
  nameEn: string;
  price: number;
  durationDays: number;
  features: string[];
  commissionRate: number;  // Percentage for bookings/coupons
  isActive: boolean;
}

export interface IRestaurantPackage extends Document {
  // Restaurant reference
  restaurantId: string;
  posVersion: 'v1' | 'v2';
  
  // Package info
  packageType: PackageType;
  status: PackageStatus;
  
  // Duration
  startDate: Date;
  endDate: Date;
  
  // Pricing
  price: number;
  commissionRate: number;
  
  // Payment
  paymentMethod?: string;
  paymentReference?: string;
  isPaid: boolean;
  paidAt?: Date;
  
  // Features unlocked
  features: {
    isPremiumListing: boolean;
    isNewSpotlight: boolean;
    hasPushNotifications: boolean;
    hasBannerAd: boolean;
    priorityRank: number;  // Lower = higher priority (0 = top)
  };
  
  // Analytics
  impressions: number;
  clicks: number;
  conversions: number;  // Bookings/orders from listing
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  isActive(): boolean;
  daysRemaining(): number;
}

// ============================================================================
// PACKAGE PRICING CONFIG
// ============================================================================

export const PACKAGE_PRICING: IPackagePricing[] = [
  {
    type: 'basic',
    name: 'ພື້ນຖານ',
    nameEn: 'Basic',
    price: 0,
    durationDays: 365,
    features: ['Listed in search', 'Basic profile'],
    commissionRate: 20,  // 20% commission
    isActive: true,
  },
  {
    type: 'new_spotlight',
    name: 'ໃໝ່ມາແຮງ',
    nameEn: 'New Restaurant Spotlight',
    price: 2500,
    durationDays: 30,
    features: ['NEW badge', 'Featured in New section', 'Priority in search'],
    commissionRate: 15,
    isActive: true,
  },
  {
    type: 'premium',
    name: 'ພຣີມຽມ',
    nameEn: 'Premium Listing',
    price: 1500,
    durationDays: 30,
    features: ['Top placement', 'PREMIUM badge', 'Analytics dashboard'],
    commissionRate: 12,
    isActive: true,
  },
  {
    type: 'premium_plus',
    name: 'ພຣີມຽມພິເສດ',
    nameEn: 'Premium Plus',
    price: 5000,
    durationDays: 30,
    features: ['Top placement', 'Push notifications to users', 'Banner in area', 'Full analytics'],
    commissionRate: 10,
    isActive: true,
  },
  {
    type: 'grand_opening',
    name: 'ເປີດໃໝ່ຍິ່ງໃຫຍ່',
    nameEn: 'Grand Opening Boost',
    price: 8000,
    durationDays: 7,
    features: ['Top banner', 'Push to all nearby users', 'Featured everywhere', 'Social media mention'],
    commissionRate: 8,
    isActive: true,
  },
];

// ============================================================================
// SCHEMA
// ============================================================================

const RestaurantPackageSchema = new Schema<IRestaurantPackage>(
  {
    restaurantId: {
      type: String,
      required: true,
      index: true,
    },
    posVersion: {
      type: String,
      enum: ['v1', 'v2'],
      required: true,
    },
    packageType: {
      type: String,
      enum: ['basic', 'new_spotlight', 'premium', 'premium_plus', 'grand_opening'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'pending', 'cancelled'],
      default: 'pending',
      index: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
      index: true,
    },
    price: {
      type: Number,
      required: true,
    },
    commissionRate: {
      type: Number,
      required: true,
      default: 20,
    },
    paymentMethod: {
      type: String,
    },
    paymentReference: {
      type: String,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    paidAt: {
      type: Date,
    },
    features: {
      isPremiumListing: { type: Boolean, default: false },
      isNewSpotlight: { type: Boolean, default: false },
      hasPushNotifications: { type: Boolean, default: false },
      hasBannerAd: { type: Boolean, default: false },
      priorityRank: { type: Number, default: 100 },
    },
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: 'restaurant_packages',
  }
);

// ============================================================================
// INDEXES
// ============================================================================

RestaurantPackageSchema.index({ restaurantId: 1, status: 1 });
RestaurantPackageSchema.index({ status: 1, endDate: 1 });
RestaurantPackageSchema.index({ 'features.isPremiumListing': 1, status: 1 });
RestaurantPackageSchema.index({ 'features.isNewSpotlight': 1, status: 1 });

// ============================================================================
// METHODS
// ============================================================================

RestaurantPackageSchema.methods.isActive = function(): boolean {
  return this.status === 'active' && 
         this.isPaid && 
         new Date() >= this.startDate && 
         new Date() <= this.endDate;
};

RestaurantPackageSchema.methods.daysRemaining = function(): number {
  if (!this.isActive()) return 0;
  const now = new Date();
  const diffTime = this.endDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// ============================================================================
// STATICS
// ============================================================================

interface IRestaurantPackageModel extends Model<IRestaurantPackage> {
  getActivePackage(restaurantId: string): Promise<IRestaurantPackage | null>;
  getPremiumRestaurants(limit?: number): Promise<IRestaurantPackage[]>;
  getNewSpotlightRestaurants(limit?: number): Promise<IRestaurantPackage[]>;
  createPackage(data: Partial<IRestaurantPackage>): Promise<IRestaurantPackage>;
  expireOldPackages(): Promise<number>;
}

/**
 * Get active package for a restaurant
 */
RestaurantPackageSchema.statics.getActivePackage = async function(
  restaurantId: string
): Promise<IRestaurantPackage | null> {
  const now = new Date();
  return this.findOne({
    restaurantId,
    status: 'active',
    isPaid: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
  }).sort({ 'features.priorityRank': 1 });
};

/**
 * Get all premium restaurants
 */
RestaurantPackageSchema.statics.getPremiumRestaurants = async function(
  limit: number = 20
): Promise<IRestaurantPackage[]> {
  const now = new Date();
  return this.find({
    status: 'active',
    isPaid: true,
    'features.isPremiumListing': true,
    startDate: { $lte: now },
    endDate: { $gte: now },
  })
    .sort({ 'features.priorityRank': 1, clicks: -1 })
    .limit(limit);
};

/**
 * Get new spotlight restaurants
 */
RestaurantPackageSchema.statics.getNewSpotlightRestaurants = async function(
  limit: number = 10
): Promise<IRestaurantPackage[]> {
  const now = new Date();
  return this.find({
    status: 'active',
    isPaid: true,
    'features.isNewSpotlight': true,
    startDate: { $lte: now },
    endDate: { $gte: now },
  })
    .sort({ startDate: -1 })
    .limit(limit);
};

/**
 * Create a new package
 */
RestaurantPackageSchema.statics.createPackage = async function(
  data: Partial<IRestaurantPackage>
): Promise<IRestaurantPackage> {
  const pricing = PACKAGE_PRICING.find(p => p.type === data.packageType);
  if (!pricing) {
    throw new Error('Invalid package type');
  }

  const startDate = data.startDate || new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + pricing.durationDays);

  const features = {
    isPremiumListing: ['premium', 'premium_plus', 'grand_opening'].includes(data.packageType!),
    isNewSpotlight: ['new_spotlight', 'grand_opening'].includes(data.packageType!),
    hasPushNotifications: ['premium_plus', 'grand_opening'].includes(data.packageType!),
    hasBannerAd: data.packageType === 'grand_opening',
    priorityRank: getPriorityRank(data.packageType!),
  };

  return this.create({
    ...data,
    price: pricing.price,
    commissionRate: pricing.commissionRate,
    startDate,
    endDate,
    features,
    status: pricing.price === 0 ? 'active' : 'pending',
    isPaid: pricing.price === 0,
  });
};

/**
 * Expire old packages (run daily via cron)
 */
RestaurantPackageSchema.statics.expireOldPackages = async function(): Promise<number> {
  const result = await this.updateMany(
    {
      status: 'active',
      endDate: { $lt: new Date() },
    },
    {
      $set: { status: 'expired' },
    }
  );
  return result.modifiedCount;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getPriorityRank(packageType: PackageType): number {
  switch (packageType) {
    case 'grand_opening': return 1;
    case 'premium_plus': return 10;
    case 'premium': return 20;
    case 'new_spotlight': return 30;
    case 'basic': return 100;
    default: return 100;
  }
}

// ============================================================================
// MODEL
// ============================================================================

const RestaurantPackage: IRestaurantPackageModel = mongoose.model<
  IRestaurantPackage,
  IRestaurantPackageModel
>('RestaurantPackage', RestaurantPackageSchema);

export default RestaurantPackage;
