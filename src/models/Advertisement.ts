import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Ad Types
 */
export type AdType = 
  | 'banner'        // Banner ads (various sizes)
  | 'popup'         // Full-screen popup
  | 'interstitial'  // Between-screen ads
  | 'native'        // In-feed native ads
  | 'sponsored';    // Sponsored listings

/**
 * Ad Placements
 * Organized by product vertical for sponsor management
 */
export type AdPlacement = 
  // Home Hub Placements
  | 'home_top'              // Top of home screen
  | 'home_middle'           // Middle section
  | 'home_bottom'           // Bottom section
  | 'home_featured_deal'    // Featured deal card
  
  // AppZap Eat Placements (Heineken primary)
  | 'eat_hero_banner'       // Eat hub top carousel
  | 'eat_deal_card'         // Sponsored deal in deals tab
  | 'eat_restaurant_badge'  // Badge on restaurant listings
  | 'eat_menu_highlight'    // Drink menu product highlight
  | 'eat_checkout_upsell'   // Checkout page upsell
  | 'eat_confirmation'      // Order confirmation banner
  | 'eat_between_listings'  // Between restaurant listings
  
  // AppZap Activity Placements
  | 'activity_hero_banner'  // Activity hub top
  | 'activity_event_sponsor'// Event listing sponsor
  | 'activity_tour_card'    // Sponsored tour card
  | 'activity_confirmation' // Booking confirmation
  
  // AppZap Stay Placements
  | 'stay_hero_banner'      // Stay hub top
  | 'stay_hotel_badge'      // Badge on hotel listings
  | 'stay_deal_card'        // Sponsored deal
  | 'stay_confirmation'     // Booking confirmation
  
  // AppZap Market Placements
  | 'market_hero_banner'    // Market hub top
  | 'market_category_sponsor'// Category sponsor
  | 'market_checkout'       // Checkout upsell
  
  // Legacy/Generic Placements
  | 'discover_top'          // Top of discover tab
  | 'discover_banner'       // Discover banner
  | 'search_results'        // In search results
  | 'detail_page'           // On detail pages
  | 'category_page'         // On category pages
  | 'checkout'              // Checkout flow
  | 'app_open'              // On app open (popup)
  | 'between_sections';     // Between content sections

/**
 * Ad Status
 */
export type AdStatus = 
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'active'
  | 'paused'
  | 'ended'
  | 'rejected';

/**
 * Pricing Type
 */
export type PricingType = 
  | 'cpm'      // Cost per 1000 impressions
  | 'cpc'      // Cost per click
  | 'cpa'      // Cost per action/conversion
  | 'flat';    // Flat fee

/**
 * Ad Content Interface
 */
export interface IAdContent {
  imageUrl: string;
  imageUrlMobile?: string;    // Different size for mobile
  title?: string;
  subtitle?: string;
  description?: string;
  ctaText?: string;           // "Learn More", "Book Now", "Get Coupon"
  ctaUrl?: string;            // Deep link or URL
  backgroundColor?: string;   // For native ads
  textColor?: string;
}

/**
 * Ad Targeting Interface
 */
export interface IAdTargeting {
  provinces?: string[];       // Target specific provinces
  landmarks?: string[];       // Target users near landmarks
  userTypes?: ('new' | 'returning' | 'premium' | 'inactive')[];
  languages?: string[];       // Target by user language
  nationalities?: string[];   // Target tourists from specific countries
  ageRange?: {
    min?: number;
    max?: number;
  };
  genders?: ('male' | 'female' | 'other')[];
  interests?: string[];       // Based on user behavior
  devices?: ('ios' | 'android')[];
}

/**
 * Ad Schedule Interface
 */
export interface IAdSchedule {
  startDate: Date;
  endDate: Date;
  timezone?: string;
  daysOfWeek?: number[];      // 0=Sunday, 6=Saturday
  hoursOfDay?: number[];      // 0-23
}

/**
 * Ad Budget Interface
 */
export interface IAdBudget {
  daily?: number;             // Daily budget limit
  total?: number;             // Total budget limit
  currency: 'LAK' | 'USD';
  spent: number;              // Amount spent so far
}

/**
 * Ad Pricing Interface
 */
export interface IAdPricing {
  type: PricingType;
  amount: number;
  currency: 'LAK' | 'USD';
}

/**
 * Ad Stats Interface
 */
export interface IAdStats {
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;                // Click-through rate
  conversionRate: number;
  revenue: number;            // Revenue generated
}

/**
 * Advertiser Info Interface
 */
export interface IAdvertiser {
  name: string;
  companyName?: string;
  phone: string;
  email: string;
  userId?: mongoose.Types.ObjectId;
}

/**
 * Advertisement Interface
 */
