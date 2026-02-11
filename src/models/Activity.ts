import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Activity Categories
 */
export type ActivityCategory = 
  | 'festival'      // Pi Mai, Boat Racing, That Luang Festival
  | 'tour'          // City tours, Mekong cruise
  | 'class'         // Cooking class, language class
  | 'nightlife'     // Clubs, bars, live music
  | 'sports'        // Golf, bowling, fitness
  | 'nature'        // Waterfalls, caves, hiking
  | 'cultural'      // Temples, museums
  | 'entertainment' // Cinema, karaoke, games
  | 'wellness'      // Spa, massage, yoga
  | 'food_drink'    // Food tours, wine tasting
  | 'shopping'      // Markets, malls
  | 'other';

/**
 * Event Type
 */
export type EventType = 
  | 'one_time'      // Single event with start/end date
  | 'recurring'     // Weekly, monthly events
  | 'permanent';    // Always available (like attractions)

/**
 * Target Audience
 */
export type TargetAudience = 
  | 'tourists'
  | 'families'
  | 'couples'
  | 'solo'
  | 'business'
  | 'groups'
  | 'kids'
  | 'seniors';

/**
 * Activity Schedule Interface
 */
export interface IActivitySchedule {
  // For one-time events
  startDate?: Date;
  endDate?: Date;
  
  // For recurring events
  daysOfWeek?: number[];        // 0=Sunday, 6=Saturday
  startTime?: string;           // "09:00"
  endTime?: string;             // "18:00"
  
  // Duration
  durationMinutes?: number;     // e.g., 120 for 2-hour tour
  
  // Frequency for recurring
  frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

/**
 * Activity Pricing Interface
 */
export interface IActivityPricing {
  isFree: boolean;
  amount?: number;
  currency?: 'LAK' | 'USD' | 'THB';
  priceType?: 'per_person' | 'per_group' | 'entry_fee' | 'starting_from';
  groupSize?: number;           // For per_group pricing
  childPrice?: number;          // Discounted price for children
  notes?: string;               // "Includes lunch", "Equipment rental extra"
}

/**
 * Activity Organizer Interface
 */
export interface IActivityOrganizer {
  name: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  isVerified: boolean;
}

/**
 * Activity Interface
 */
export interface IActivity extends Document {
  // Basic Info
  title: string;
  titleLocal?: string;
  description: string;
  descriptionLocal?: string;
  shortDescription?: string;    // For cards/previews
  
  // Categorization
  category: ActivityCategory;
  subcategory?: string;
  tags: string[];
  
  // Location
  landmark?: mongoose.Types.ObjectId;
  landmarkName?: string;
  address?: string;
  province: string;
  location?: {
    type: 'Point';
    coordinates: [number, number];
  };
  meetingPoint?: string;        // "Hotel pickup available"
  
  // Schedule
  eventType: EventType;
  schedule: IActivitySchedule;
  
  // Pricing
  pricing: IActivityPricing;
  
  // Media
  thumbnailUrl: string;
  images: string[];
  videoUrl?: string;
  
  // Organizer
  organizer?: IActivityOrganizer;
  
  // Details
  targetAudience: TargetAudience[];
  difficulty?: 'easy' | 'moderate' | 'challenging';
  minAge?: number;
  maxParticipants?: number;
  languagesAvailable?: string[];
  whatToExpect?: string[];      // Bullet points
  whatToBring?: string[];       // Bullet points
  inclusions?: string[];        // "Lunch included"
  exclusions?: string[];        // "Transportation not included"
  
  // Ratings & Reviews
  rating: number;
  reviewCount: number;
  
  // Business
  isFeatured: boolean;
  isVerified: boolean;
  isSponsored: boolean;
  packageId?: mongoose.Types.ObjectId;
  
  // Booking
  requiresBooking: boolean;
  bookingUrl?: string;
  bookingPhone?: string;
  
  // Stats
  viewCount: number;
  saveCount: number;            // How many users saved/bookmarked
  
  // Status
  status: 'active' | 'inactive' | 'upcoming' | 'ended' | 'cancelled';
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  isHappeningNow(): boolean;
  isUpcoming(): boolean;
  incrementViewCount(): Promise<IActivity>;
}

/**
 * Schedule Schema
 */
const ActivityScheduleSchema = new Schema<IActivitySchedule>(
  {
    startDate: { type: Date },
    endDate: { type: Date },
    daysOfWeek: [{ type: Number, min: 0, max: 6 }],
    startTime: { type: String },
    endTime: { type: String },
    durationMinutes: { type: Number, min: 1 },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'] },
  },
  { _id: false }
);

/**
 * Pricing Schema
 */
const ActivityPricingSchema = new Schema<IActivityPricing>(
  {
    isFree: { type: Boolean, required: true, default: false },
    amount: { type: Number, min: 0 },
    currency: { type: String, enum: ['LAK', 'USD', 'THB'], default: 'LAK' },
    priceType: { 
      type: String, 
      enum: ['per_person', 'per_group', 'entry_fee', 'starting_from'] 
    },
    groupSize: { type: Number, min: 1 },
    childPrice: { type: Number, min: 0 },
    notes: { type: String, trim: true, maxlength: 200 },
  },
  { _id: false }
);

/**
 * Organizer Schema
 */
const ActivityOrganizerSchema = new Schema<IActivityOrganizer>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    whatsapp: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    website: { type: String, trim: true },
    isVerified: { type: Boolean, default: false },
  },
  { _id: false }
);

