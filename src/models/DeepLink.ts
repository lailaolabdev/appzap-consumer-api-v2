import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDeepLinkAttribution {
  opened: boolean;
  openedAt?: Date;
  deviceInfo?: {
    platform?: string;
    osVersion?: string;
    appVersion?: string;
    deviceId?: string;
  };
  firstInstall?: boolean;
  conversionCompleted?: boolean;
  conversionValue?: number;
}

export interface IDeepLink extends Document {
  shortCode: string;
  longUrl: string;
  
  // Target
  targetType: 'order' | 'restaurant' | 'product' | 'subscription' | 'promotion';
  targetId: string;
  
  // User Attribution
  userId?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  
  // Campaign
  campaignId?: string;
  campaignName?: string;
  source?: string; // 'sms', 'email', 'qr_code', 'share'
  medium?: string;
  
  // Firebase Dynamic Link
  firebaseDynamicLink?: string;
  androidLink?: string;
  iosLink?: string;
  fallbackUrl?: string;
  
  // Attribution
  clicks: number;
  uniqueClicks: number;
  attribution: IDeepLinkAttribution;
  
  // Metadata
  metadata?: Record<string, any>;
  expiresAt?: Date;
  isActive: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

const DeepLinkAttributionSchema = new Schema<IDeepLinkAttribution>(
  {
    opened: {
      type: Boolean,
      default: false,
    },
    openedAt: {
      type: Date,
    },
    deviceInfo: {
      platform: String,
      osVersion: String,
      appVersion: String,
      deviceId: String,
    },
    firstInstall: {
      type: Boolean,
      default: false,
    },
    conversionCompleted: {
      type: Boolean,
      default: false,
    },
    conversionValue: {
      type: Number,
      min: 0,
    },
  },
  { _id: false }
);

const DeepLinkSchema = new Schema<IDeepLink>(
  {
    shortCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    longUrl: {
      type: String,
      required: true,
      trim: true,
    },
    
    // Target
    targetType: {
      type: String,
      enum: ['order', 'restaurant', 'product', 'subscription', 'promotion'],
      required: true,
      index: true,
    },
    targetId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    
    // User Attribution
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    
    // Campaign
    campaignId: {
      type: String,
      trim: true,
      index: true,
    },
    campaignName: {
      type: String,
      trim: true,
    },
    source: {
      type: String,
      trim: true,
    },
    medium: {
      type: String,
      trim: true,
    },
    
    // Firebase Dynamic Link
    firebaseDynamicLink: {
      type: String,
      trim: true,
    },
    androidLink: {
      type: String,
      trim: true,
    },
    iosLink: {
      type: String,
      trim: true,
    },
    fallbackUrl: {
      type: String,
      trim: true,
    },
    
    // Attribution
    clicks: {
      type: Number,
      default: 0,
      min: 0,
    },
    uniqueClicks: {
      type: Number,
      default: 0,
      min: 0,
    },
    attribution: {
      type: DeepLinkAttributionSchema,
      default: () => ({}),
    },
    
    // Metadata
    metadata: {
      type: Schema.Types.Mixed,
    },
    expiresAt: {
      type: Date,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'deep_links',
  }
);

// Indexes
DeepLinkSchema.index({ userId: 1, targetType: 1, createdAt: -1 });
DeepLinkSchema.index({ campaignId: 1, createdAt: -1 });
DeepLinkSchema.index({ shortCode: 1, isActive: 1 });
DeepLinkSchema.index({ expiresAt: 1 }); // For cleanup

// Methods
DeepLinkSchema.methods.trackClick = async function (isUnique: boolean = false): Promise<IDeepLink> {
  this.clicks += 1;
  if (isUnique) {
    this.uniqueClicks += 1;
  }
  return await this.save();
};

DeepLinkSchema.methods.trackOpen = async function (deviceInfo?: any): Promise<IDeepLink> {
  this.attribution.opened = true;
  this.attribution.openedAt = new Date();
  if (deviceInfo) {
    this.attribution.deviceInfo = deviceInfo;
  }
  return await this.save();
};

DeepLinkSchema.methods.trackConversion = async function (value?: number): Promise<IDeepLink> {
  this.attribution.conversionCompleted = true;
  if (value) {
    this.attribution.conversionValue = value;
  }
  return await this.save();
};

DeepLinkSchema.methods.isExpired = function (): boolean {
  return this.expiresAt ? this.expiresAt < new Date() : false;
};

// Model
const DeepLink: Model<IDeepLink> = mongoose.model<IDeepLink>('DeepLink', DeepLinkSchema);

export default DeepLink;


