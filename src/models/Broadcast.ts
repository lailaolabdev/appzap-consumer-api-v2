import mongoose, { Document, Schema } from 'mongoose';

/**
 * Broadcast Document Interface
 * Tracks admin push notification broadcast campaigns
 */
export interface IBroadcast extends Document {
  title: string;
  body: string;
  deepLinkUrl?: string;
  targeting: {
    minAge?: number;
    sex?: string;
  };
  status: 'queued' | 'sending' | 'completed' | 'completed_without_push' | 'failed';
  stats: {
    totalTokens: number;
    sent: number;
    failed: number;
  };
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  completedAt?: Date;
}

const BroadcastSchema = new Schema<IBroadcast>(
  {
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    deepLinkUrl: {
      type: String,
    },
    targeting: {
      minAge: { type: Number },
      sex: { type: String },
    },
    status: {
      type: String,
      enum: ['queued', 'sending', 'completed', 'completed_without_push', 'failed'],
      default: 'queued',
    },
    stats: {
      totalTokens: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

BroadcastSchema.index({ status: 1 });
BroadcastSchema.index({ createdAt: -1 });

export const Broadcast = mongoose.model<IBroadcast>('Broadcast', BroadcastSchema);
export default Broadcast;
