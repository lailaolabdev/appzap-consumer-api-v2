import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IDeviceToken extends Document {
  user: mongoose.Types.ObjectId;
  fcmToken: string;
  deviceOS: 'iOS' | 'Android' | 'Web' | 'Unknown';
  appVersion?: string;
  lastActive: Date;
  isActive: boolean;
}

const deviceTokenSchema = new Schema<IDeviceToken>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  fcmToken: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  deviceOS: {
    type: String,
    enum: ['iOS', 'Android', 'Web', 'Unknown'],
    default: 'Unknown',
  },
  appVersion: {
    type: String,
  },
  lastActive: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Indexing for high-speed Admin broadcasts
deviceTokenSchema.index({ user: 1 });
deviceTokenSchema.index({ fcmToken: 1 });
deviceTokenSchema.index({ lastActive: -1 });

const DeviceToken: Model<IDeviceToken> = mongoose.models.DeviceToken || mongoose.model<IDeviceToken>('DeviceToken', deviceTokenSchema);

export default DeviceToken;
