import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILoyaltyTransaction extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'earn' | 'redeem' | 'bonus' | 'expire' | 'adjustment';
  amount: number;
  source: string;
  sourceId?: mongoose.Types.ObjectId;
  description: string;
  balanceBefore: number;
  balanceAfter: number;
  expiresAt?: Date;
  createdAt: Date;
}

const LoyaltyTransactionSchema = new Schema<ILoyaltyTransaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['earn', 'redeem', 'bonus', 'expire', 'adjustment'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    source: {
      type: String,
      enum: ['order', 'referral', 'welcome_bonus', 'admin', 'expiry', 'redemption', 'review', 'gift_received', 'gift_purchase'],
      required: true,
    },
    sourceId: {
      type: Schema.Types.ObjectId,
      refPath: 'source',
    },
    description: {
      type: String,
      required: true,
      maxlength: 500,
    },
    balanceBefore: {
      type: Number,
      required: true,
      min: 0,
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },
    expiresAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'loyalty_transactions',
  }
);

// Indexes
LoyaltyTransactionSchema.index({ userId: 1, createdAt: -1 });
LoyaltyTransactionSchema.index({ type: 1, createdAt: -1 });
LoyaltyTransactionSchema.index({ expiresAt: 1 }, { sparse: true });

// Model
const LoyaltyTransaction: Model<ILoyaltyTransaction> =
  mongoose.model<ILoyaltyTransaction>('LoyaltyTransaction', LoyaltyTransactionSchema);

export default LoyaltyTransaction;