export interface IAdvertisement extends Document {
  // Basic Info
  name: string;               // Internal name
  description?: string;       // Internal description
  
  // Advertiser (inline for backward compat)
  advertiser: IAdvertiser;
  
  // Sponsor Reference (new - links to Advertiser collection)
  sponsorId?: mongoose.Types.ObjectId;
  
  // Ad Type & Placement
  type: AdType;
  placement: AdPlacement;
  size?: string;              // "320x50", "300x250", etc.
  
  // Content
  content: IAdContent;
  
  // Targeting
  targeting: IAdTargeting;
  
  // Schedule
  schedule: IAdSchedule;
  
  // Budget & Pricing
  budget?: IAdBudget;
  pricing: IAdPricing;
  
  // Priority & Ordering
  priority: number;           // Higher = shown first (1-100)
  weight: number;             // For random selection (1-100)
  
  // Stats
  stats: IAdStats;
  
  // Frequency Capping
  frequencyCap?: {
    impressionsPerUser: number;
    timeWindowHours: number;
  };
  
  // Status
  status: AdStatus;
  rejectionReason?: string;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  
  // Linked Entity (for sponsored listings)
  linkedEntityType?: 'restaurant' | 'hotel' | 'activity' | 'coupon';
  linkedEntityId?: mongoose.Types.ObjectId;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  isActive(): boolean;
  trackImpression(): Promise<void>;
  trackClick(): Promise<void>;
  trackConversion(revenue?: number): Promise<void>;
}

/**
 * Ad Content Schema
 */
const AdContentSchema = new Schema<IAdContent>(
  {
    imageUrl: { type: String, required: true, trim: true },
    imageUrlMobile: { type: String, trim: true },
    title: { type: String, trim: true, maxlength: 100 },
    subtitle: { type: String, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 300 },
    ctaText: { type: String, trim: true, maxlength: 30 },
    ctaUrl: { type: String, trim: true },
    backgroundColor: { type: String, trim: true },
    textColor: { type: String, trim: true },
  },
  { _id: false }
);

/**
 * Ad Targeting Schema
 */
const AdTargetingSchema = new Schema<IAdTargeting>(
  {
    provinces: [{ type: String, trim: true }],
    landmarks: [{ type: String, trim: true }],
    userTypes: [{
      type: String,
      enum: ['new', 'returning', 'premium', 'inactive'],
    }],
    languages: [{ type: String, trim: true }],
    nationalities: [{ type: String, trim: true, uppercase: true }],
    ageRange: {
      min: { type: Number, min: 0 },
      max: { type: Number, max: 120 },
    },
    genders: [{
      type: String,
      enum: ['male', 'female', 'other'],
    }],
    interests: [{ type: String, trim: true }],
    devices: [{
      type: String,
      enum: ['ios', 'android'],
    }],
  },
  { _id: false }
);

/**
 * Ad Schedule Schema
 */
const AdScheduleSchema = new Schema<IAdSchedule>(
  {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    timezone: { type: String, default: 'Asia/Vientiane' },
    daysOfWeek: [{ type: Number, min: 0, max: 6 }],
    hoursOfDay: [{ type: Number, min: 0, max: 23 }],
  },
  { _id: false }
);

/**
 * Ad Budget Schema
 */
