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
  language: 'lo' | 'en';
  notifications: boolean;
  dietaryPreferences: string[];
}

export interface IPushToken {
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceId?: string;
  addedAt: Date;
}

export interface IUser extends Document {
  phone: string;
  fullName?: string;
  email?: string;
  image?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other';

  // Authentication
  authProviderId?: string; // From Auth API
  lastLogin?: Date;

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
    language: { type: String, enum: ['lo', 'en'], default: 'lo' },
    notifications: { type: Boolean, default: true },
    dietaryPreferences: [{ type: String }],
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

// Main User Schema
const UserSchema = new Schema<IUser>(
  {
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      match: [/^856\d{8,10}$/, 'Invalid Lao phone number format'],
    },
    fullName: { type: String, trim: true, maxlength: 200 },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    image: { type: String, trim: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other'] },

    // Authentication
    authProviderId: { type: String, trim: true, index: true },
    lastLogin: { type: Date },

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

// Transform output (remove sensitive fields)
UserSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.__v;
  delete user.isDeleted;
  return user;
};

// Pre-save middleware to update loyalty tier
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
  next();
});

// Model
const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);

export default User;


