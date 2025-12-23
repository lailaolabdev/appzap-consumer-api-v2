import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDeliveryAddress extends Document {
  userId: mongoose.Types.ObjectId;
  label: string; // e.g., "Home", "Office", "Shop"
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  district: string;
  city: string;
  province: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DeliveryAddressSchema = new Schema<IDeliveryAddress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    recipientName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    addressLine1: {
      type: String,
      required: true,
      trim: true,
    },
    addressLine2: {
      type: String,
      trim: true,
    },
    district: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    province: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    postalCode: {
      type: String,
      trim: true,
    },
    latitude: {
      type: Number,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'delivery_addresses',
  }
);

// Indexes
DeliveryAddressSchema.index({ userId: 1, isDefault: -1, createdAt: -1 });
DeliveryAddressSchema.index({ province: 1, city: 1, district: 1 });

// Ensure only one default address per user
DeliveryAddressSchema.pre('save', async function (next) {
  if (this.isDefault && this.isModified('isDefault')) {
    // Remove default from other addresses
    await DeliveryAddress.updateMany(
      {
        userId: this.userId,
        _id: { $ne: this._id },
      },
      { isDefault: false }
    );
  }
  next();
});

// Model
const DeliveryAddress: Model<IDeliveryAddress> = mongoose.model<IDeliveryAddress>(
  'DeliveryAddress',
  DeliveryAddressSchema
);

export default DeliveryAddress;

