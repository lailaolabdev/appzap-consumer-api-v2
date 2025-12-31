import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPromotionalReward extends Document {
  userId: mongoose.Types.ObjectId;
  orderId?: mongoose.Types.ObjectId;
  
  // Reward Details
  rewardType: 'beer' | 'discount' | 'points' | 'voucher' | 'free_item' | 'cashback';
  rewardValue: number; // Numeric value (points, LAK, percentage)
  rewardTitle: string;
  rewardDescription: string;
  rewardImageUrl?: string;
  
  // Spin to Win Game
  gameType: 'spin_wheel' | 'scratch_card' | 'lucky_draw';
  spinCount: number; // How many spins user got
  isWon: boolean;
  wonAt?: Date;
  
  // Redemption
  isRedeemed: boolean;
  redeemedAt?: Date;
  redemptionCode?: string;
  expiresAt: Date;
  
  // Attribution
  source: 'web_order' | 'first_app_order' | 'referral' | 'promotion';
  deepLinkId?: string;
  campaignId?: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const PromotionalRewardSchema = new Schema<IPromotionalReward>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      index: true,
    },
    
    // Reward Details
    rewardType: {
      type: String,
      enum: ['beer', 'discount', 'points', 'voucher', 'free_item', 'cashback'],
      required: true,
    },
    rewardValue: {
      type: Number,
      required: true,
      min: 0,
    },
    rewardTitle: {
      type: String,
      required: true,
      trim: true,
    },
    rewardDescription: {
      type: String,
      required: true,
      trim: true,
    },
    rewardImageUrl: {
      type: String,
      trim: true,
    },
    
    // Spin to Win Game
    gameType: {
      type: String,
      enum: ['spin_wheel', 'scratch_card', 'lucky_draw'],
      default: 'spin_wheel',
    },
    spinCount: {
      type: Number,
      default: 1,
      min: 0,
    },
    isWon: {
      type: Boolean,
      default: false,
    },
    wonAt: {
      type: Date,
    },
    
    // Redemption
    isRedeemed: {
      type: Boolean,
      default: false,
      index: true,
    },
    redeemedAt: {
      type: Date,
    },
    redemptionCode: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    
    // Attribution
    source: {
      type: String,
      enum: ['web_order', 'first_app_order', 'referral', 'promotion'],
      required: true,
    },
    deepLinkId: {
      type: String,
      trim: true,
      index: true,
    },
    campaignId: {
      type: String,
      trim: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'promotional_rewards',
  }
);

// Indexes
PromotionalRewardSchema.index({ userId: 1, isRedeemed: 1, expiresAt: 1 });
PromotionalRewardSchema.index({ source: 1, createdAt: -1 });
PromotionalRewardSchema.index({ expiresAt: 1 }); // For cleanup jobs

// Methods
PromotionalRewardSchema.methods.redeem = async function (): Promise<IPromotionalReward> {
  if (this.isRedeemed) {
    throw new Error('Reward already redeemed');
  }
  
  if (this.expiresAt < new Date()) {
    throw new Error('Reward has expired');
  }
  
  this.isRedeemed = true;
  this.redeemedAt = new Date();
  
  return await this.save();
};

PromotionalRewardSchema.methods.isExpired = function (): boolean {
  return this.expiresAt < new Date();
};

// Model
const PromotionalReward: Model<IPromotionalReward> = mongoose.model<IPromotionalReward>(
  'PromotionalReward',
  PromotionalRewardSchema
);

export default PromotionalReward;


