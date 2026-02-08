/**
 * Restaurant Registry Model
 * 
 * Stores the mapping between unified restaurant IDs and their POS systems.
 * This enables fast lookups without querying both POS systems.
 * 
 * Benefits:
 * - Fast routing: Know which POS to query instantly
 * - Caching: Store basic info to reduce API calls
 * - Tracking: Monitor sync status and errors
 * - Migration: Handle restaurants moving between POS versions
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

// ============================================================================
// INTERFACES
// ============================================================================

export type POSVersionType = 'v1' | 'v2';

export interface IRestaurantFeatureFlags {
  hasReservation: boolean;
  hasTakeaway: boolean;
  hasDelivery: boolean;
  hasLoyalty: boolean;
  hasQROrdering: boolean;
  hasLiveBill: boolean;
  hasSplitBill: boolean;
}

export interface ISyncStatus {
  lastSyncedAt: Date;
  lastSyncSuccess: boolean;
  lastError?: string;
  syncCount: number;
  consecutiveFailures: number;
}

export interface IRestaurantRegistry extends Document {
  // Unified identifier
  unifiedId: string;              // Format: v1_xxx or v2_xxx
  
  // POS system info
  posVersion: POSVersionType;
  posId: string;                  // Original POS ID
  
  // Basic restaurant info (cached)
  name: string;
  nameEn?: string;
  image?: string;
  
  // Location (for proximity searches)
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  province?: string;
  district?: string;
  
  // Feature flags
  features: IRestaurantFeatureFlags;
  
  // Status
  isActive: boolean;
  isOpen: boolean;
  
  // Sync tracking
  syncStatus: ISyncStatus;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  markSynced(success: boolean, error?: string): Promise<IRestaurantRegistry>;
}

// ============================================================================
// SCHEMA
// ============================================================================

const RestaurantFeatureFlagsSchema = new Schema<IRestaurantFeatureFlags>(
  {
    hasReservation: { type: Boolean, default: false },
    hasTakeaway: { type: Boolean, default: true },
    hasDelivery: { type: Boolean, default: false },
    hasLoyalty: { type: Boolean, default: true },
    hasQROrdering: { type: Boolean, default: true },
    hasLiveBill: { type: Boolean, default: false },
    hasSplitBill: { type: Boolean, default: false },
  },
  { _id: false }
);

const SyncStatusSchema = new Schema<ISyncStatus>(
  {
    lastSyncedAt: { type: Date, default: Date.now },
    lastSyncSuccess: { type: Boolean, default: true },
    lastError: { type: String },
    syncCount: { type: Number, default: 0 },
    consecutiveFailures: { type: Number, default: 0 },
  },
  { _id: false }
);

const RestaurantRegistrySchema = new Schema<IRestaurantRegistry>(
  {
    unifiedId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    posVersion: {
      type: String,
      enum: ['v1', 'v2'],
      required: true,
      index: true,
    },
    posId: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      index: 'text',
    },
    nameEn: {
      type: String,
      index: 'text',
    },
    image: {
      type: String,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: undefined,
      },
    },
    province: {
      type: String,
      index: true,
    },
    district: {
      type: String,
    },
    features: {
      type: RestaurantFeatureFlagsSchema,
      default: () => ({}),
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isOpen: {
      type: Boolean,
      default: false,
    },
    syncStatus: {
      type: SyncStatusSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    collection: 'restaurant_registry',
  }
);

// ============================================================================
// INDEXES
// ============================================================================

// Geospatial index for location-based queries
RestaurantRegistrySchema.index({ location: '2dsphere' });

// Compound indexes for common queries
RestaurantRegistrySchema.index({ posVersion: 1, isActive: 1 });
RestaurantRegistrySchema.index({ isActive: 1, 'features.hasReservation': 1 });
RestaurantRegistrySchema.index({ province: 1, isActive: 1 });

// For duplicate detection
RestaurantRegistrySchema.index({ posVersion: 1, posId: 1 }, { unique: true });

// ============================================================================
// METHODS
// ============================================================================

/**
 * Mark the restaurant as synced
 */
RestaurantRegistrySchema.methods.markSynced = async function (
  success: boolean,
  error?: string
): Promise<IRestaurantRegistry> {
  this.syncStatus.lastSyncedAt = new Date();
  this.syncStatus.lastSyncSuccess = success;
  this.syncStatus.syncCount += 1;

  if (success) {
    this.syncStatus.consecutiveFailures = 0;
    this.syncStatus.lastError = undefined;
  } else {
    this.syncStatus.consecutiveFailures += 1;
    this.syncStatus.lastError = error;
  }

  return this.save();
};

// ============================================================================
// STATICS
// ============================================================================

interface IRestaurantRegistryModel extends Model<IRestaurantRegistry> {
  findByUnifiedId(unifiedId: string): Promise<IRestaurantRegistry | null>;
  findByPosId(posVersion: POSVersionType, posId: string): Promise<IRestaurantRegistry | null>;
  upsertFromPOS(data: Partial<IRestaurantRegistry>): Promise<IRestaurantRegistry>;
  searchNearby(lat: number, lng: number, radiusKm: number, limit?: number): Promise<IRestaurantRegistry[]>;
}

/**
 * Find by unified ID
 */
RestaurantRegistrySchema.statics.findByUnifiedId = async function (
  unifiedId: string
): Promise<IRestaurantRegistry | null> {
  return this.findOne({ unifiedId });
};

/**
 * Find by POS ID and version
 */
RestaurantRegistrySchema.statics.findByPosId = async function (
  posVersion: POSVersionType,
  posId: string
): Promise<IRestaurantRegistry | null> {
  return this.findOne({ posVersion, posId });
};

/**
 * Upsert restaurant from POS data
 */
RestaurantRegistrySchema.statics.upsertFromPOS = async function (
  data: Partial<IRestaurantRegistry>
): Promise<IRestaurantRegistry> {
  const unifiedId = `${data.posVersion}_${data.posId}`;

  return this.findOneAndUpdate(
    { unifiedId },
    {
      $set: {
        ...data,
        unifiedId,
        'syncStatus.lastSyncedAt': new Date(),
        'syncStatus.lastSyncSuccess': true,
      },
      $inc: { 'syncStatus.syncCount': 1 },
    },
    { upsert: true, new: true }
  );
};

/**
 * Search nearby restaurants
 */
RestaurantRegistrySchema.statics.searchNearby = async function (
  lat: number,
  lng: number,
  radiusKm: number,
  limit: number = 50
): Promise<IRestaurantRegistry[]> {
  return this.find({
    isActive: true,
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [lng, lat], // GeoJSON uses [lng, lat]
        },
        $maxDistance: radiusKm * 1000, // Convert to meters
      },
    },
  }).limit(limit);
};

// ============================================================================
// MODEL
// ============================================================================

const RestaurantRegistry: IRestaurantRegistryModel = mongoose.model<
  IRestaurantRegistry,
  IRestaurantRegistryModel
>('RestaurantRegistry', RestaurantRegistrySchema);

export default RestaurantRegistry;
