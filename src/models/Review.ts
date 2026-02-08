import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Review Model for AppZap Consumer API V2
 * Stores user reviews for restaurants/stores
 */

// ============================================================================
// INTERFACES
// ============================================================================

export interface IReviewStats {
  totalReviews: number;
  sumStars: number;
  averageStars: number;
  starCounts: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface IReview extends Document {
  // Restaurant/Store reference
  storeId: mongoose.Types.ObjectId;
  storeName?: string;
  storeImage?: string;

  // Review content
  star: number;
  comment?: string;
  images: string[];

  // User info (denormalized for display)
  userId: mongoose.Types.ObjectId;
  userName?: string;
  userPhone?: string;
  userImage?: string;

  // Metadata
  note?: string;
  isVerifiedPurchase: boolean;

  // Points awarded for this review
  pointsAwarded: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// SCHEMA
// ============================================================================

const ReviewSchema = new Schema<IReview>(
  {
    // Restaurant/Store reference
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    storeName: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    storeImage: {
      type: String,
      trim: true,
    },

    // Review content
    star: {
      type: Number,
      required: [true, 'Star rating is required'],
      min: [1, 'Star rating must be at least 1'],
      max: [5, 'Star rating cannot exceed 5'],
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: function (v: string[]) {
          return v.length <= 5;
        },
        message: 'Cannot upload more than 5 images per review',
      },
    },

    // User info (denormalized for display)
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    userName: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    userPhone: {
      type: String,
      trim: true,
    },
    userImage: {
      type: String,
      trim: true,
    },

    // Metadata
    note: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: false,
    },

    // Points awarded for this review
    pointsAwarded: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    collection: 'reviews',
  }
);

// ============================================================================
// INDEXES
// ============================================================================

// Compound indexes for common queries
ReviewSchema.index({ storeId: 1, createdAt: -1 });
ReviewSchema.index({ userId: 1, createdAt: -1 });
ReviewSchema.index({ storeId: 1, star: 1 });

// For checking daily review limit (one review per store per day per user)
ReviewSchema.index({ userId: 1, storeId: 1, createdAt: 1 });

// Text index for searching reviews
ReviewSchema.index({ comment: 'text', storeName: 'text' });

// ============================================================================
// STATICS
// ============================================================================

/**
 * Calculate review statistics for a store
 */
ReviewSchema.statics.getStoreStats = async function (
  storeId: string
): Promise<IReviewStats> {
  const reviews = await this.find({ storeId }).select('star').lean();

  const stats: IReviewStats = {
    totalReviews: reviews.length,
    sumStars: 0,
    averageStars: 0,
    starCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };

  if (reviews.length === 0) {
    return stats;
  }

  reviews.forEach((review: any) => {
    const star = review.star;
    if (star >= 1 && star <= 5) {
      stats.sumStars += star;
      stats.starCounts[star as 1 | 2 | 3 | 4 | 5]++;
    }
  });

  stats.averageStars = Number((stats.sumStars / stats.totalReviews).toFixed(2));

  return stats;
};

// ============================================================================
// TRANSFORM
// ============================================================================

ReviewSchema.methods.toJSON = function () {
  const review = this.toObject();
  delete review.__v;
  return review;
};

// ============================================================================
// MODEL INTERFACE (with statics)
// ============================================================================

interface IReviewModel extends Model<IReview> {
  getStoreStats(storeId: string): Promise<IReviewStats>;
}

// ============================================================================
// MODEL
// ============================================================================

const Review: IReviewModel = mongoose.model<IReview, IReviewModel>(
  'Review',
  ReviewSchema
);

export default Review;
