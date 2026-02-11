import mongoose, { Schema, Document, Model } from 'mongoose';

// Interfaces
export interface IAddress {
  village?: string;
  district?: string;
  province?: string;
  latitude?: number;
  longitude?: number;
}

export interface IMerchantProfile {
  restaurantId: string;
  restaurantName: string;
  role: 'owner' | 'manager';
  supplierCustomerId?: string; // For B2B orders
  verifiedAt: Date;
  permissions?: string[];
}

export interface ILoyaltyPoints {
  balance: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  totalEarned: number;
  totalRedeemed: number;
}

export interface IPreferences {
  defaultMode: 'eats' | 'live';
  language: 'lo' | 'en' | 'th' | 'zh' | 'ko' | 'ja';
  notifications: boolean;
  dietaryPreferences: string[];
}

/**
 * International Phone Info
 * For supporting foreigners with non-Lao phone numbers
 */
export interface IPhoneInfo {
  countryCode: string;      // ISO 3166-1 alpha-2: 'LA', 'US', 'TH', 'KR', etc.
  countryDialCode: string;  // '+856', '+1', '+66', '+82', etc.
  isInternational: boolean; // true if not Lao number
  verifiedAt?: Date;
}

/**
 * Profile Completeness Tracking
 * For progressive profiling
 */
export interface IProfileCompleteness {
  percentage: number;           // 0-100
  missingFields: string[];      // ['dateOfBirth', 'nationality']
  lastPromptedAt?: Date;        // When we last asked user to complete
  completedAt?: Date;           // When profile reached 100%
}

export interface IPushToken {
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceId?: string;
  addedAt: Date;
}

/**
 * V1 Integration Data
 * For future linking with POS V1 (appzap-app-api) user accounts
 * This allows V1 users to access their historical data when they migrate to V2
 */
export interface IV1Integration {
  userId?: string;           // V1 UserApp._id
  userAuthId?: string;       // V1 userAuthId (for auth matching)
  phone?: string;            // V1 phone number (may differ from V2)
  linkedAt?: Date;           // When accounts were linked
  dataSynced?: {
    orders: boolean;         // V1 order history accessible
    reviews: boolean;        // V1 reviews accessible
    points: boolean;         // V1 points accessible
    reservations: boolean;   // V1 reservations accessible
  };
}

export interface IUser extends Document {
  phone: string;
  fullName?: string;
  nickname?: string;
  email?: string;
  image?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  
  // International Support (Phase A1)
  phoneInfo: IPhoneInfo;
  nationality?: string;         // ISO 3166-1 alpha-2: 'LA', 'US', 'TH', etc.
  passportNumber?: string;      // For hotel bookings (encrypted)
  
  // Progressive Profile (Phase A2)
  profileCompleteness: IProfileCompleteness;
  registrationSource?: 'app' | 'web' | 'qr_scan' | 'referral';
  referredBy?: string;          // User ID who referred

  // Authentication
  authProviderId?: string; // From Auth API
  lastLogin?: Date;
  loginCount: number;

  // Roles & Profiles
  roles: string[];
  activeProfile: 'personal' | 'merchant';
  merchantProfiles: IMerchantProfile[];

  // Address
  address?: IAddress;

  // Loyalty
  points: ILoyaltyPoints;

  // Preferences
  preferences: IPreferences;

  // Onboarding
  hasCompletedOnboarding: boolean;
  firstLogin: boolean;

  // Push Notifications
  pushTokens: IPushToken[];

  // Supplier API Integration
  supplierId?: string; // Personal Supplier customer ID (B2C)

  // V1 Integration (for future POS V1 data access)
  v1Integration?: IV1Integration;

  // Soft delete
  isDeleted: boolean;
  deletedAt?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Methods
  getActiveProfileDetails(): IMerchantProfile | null;
  canAccessMerchantProfile(): boolean;
  addMerchantProfile(profile: IMerchantProfile): Promise<IUser>;
  switchProfile(profileType: 'personal' | 'merchant'): Promise<IUser>;
  calculateProfileCompleteness(): IProfileCompleteness;
  getRequiredFieldsForAction(action: string): string[];
  isForeigner(): boolean;
}

// Schemas
const AddressSchema = new Schema<IAddress>(
  {
    village: { type: String, trim: true, maxlength: 200 },
    district: { type: String, trim: true, maxlength: 200 },
    province: { type: String, trim: true, maxlength: 200 },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
  },
  { _id: false }
);

const MerchantProfileSchema = new Schema<IMerchantProfile>(
  {
    restaurantId: { type: String, required: true, trim: true },
    restaurantName: { type: String, required: true, trim: true },
    role: { type: String, enum: ['owner', 'manager'], default: 'owner' },
    supplierCustomerId: { type: String, trim: true },
    verifiedAt: { type: Date, required: true, default: Date.now },
    permissions: [{ type: String }],
  },
  { _id: false }
);

