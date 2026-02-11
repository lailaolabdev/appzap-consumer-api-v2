import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Hotel Types
 */
export type HotelType = 
  | 'hotel'       // Standard hotel
  | 'resort'      // Resort with facilities
  | 'boutique'    // Boutique hotel
  | 'guesthouse'  // Guesthouse
  | 'hostel'      // Backpacker hostel
  | 'apartment'   // Serviced apartment
  | 'villa';      // Villa rental

/**
 * Amenity categories
 */
export type AmenityCategory = 
  | 'general'     // WiFi, Parking, etc.
  | 'room'        // AC, TV, etc.
  | 'dining'      // Restaurant, Breakfast, etc.
  | 'recreation'  // Pool, Gym, Spa, etc.
  | 'service'     // Concierge, Laundry, etc.
  | 'business';   // Meeting room, Business center

/**
 * Room Type Interface
 */
export interface IRoomType {
  name: string;
  nameLocal?: string;
  description?: string;
  maxOccupancy: number;
  bedType: string;          // 'single', 'double', 'twin', 'king', etc.
  size?: number;            // in sqm
  amenities: string[];
  images: string[];
  pricePerNight: {
    amount: number;
    currency: 'LAK' | 'USD' | 'THB';
  };
  isAvailable: boolean;
}

/**
 * Contact Info Interface
 */
export interface IHotelContact {
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  lineId?: string;
  wechatId?: string;
}

/**
 * Price Range Interface
 */
export interface IPriceRange {
  min: number;
  max: number;
  currency: 'LAK' | 'USD' | 'THB';
}

/**
 * Hotel Interface
 */
export interface IHotel extends Document {
  // Basic Info
  name: string;
  nameLocal?: string;
  description: string;
  descriptionLocal?: string;
  
  // Type & Category
  hotelType: HotelType;
  starRating: number;           // 1-5 stars
  
  // Location
  landmark?: mongoose.Types.ObjectId;  // Reference to Landmark
  landmarkName?: string;        // Denormalized for quick access
  address: string;
  addressLocal?: string;
  province: string;
  district?: string;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  
  // Contact
  contact: IHotelContact;
  
  // Media
  thumbnailUrl: string;
  images: string[];
  videoUrl?: string;
  virtualTourUrl?: string;
  
  // Amenities
  amenities: string[];          // List of amenity codes
  amenitiesByCategory?: {
    general?: string[];
    room?: string[];
    dining?: string[];
    recreation?: string[];
    service?: string[];
    business?: string[];
  };
  
  // Room Types (for display, not for booking)
  roomTypes?: IRoomType[];
  
  // Pricing
  priceRange: IPriceRange;
  
  // Ratings & Reviews
  rating: number;               // Average rating 0-5
  reviewCount: number;
  
  // Business/Monetization
  isFeatured: boolean;          // Premium listing
  isVerified: boolean;          // Verified by AppZap
  packageId?: mongoose.Types.ObjectId;  // Reference to monetization package
  
  // Policies
  checkInTime?: string;         // "14:00"
  checkOutTime?: string;        // "12:00"
  policies?: string[];          // ["No smoking", "Pets allowed"]
  
  // Languages
  languagesSpoken?: string[];   // ['en', 'lo', 'th', 'zh']
  
  // Stats
  viewCount: number;
  inquiryCount: number;
  bookingCount: number;
  
  // Status
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  incrementViewCount(): Promise<IHotel>;
  incrementInquiryCount(): Promise<IHotel>;
}

/**
 * Room Type Schema
 */
const RoomTypeSchema = new Schema<IRoomType>(
  {
    name: { type: String, required: true, trim: true },
    nameLocal: { type: String, trim: true },
    description: { type: String, trim: true, maxlength: 500 },
    maxOccupancy: { type: Number, required: true, min: 1, max: 10 },
    bedType: { type: String, required: true, trim: true },
    size: { type: Number, min: 1 },
    amenities: [{ type: String, trim: true }],
    images: [{ type: String, trim: true }],
    pricePerNight: {
      amount: { type: Number, required: true, min: 0 },
      currency: { type: String, enum: ['LAK', 'USD', 'THB'], default: 'USD' },
    },
    isAvailable: { type: Boolean, default: true },
  },
  { _id: false }
);

/**
 * Contact Schema
 */
