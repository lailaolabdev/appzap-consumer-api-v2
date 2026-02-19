import mongoose, { Document, Schema } from 'mongoose';

/**
 * Notification types
 */
export type NotificationType = 
  | 'order_confirmation'
  | 'order_status'
  | 'promotion'
  | 'deal'
  | 'sponsor_promo'
  | 'flash_deal'
  | 'event_reminder'
  | 'daily_digest'
  | 'loyalty_points'
  | 'general';

/**
 * Notification Document Interface
 */
export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  body: string;
  type: NotificationType;
  imageUrl?: string;
  targetId?: string;
  targetType?: string;
  data?: Record<string, any>;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User Notification Preferences Interface
 */
export interface INotificationPreferences extends Document {
  userId: mongoose.Types.ObjectId;
  promotions: boolean;
  orders: boolean;
  newRestaurants: boolean;
  dailyDeals: boolean;
  events: boolean;
  sponsorMessages: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Notification Schema
 */
const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'order_confirmation',
        'order_status',
        'promotion',
        'deal',
        'sponsor_promo',
        'flash_deal',
        'event_reminder',
        'daily_digest',
        'loyalty_points',
        'general',
      ],
      default: 'general',
    },
    imageUrl: {
      type: String,
    },
    targetId: {
      type: String,
    },
    targetType: {
      type: String,
    },
    data: {
      type: Schema.Types.Mixed,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, type: 1 });

/**
 * Notification Preferences Schema
 */
const NotificationPreferencesSchema = new Schema<INotificationPreferences>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    promotions: {
      type: Boolean,
      default: true,
    },
    orders: {
      type: Boolean,
      default: true,
    },
    newRestaurants: {
      type: Boolean,
      default: true,
    },
    dailyDeals: {
      type: Boolean,
      default: true,
    },
    events: {
      type: Boolean,
      default: true,
    },
    sponsorMessages: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
export const NotificationPreferences = mongoose.model<INotificationPreferences>(
  'NotificationPreferences',
  NotificationPreferencesSchema
);

export default { Notification, NotificationPreferences };