const LoyaltyPointsSchema = new Schema<ILoyaltyPoints>(
  {
    balance: { type: Number, default: 0, min: 0 },
    tier: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum'],
      default: 'bronze',
    },
    totalEarned: { type: Number, default: 0, min: 0 },
    totalRedeemed: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const PreferencesSchema = new Schema<IPreferences>(
  {
    defaultMode: { type: String, enum: ['eats', 'live'], default: 'eats' },
    language: { type: String, enum: ['lo', 'en', 'th', 'zh', 'ko', 'ja'], default: 'en' },
    notifications: { type: Boolean, default: true },
    dietaryPreferences: [{ type: String }],
  },
  { _id: false }
);

/**
 * Phone Info Schema - International phone support
 */
const PhoneInfoSchema = new Schema<IPhoneInfo>(
  {
    countryCode: { type: String, required: true, default: 'LA', uppercase: true },
    countryDialCode: { type: String, required: true, default: '+856' },
    isInternational: { type: Boolean, default: false },
    verifiedAt: { type: Date },
  },
  { _id: false }
);

/**
 * Profile Completeness Schema - Progressive profiling
 */
const ProfileCompletenessSchema = new Schema<IProfileCompleteness>(
  {
    percentage: { type: Number, default: 20, min: 0, max: 100 },
    missingFields: [{ type: String }],
    lastPromptedAt: { type: Date },
    completedAt: { type: Date },
  },
  { _id: false }
);

const PushTokenSchema = new Schema<IPushToken>(
  {
    token: { type: String, required: true },
    platform: { type: String, enum: ['ios', 'android', 'web'], required: true },
    deviceId: { type: String },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/**
 * V1 Integration Schema
 * Stores linking information for POS V1 user accounts
 */
const V1IntegrationSchema = new Schema<IV1Integration>(
  {
    userId: { type: String, trim: true },        // V1 UserApp._id
    userAuthId: { type: String, trim: true },   // V1 userAuthId
    phone: { type: String, trim: true },        // V1 phone (for matching)
    linkedAt: { type: Date },
    dataSynced: {
      orders: { type: Boolean, default: false },
      reviews: { type: Boolean, default: false },
      points: { type: Boolean, default: false },
      reservations: { type: Boolean, default: false },
    },
  },
  { _id: false }
);

// Main User Schema
const UserSchema = new Schema<IUser>(
  {
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      // Updated to support international phone numbers (E.164 format)
      match: [/^\+?[1-9]\d{6,14}$/, 'Invalid phone number format'],
    },
    fullName: { type: String, trim: true, maxlength: 200 },
    nickname: { type: String, trim: true, maxlength: 50 },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    image: { type: String, trim: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },

    // International Support (Phase A1)
    phoneInfo: { 
      type: PhoneInfoSchema, 
      default: () => ({ countryCode: 'LA', countryDialCode: '+856', isInternational: false }) 
    },
    nationality: { type: String, trim: true, uppercase: true, maxlength: 2 },
    passportNumber: { type: String, trim: true }, // Should be encrypted in production

    // Progressive Profile (Phase A2)
    profileCompleteness: { 
      type: ProfileCompletenessSchema, 
      default: () => ({ percentage: 20, missingFields: ['fullName', 'dateOfBirth', 'gender', 'nationality'] }) 
    },
    registrationSource: { 
      type: String, 
      enum: ['app', 'web', 'qr_scan', 'referral'], 
      default: 'app' 
    },
    referredBy: { type: Schema.Types.ObjectId, ref: 'User' },

    // Authentication
    authProviderId: { type: String, trim: true, index: true },
    lastLogin: { type: Date },
    loginCount: { type: Number, default: 0 },

    // Roles & Profiles
    roles: {
      type: [String],
      enum: ['consumer', 'merchant_owner'],
      default: ['consumer'],
    },
    activeProfile: {
      type: String,
      enum: ['personal', 'merchant'],
      default: 'personal',
    },
    merchantProfiles: [MerchantProfileSchema],

    // Address
    address: { type: AddressSchema },

    // Loyalty
    points: { type: LoyaltyPointsSchema, default: () => ({}) },

    // Preferences
    preferences: { type: PreferencesSchema, default: () => ({}) },

    // Onboarding
    hasCompletedOnboarding: { type: Boolean, default: false },
    firstLogin: { type: Boolean, default: true },

    // Push Notifications
    pushTokens: [PushTokenSchema],

    // Supplier API Integration
    supplierId: { type: String, trim: true },

    // V1 Integration (for future POS V1 data access)
    v1Integration: { type: V1IntegrationSchema },

    // Soft delete
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

// Indexes
UserSchema.index({ phone: 1 }, { unique: true });
UserSchema.index({ email: 1 }, { sparse: true });
UserSchema.index({ authProviderId: 1 });
UserSchema.index({ roles: 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ isDeleted: 1, phone: 1 });
UserSchema.index({ 'merchantProfiles.restaurantId': 1 });
// V1 Integration indexes (for future account linking)
UserSchema.index({ 'v1Integration.userId': 1 }, { sparse: true });
UserSchema.index({ 'v1Integration.phone': 1 }, { sparse: true });
// International user indexes (Phase A1)
UserSchema.index({ nationality: 1 }, { sparse: true });
UserSchema.index({ 'phoneInfo.countryCode': 1 });
UserSchema.index({ 'phoneInfo.isInternational': 1 });
UserSchema.index({ 'profileCompleteness.percentage': 1 });

// Methods
UserSchema.methods.getActiveProfileDetails = function (): IMerchantProfile | null {
  if (this.activeProfile === 'merchant' && this.merchantProfiles.length > 0) {
    return this.merchantProfiles[0];
  }
  return null;
};

UserSchema.methods.canAccessMerchantProfile = function (): boolean {
  return this.roles.includes('merchant_owner') && this.merchantProfiles.length > 0;
};

UserSchema.methods.addMerchantProfile = async function (
  profile: IMerchantProfile
): Promise<IUser> {
  // Check if restaurant already linked
  const exists = this.merchantProfiles.some(
    (p: IMerchantProfile) => p.restaurantId === profile.restaurantId
  );

  if (exists) {
    throw new Error('Restaurant already linked to this account');
  }

  this.merchantProfiles.push(profile);

  // Add merchant_owner role if not exists
  if (!this.roles.includes('merchant_owner')) {
    this.roles.push('merchant_owner');
  }

  return await this.save();
};

UserSchema.methods.switchProfile = async function (
  profileType: 'personal' | 'merchant'
): Promise<IUser> {
  if (profileType === 'merchant' && !this.canAccessMerchantProfile()) {
    throw new Error('User does not have merchant access');
  }

  this.activeProfile = profileType;
  return await this.save();
};

/**
 * Calculate profile completeness percentage
 * Used for progressive profiling
 */
UserSchema.methods.calculateProfileCompleteness = function (): IProfileCompleteness {
  const fields = {
    phone: { weight: 20, filled: !!this.phone },
    fullName: { weight: 15, filled: !!this.fullName },
    dateOfBirth: { weight: 15, filled: !!this.dateOfBirth },
    gender: { weight: 10, filled: !!this.gender },
    nationality: { weight: 15, filled: !!this.nationality },
    email: { weight: 10, filled: !!this.email },
    image: { weight: 10, filled: !!this.image },
    address: { weight: 5, filled: !!this.address?.province },
  };

  let percentage = 0;
  const missingFields: string[] = [];

  for (const [field, info] of Object.entries(fields)) {
    if (info.filled) {
      percentage += info.weight;
    } else {
      missingFields.push(field);
    }
  }

  return {
    percentage: Math.min(100, percentage),
    missingFields,
    completedAt: percentage >= 100 ? new Date() : undefined,
  };
};

/**
 * Get required fields for specific actions
 * Used to prompt users for missing data when needed
 */
UserSchema.methods.getRequiredFieldsForAction = function (action: string): string[] {
  const actionRequirements: Record<string, string[]> = {
    buy_coupon: ['fullName'],
    book_hotel: ['fullName', 'nationality', 'passportNumber'],
    book_activity: ['fullName'],
    make_reservation: ['fullName'],
    earn_points: ['fullName'],
  };

  const required = actionRequirements[action] || [];
  const missing: string[] = [];

  for (const field of required) {
    if (!this[field]) {
      missing.push(field);
    }
  }

  return missing;
};

/**
 * Check if user is a foreigner (non-Lao)
 */
UserSchema.methods.isForeigner = function (): boolean {
  return this.phoneInfo?.isInternational || 
         (this.nationality && this.nationality !== 'LA') ||
         (this.phoneInfo?.countryCode && this.phoneInfo.countryCode !== 'LA');
};

// Transform output (remove sensitive fields)
UserSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.__v;
  delete user.isDeleted;
  return user;
};

// Pre-save middleware to update loyalty tier and profile completeness
UserSchema.pre('save', function (next) {
  // Auto-update tier based on points balance
  if (this.isModified('points.balance')) {
    const balance = this.points.balance;
    if (balance >= 10000) {
      this.points.tier = 'platinum';
    } else if (balance >= 5000) {
      this.points.tier = 'gold';
    } else if (balance >= 2000) {
      this.points.tier = 'silver';
    } else {
      this.points.tier = 'bronze';
    }
  }

  // Auto-update profile completeness when profile fields change
  const profileFields = ['fullName', 'dateOfBirth', 'gender', 'nationality', 'email', 'image', 'address'];
  const isProfileFieldModified = profileFields.some(field => this.isModified(field));
  
  if (isProfileFieldModified || this.isNew) {
    const completeness = this.calculateProfileCompleteness();
    this.profileCompleteness = completeness;
  }

  // Detect if international phone number
  if (this.isModified('phone') && this.phone) {
    const phone = this.phone.replace(/^\+/, '');
    const isLaoNumber = phone.startsWith('856');
    this.phoneInfo = {
      ...this.phoneInfo,
      isInternational: !isLaoNumber,
      countryCode: isLaoNumber ? 'LA' : (this.phoneInfo?.countryCode || 'UNKNOWN'),
      countryDialCode: isLaoNumber ? '+856' : (this.phoneInfo?.countryDialCode || '+'),
    };
  }

  next();
});

// Model
const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);

export default User;