const HotelContactSchema = new Schema<IHotelContact>(
  {
    phone: { type: String, trim: true },
    whatsapp: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    website: { type: String, trim: true },
    lineId: { type: String, trim: true },
    wechatId: { type: String, trim: true },
  },
  { _id: false }
);

/**
 * Price Range Schema
 */
const PriceRangeSchema = new Schema<IPriceRange>(
  {
    min: { type: Number, required: true, min: 0 },
    max: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['LAK', 'USD', 'THB'], default: 'USD' },
  },
  { _id: false }
);

/**
 * Hotel Schema
 */
const HotelSchema = new Schema<IHotel>(
  {
    // Basic Info
    name: {
      type: String,
      required: [true, 'Hotel name is required'],
      trim: true,
      maxlength: 200,
    },
    nameLocal: { type: String, trim: true, maxlength: 200 },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: 2000,
    },
    descriptionLocal: { type: String, trim: true, maxlength: 2000 },
    
    // Type & Category
    hotelType: {
      type: String,
      enum: ['hotel', 'resort', 'boutique', 'guesthouse', 'hostel', 'apartment', 'villa'],
      required: true,
      index: true,
    },
    starRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      index: true,
    },
    
    // Location
    landmark: { 
      type: Schema.Types.ObjectId, 
      ref: 'Landmark',
      index: true,
    },
    landmarkName: { type: String, trim: true },
    address: { type: String, required: true, trim: true, maxlength: 500 },
    addressLocal: { type: String, trim: true, maxlength: 500 },
    province: { type: String, required: true, trim: true, index: true },
    district: { type: String, trim: true },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    
    // Contact
    contact: { type: HotelContactSchema, default: () => ({}) },
    
    // Media
    thumbnailUrl: { type: String, required: true, trim: true },
    images: [{ type: String, trim: true }],
    videoUrl: { type: String, trim: true },
    virtualTourUrl: { type: String, trim: true },
    
    // Amenities
    amenities: [{ type: String, trim: true }],
    amenitiesByCategory: {
      general: [{ type: String }],
      room: [{ type: String }],
      dining: [{ type: String }],
      recreation: [{ type: String }],
      service: [{ type: String }],
      business: [{ type: String }],
    },
    
    // Room Types
    roomTypes: [RoomTypeSchema],
    
    // Pricing
    priceRange: { type: PriceRangeSchema, required: true },
    
    // Ratings & Reviews
    rating: { type: Number, default: 0, min: 0, max: 5, index: true },
    reviewCount: { type: Number, default: 0, min: 0 },
    
    // Business/Monetization
    isFeatured: { type: Boolean, default: false, index: true },
    isVerified: { type: Boolean, default: false },
    packageId: { type: Schema.Types.ObjectId, ref: 'RestaurantPackage' },
    
    // Policies
    checkInTime: { type: String, default: '14:00' },
    checkOutTime: { type: String, default: '12:00' },
    policies: [{ type: String, trim: true }],
    
    // Languages
    languagesSpoken: [{ type: String, trim: true }],
    
    // Stats
    viewCount: { type: Number, default: 0 },
    inquiryCount: { type: Number, default: 0 },
    bookingCount: { type: Number, default: 0 },
    
    // Status
    status: {
      type: String,
      enum: ['active', 'inactive', 'pending', 'suspended'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'hotels',
  }
);

// Indexes
HotelSchema.index({ location: '2dsphere' });
HotelSchema.index({ name: 'text', description: 'text' });
HotelSchema.index({ status: 1, isFeatured: -1, rating: -1 });
HotelSchema.index({ status: 1, province: 1, hotelType: 1 });
HotelSchema.index({ status: 1, 'priceRange.min': 1 });
HotelSchema.index({ landmark: 1, status: 1 });

// Methods
HotelSchema.methods.incrementViewCount = async function(): Promise<IHotel> {
  this.viewCount += 1;
  return await this.save();
};

HotelSchema.methods.incrementInquiryCount = async function(): Promise<IHotel> {
  this.inquiryCount += 1;
  return await this.save();
};

// Transform output
HotelSchema.methods.toJSON = function() {
  const hotel = this.toObject();
  delete hotel.__v;
  return hotel;
};

// Model
const Hotel: Model<IHotel> = mongoose.model<IHotel>('Hotel', HotelSchema);

export default Hotel;