const AdBudgetSchema = new Schema<IAdBudget>(
  {
    daily: { type: Number, min: 0 },
    total: { type: Number, min: 0 },
    currency: { type: String, enum: ['LAK', 'USD'], default: 'USD' },
    spent: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

/**
 * Ad Pricing Schema
 */
const AdPricingSchema = new Schema<IAdPricing>(
  {
    type: { 
      type: String, 
      enum: ['cpm', 'cpc', 'cpa', 'flat'], 
      required: true,
      default: 'cpm',
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['LAK', 'USD'], default: 'USD' },
  },
  { _id: false }
);

/**
 * Ad Stats Schema
 */
const AdStatsSchema = new Schema<IAdStats>(
  {
    impressions: { type: Number, default: 0, min: 0 },
    clicks: { type: Number, default: 0, min: 0 },
    conversions: { type: Number, default: 0, min: 0 },
    ctr: { type: Number, default: 0, min: 0 },
    conversionRate: { type: Number, default: 0, min: 0 },
    revenue: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

/**
 * Advertiser Schema
 */
const AdvertiserSchema = new Schema<IAdvertiser>(
  {
    name: { type: String, required: true, trim: true },
    companyName: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

/**
 * Advertisement Schema
 */
const AdvertisementSchema = new Schema<IAdvertisement>(
  {
    name: {
      type: String,
      required: [true, 'Ad name is required'],
      trim: true,
      maxlength: 100,
    },
    description: { type: String, trim: true, maxlength: 500 },
    
    advertiser: { type: AdvertiserSchema, required: true },
    
    // Reference to Advertiser collection (for sponsors like Heineken)
    sponsorId: { type: Schema.Types.ObjectId, ref: 'Advertiser', index: true },
    
    type: {
      type: String,
      enum: ['banner', 'popup', 'interstitial', 'native', 'sponsored'],
      required: true,
      index: true,
    },
    placement: {
      type: String,
      enum: [
        // Home Hub
        'home_top', 'home_middle', 'home_bottom', 'home_featured_deal',
        // AppZap Eat
        'eat_hero_banner', 'eat_deal_card', 'eat_restaurant_badge', 
        'eat_menu_highlight', 'eat_checkout_upsell', 'eat_confirmation', 'eat_between_listings',
        // AppZap Activity
        'activity_hero_banner', 'activity_event_sponsor', 'activity_tour_card', 'activity_confirmation',
        // AppZap Stay
        'stay_hero_banner', 'stay_hotel_badge', 'stay_deal_card', 'stay_confirmation',
        // AppZap Market
        'market_hero_banner', 'market_category_sponsor', 'market_checkout',
        // Legacy/Generic
        'discover_top', 'discover_banner', 'search_results', 'detail_page', 
        'category_page', 'checkout', 'app_open', 'between_sections'
      ],
      required: true,
      index: true,
    },
    size: { type: String, trim: true },
    
    content: { type: AdContentSchema, required: true },
    targeting: { type: AdTargetingSchema, default: () => ({}) },
    schedule: { type: AdScheduleSchema, required: true },
    budget: { type: AdBudgetSchema },
    pricing: { type: AdPricingSchema, required: true },
    
    priority: { type: Number, default: 50, min: 1, max: 100 },
    weight: { type: Number, default: 50, min: 1, max: 100 },
    
    stats: { type: AdStatsSchema, default: () => ({}) },
    
    frequencyCap: {
      impressionsPerUser: { type: Number, min: 1 },
      timeWindowHours: { type: Number, min: 1, default: 24 },
    },
    
    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'approved', 'active', 'paused', 'ended', 'rejected'],
      default: 'draft',
      index: true,
    },
    rejectionReason: { type: String, trim: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    
    linkedEntityType: {
      type: String,
      enum: ['restaurant', 'hotel', 'activity', 'coupon'],
    },
    linkedEntityId: { type: Schema.Types.ObjectId },
  },
  {
    timestamps: true,
    collection: 'advertisements',
  }
);

// Indexes
AdvertisementSchema.index({ status: 1, placement: 1, priority: -1 });
AdvertisementSchema.index({ status: 1, 'schedule.startDate': 1, 'schedule.endDate': 1 });
AdvertisementSchema.index({ 'advertiser.userId': 1 });
AdvertisementSchema.index({ linkedEntityType: 1, linkedEntityId: 1 });

// Methods
AdvertisementSchema.methods.isActive = function(): boolean {
  const now = new Date();
  return (
    this.status === 'active' &&
    this.schedule.startDate <= now &&
    this.schedule.endDate >= now &&
    (!this.budget?.total || this.budget.spent < this.budget.total)
  );
};

AdvertisementSchema.methods.trackImpression = async function(): Promise<void> {
  this.stats.impressions += 1;
  // Update CTR
  if (this.stats.impressions > 0) {
    this.stats.ctr = (this.stats.clicks / this.stats.impressions) * 100;
  }
  await this.save();
};

AdvertisementSchema.methods.trackClick = async function(): Promise<void> {
  this.stats.clicks += 1;
  // Update CTR
  if (this.stats.impressions > 0) {
    this.stats.ctr = (this.stats.clicks / this.stats.impressions) * 100;
  }
  // Update spent for CPC
  if (this.pricing.type === 'cpc' && this.budget) {
    this.budget.spent += this.pricing.amount;
  }
  await this.save();
};

AdvertisementSchema.methods.trackConversion = async function(revenue = 0): Promise<void> {
  this.stats.conversions += 1;
  this.stats.revenue += revenue;
  // Update conversion rate
  if (this.stats.clicks > 0) {
    this.stats.conversionRate = (this.stats.conversions / this.stats.clicks) * 100;
  }
  // Update spent for CPA
  if (this.pricing.type === 'cpa' && this.budget) {
    this.budget.spent += this.pricing.amount;
  }
  await this.save();
};

// Transform output
AdvertisementSchema.methods.toJSON = function() {
  const ad = this.toObject();
  delete ad.__v;
  return ad;
};

// Model
const Advertisement: Model<IAdvertisement> = mongoose.model<IAdvertisement>('Advertisement', AdvertisementSchema);

export default Advertisement;
