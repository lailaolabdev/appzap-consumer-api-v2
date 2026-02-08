/**
 * User Migration Model
 * Tracks the migration of users from POS V1 to Consumer API
 * 
 * This model:
 * - Records each migrated user
 * - Tracks migration status (success/failure)
 * - Stores error messages for debugging
 * - Maps old POS V1 IDs to new Consumer API IDs
 */

import mongoose, { Document, Schema } from 'mongoose';

// ============================================================================
// INTERFACE
// ============================================================================

export interface IUserMigration extends Document {
  // Source information (POS V1)
  source: 'pos_v1';
  sourceUserId: string;
  sourcePhone: string;
  sourceData: {
    fullName?: string;
    email?: string;
    image?: string;
    gender?: string;
    yearOfBirth?: string;
    role?: string;
    storeId?: string;
    address?: {
      village?: string;
      district?: string;
      province?: string;
      latitude?: string;
      longitude?: string;
    };
    createdAt?: Date;
    updatedAt?: Date;
  };

  // Target information (Consumer API)
  consumerUserId?: mongoose.Types.ObjectId;
  
  // Migration status
  status: 'pending' | 'migrated' | 'failed' | 'duplicate' | 'skipped';
  errorMessage?: string;
  errorStack?: string;
  
  // Batch information
  batchId?: string;
  batchIndex?: number;
  
  // Timestamps
  migratedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// SCHEMA
// ============================================================================

const UserMigrationSchema = new Schema<IUserMigration>(
  {
    // Source information (POS V1)
    source: {
      type: String,
      required: true,
      default: 'pos_v1',
      enum: ['pos_v1'],
    },
    sourceUserId: {
      type: String,
      required: true,
      index: true,
    },
    sourcePhone: {
      type: String,
      required: true,
      index: true,
    },
    sourceData: {
      fullName: String,
      email: String,
      image: String,
      gender: String,
      yearOfBirth: String,
      role: String,
      storeId: String,
      address: {
        village: String,
        district: String,
        province: String,
        latitude: String,
        longitude: String,
      },
      createdAt: Date,
      updatedAt: Date,
    },

    // Target information (Consumer API)
    consumerUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },

    // Migration status
    status: {
      type: String,
      required: true,
      default: 'pending',
      enum: ['pending', 'migrated', 'failed', 'duplicate', 'skipped'],
      index: true,
    },
    errorMessage: String,
    errorStack: String,

    // Batch information
    batchId: {
      type: String,
      index: true,
    },
    batchIndex: Number,

    // Timestamps
    migratedAt: Date,
  },
  {
    timestamps: true,
    collection: 'user_migrations',
  }
);

// ============================================================================
// INDEXES
// ============================================================================

// Compound index for finding by source
UserMigrationSchema.index({ source: 1, sourceUserId: 1 }, { unique: true });

// Index for finding by phone (for duplicate detection)
UserMigrationSchema.index({ source: 1, sourcePhone: 1 });

// Index for finding by status (for retry logic)
UserMigrationSchema.index({ status: 1, createdAt: 1 });

// Index for batch processing
UserMigrationSchema.index({ batchId: 1, batchIndex: 1 });

// ============================================================================
// STATIC METHODS
// ============================================================================

UserMigrationSchema.statics = {
  /**
   * Get migration statistics
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    migrated: number;
    failed: number;
    duplicate: number;
    skipped: number;
  }> {
    const stats = await this.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const result = {
      total: 0,
      pending: 0,
      migrated: 0,
      failed: 0,
      duplicate: 0,
      skipped: 0,
    };

    stats.forEach((s: { _id: string; count: number }) => {
      result[s._id as keyof typeof result] = s.count;
      result.total += s.count;
    });

    return result;
  },

  /**
   * Check if a user has already been migrated
   */
  async isAlreadyMigrated(sourceUserId: string): Promise<boolean> {
    const existing = await this.findOne({
      source: 'pos_v1',
      sourceUserId,
      status: { $in: ['migrated', 'duplicate'] },
    });
    return !!existing;
  },

  /**
   * Get failed migrations for retry
   */
  async getFailedMigrations(limit = 100): Promise<IUserMigration[]> {
    return this.find({ status: 'failed' })
      .sort({ createdAt: 1 })
      .limit(limit);
  },

  /**
   * Create migration record
   */
  async createRecord(data: {
    sourceUserId: string;
    sourcePhone: string;
    sourceData: IUserMigration['sourceData'];
    batchId?: string;
    batchIndex?: number;
  }): Promise<IUserMigration> {
    return this.create({
      source: 'pos_v1',
      sourceUserId: data.sourceUserId,
      sourcePhone: data.sourcePhone,
      sourceData: data.sourceData,
      batchId: data.batchId,
      batchIndex: data.batchIndex,
      status: 'pending',
    });
  },

  /**
   * Mark migration as successful
   */
  async markAsMigrated(
    sourceUserId: string,
    consumerUserId: mongoose.Types.ObjectId
  ): Promise<void> {
    await this.updateOne(
      { source: 'pos_v1', sourceUserId },
      {
        $set: {
          status: 'migrated',
          consumerUserId,
          migratedAt: new Date(),
        },
      }
    );
  },

  /**
   * Mark migration as failed
   */
  async markAsFailed(
    sourceUserId: string,
    errorMessage: string,
    errorStack?: string
  ): Promise<void> {
    await this.updateOne(
      { source: 'pos_v1', sourceUserId },
      {
        $set: {
          status: 'failed',
          errorMessage,
          errorStack,
        },
      }
    );
  },

  /**
   * Mark as duplicate (phone already exists)
   */
  async markAsDuplicate(
    sourceUserId: string,
    existingConsumerUserId: mongoose.Types.ObjectId
  ): Promise<void> {
    await this.updateOne(
      { source: 'pos_v1', sourceUserId },
      {
        $set: {
          status: 'duplicate',
          consumerUserId: existingConsumerUserId,
          migratedAt: new Date(),
        },
      }
    );
  },

  /**
   * Get phone to Consumer ID mapping (for linking POS orders)
   */
  async getPhoneMapping(): Promise<Map<string, string>> {
    const mappings = await this.find(
      { status: { $in: ['migrated', 'duplicate'] } },
      { sourcePhone: 1, consumerUserId: 1 }
    );

    const map = new Map<string, string>();
    mappings.forEach((m: IUserMigration) => {
      if (m.consumerUserId) {
        map.set(m.sourcePhone, m.consumerUserId.toString());
      }
    });

    return map;
  },
};

// ============================================================================
// MODEL
// ============================================================================

const UserMigration = mongoose.model<IUserMigration>('UserMigration', UserMigrationSchema);

export default UserMigration;

