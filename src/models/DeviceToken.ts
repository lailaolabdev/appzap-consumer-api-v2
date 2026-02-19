import mongoose, { Document, Schema } from 'mongoose';

export interface IDeviceToken extends Document {
  token: string;
  platform: 'ios' | 'android';
  userId?: mongoose.Types.ObjectId;
  deviceInfo?: {
    os?: string;
    osVersion?: string;
    appVersion?: string;
    deviceModel?: string;
  };
  topics: string[];
  isActive: boolean;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceTokenSchema = new Schema<IDeviceToken>(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    platform: {
      type: String,
      required: true,
      enum: ['ios', 'android'],
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    deviceInfo: {
      os: String,
      osVersion: String,
      appVersion: String,
      deviceModel: String,
    },
    topics: {
      type: [String],
      default: ['all', 'promotions'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

DeviceTokenSchema.index({ userId: 1, isActive: 1 });
DeviceTokenSchema.index({ topics: 1 });
DeviceTokenSchema.index({ platform: 1, isActive: 1 });

export default mongoose.model<IDeviceToken>('DeviceToken', DeviceTokenSchema);