/**
 * Activity Schema
 */
const ActivitySchema = new Schema<IActivity>(
  {
    // Basic Info
    title: {
      type: String,
      required: [true, 'Activity title is required'],
      trim: true,
      maxlength: 200,
    },
    titleLocal: { type: String, trim: true, maxlength: 200 },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: 3000,
    },
    descriptionLocal: { type: String, trim: true, maxlength: 3000 },
    shortDescription: { type: String, trim: true, maxlength: 200 },
    
    // Categorization
    category: {
      type: String,
      enum: ['festival', 'tour', 'class', 'nightlife', 'sports', 'nature', 'cultural', 'entertainment', 'wellness', 'food_drink', 'shopping', 'other'],
      required: true,
      index: true,
    },
    subcategory: { type: String, trim: true },
    tags: [{ type: String, trim: true, lowercase: true }],
    
    // Location
    landmark: { type: Schema.Types.ObjectId, ref: 'Landmark', index: true },
    landmarkName: { type: String, trim: true },
    address: { type: String, trim: true, maxlength: 500 },
    province: { type: String, required: true, trim: true, index: true },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
      },
    },
    meetingPoint: { type: String, trim: true, maxlength: 300 },
    
    // Schedule
    eventType: {
      type: String,
      enum: ['one_time', 'recurring', 'permanent'],
      required: true,
      index: true,
    },
    schedule: { type: ActivityScheduleSchema, default: () => ({}) },
    
    // Pricing
    pricing: { type: ActivityPricingSchema, required: true },
    
    // Media
    thumbnailUrl: { type: String, required: true, trim: true },
    images: [{ type: String, trim: true }],
    videoUrl: { type: String, trim: true },
    
    // Organizer
    organizer: { type: ActivityOrganizerSchema },
    
    // Details
    targetAudience: [{
      type: String,
      enum: ['tourists', 'families', 'couples', 'solo', 'business', 'groups', 'kids', 'seniors'],
    }],
    difficulty: { type: String, enum: ['easy', 'moderate', 'challenging'] },
    minAge: { type: Number, min: 0 },
    maxParticipants: { type: Number, min: 1 },
    languagesAvailable: [{ type: String, trim: true }],
    whatToExpect: [{ type: String, trim: true }],
    whatToBring: [{ type: String, trim: true }],
    inclusions: [{ type: String, trim: true }],
    exclusions: [{ type: String, trim: true }],
    
    // Ratings & Reviews
    rating: { type: Number, default: 0, min: 0, max: 5, index: true },
    reviewCount: { type: Number, default: 0, min: 0 },
    
    // Business
    isFeatured: { type: Boolean, default: false, index: true },
    isVerified: { type: Boolean, default: false },
    isSponsored: { type: Boolean, default: false },
    packageId: { type: Schema.Types.ObjectId, ref: 'RestaurantPackage' },
    
    // Booking
    requiresBooking: { type: Boolean, default: false },
    bookingUrl: { type: String, trim: true },
    bookingPhone: { type: String, trim: true },
    
    // Stats
    viewCount: { type: Number, default: 0 },
    saveCount: { type: Number, default: 0 },
    
    // Status
    status: {
      type: String,
      enum: ['active', 'inactive', 'upcoming', 'ended', 'cancelled'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'activities',
  }
);

// Indexes
ActivitySchema.index({ location: '2dsphere' });
ActivitySchema.index({ title: 'text', description: 'text', tags: 'text' });
ActivitySchema.index({ status: 1, category: 1, province: 1 });
ActivitySchema.index({ status: 1, isFeatured: -1, rating: -1 });
ActivitySchema.index({ 'schedule.startDate': 1 });
ActivitySchema.index({ 'schedule.endDate': 1 });

// Methods
ActivitySchema.methods.isHappeningNow = function(): boolean {
  const now = new Date();
  
  if (this.eventType === 'permanent') return true;
  
  if (this.eventType === 'one_time') {
    const start = this.schedule.startDate;
    const end = this.schedule.endDate;
    if (start && end) {
      return now >= start && now <= end;
    }
  }
  
  if (this.eventType === 'recurring') {
    const dayOfWeek = now.getDay();
    return this.schedule.daysOfWeek?.includes(dayOfWeek) || false;
  }
  
  return false;
};

ActivitySchema.methods.isUpcoming = function(): boolean {
  const now = new Date();
  
  if (this.eventType === 'one_time' && this.schedule.startDate) {
    return this.schedule.startDate > now;
  }
  
  return false;
};

ActivitySchema.methods.incrementViewCount = async function(): Promise<IActivity> {
  this.viewCount += 1;
  return await this.save();
};

// Transform output
ActivitySchema.methods.toJSON = function() {
  const activity = this.toObject();
  delete activity.__v;
  return activity;
};

// Model
const Activity: Model<IActivity> = mongoose.model<IActivity>('Activity', ActivitySchema);

export default Activity;
