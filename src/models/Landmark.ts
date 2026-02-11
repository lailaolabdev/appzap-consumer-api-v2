import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Landmark Types
 * Used for categorizing landmarks in Laos
 */
export type LandmarkType = 
  | 'district'      // Administrative districts (Dongdok, Sihom, etc.)
  | 'attraction'    // Tourist attractions (Patuxay, That Luang)
  | 'mall'          // Shopping centers (Vientiane Center, ITECC)
  | 'university'    // Educational institutions (NUOL)
  | 'transport'     // Bus stations, airports
  | 'market'        // Markets (Morning Market, Night Market)
  | 'hospital'      // Hospitals
  | 'hotel_area'    // Hotel zones
  | 'embassy'       // Embassy areas
  | 'other';

/**
 * Landmark Interface
 */
export interface ILandmark extends Document {
  // Basic Info
  name: string;                 // English name (primary)
  nameLocal: string;            // Lao name (ພາສາລາວ)
  nameThai?: string;            // Thai name (for Thai tourists)
  nameChinese?: string;         // Chinese name (中文)
  nameKorean?: string;          // Korean name (한국어)
  
  // Type & Category
  type: LandmarkType;
  
  // Location
  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  radius: number;               // Search radius in meters
  province: string;             // Province name
  district?: string;            // District name (if applicable)
  
  // Description
  description?: string;         // English description
  descriptionLocal?: string;    // Lao description
  
  // Media
  thumbnailUrl?: string;
  images?: string[];
  
  // Search & Discovery
  searchKeywords: string[];     // For text search: ["dongdok", "dong dok", "ດົງໂດກ"]
  isPopular: boolean;           // Show in "Popular Landmarks"
  sortOrder: number;            // For custom ordering
  
  // Stats
  viewCount: number;
  searchCount: number;
  
  // Status
  isActive: boolean;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  incrementViewCount(): Promise<ILandmark>;
  incrementSearchCount(): Promise<ILandmark>;
}

/**
 * Landmark Schema
 */
const LandmarkSchema = new Schema<ILandmark>(
  {
    // Basic Info
    name: { 
      type: String, 
      required: [true, 'Landmark name is required'],
      trim: true,
      maxlength: 200,
    },
    nameLocal: { 
      type: String, 
      required: [true, 'Lao name is required'],
      trim: true,
      maxlength: 200,
    },
    nameThai: { type: String, trim: true, maxlength: 200 },
    nameChinese: { type: String, trim: true, maxlength: 200 },
    nameKorean: { type: String, trim: true, maxlength: 200 },
    
    // Type
    type: { 
      type: String, 
      enum: ['district', 'attraction', 'mall', 'university', 'transport', 'market', 'hospital', 'hotel_area', 'embassy', 'other'],
      required: true,
      index: true,
    },
    
    // Location (GeoJSON Point)
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
        validate: {
          validator: function(coords: number[]) {
            return coords.length === 2 && 
                   coords[0] >= -180 && coords[0] <= 180 && // longitude
                   coords[1] >= -90 && coords[1] <= 90;     // latitude
          },
          message: 'Invalid coordinates',
        },
      },
    },
    radius: { 
      type: Number, 
      required: true, 
      default: 1000, // 1km default
      min: 100,
      max: 50000,
    },
    province: { 
      type: String, 
      required: true, 
      trim: true,
      index: true,
    },
    district: { type: String, trim: true },
    
    // Description
    description: { type: String, trim: true, maxlength: 1000 },
    descriptionLocal: { type: String, trim: true, maxlength: 1000 },
    
    // Media
    thumbnailUrl: { type: String, trim: true },
    images: [{ type: String, trim: true }],
    
    // Search & Discovery
    searchKeywords: [{ 
      type: String, 
      trim: true, 
      lowercase: true,
    }],
    isPopular: { type: Boolean, default: false, index: true },
    sortOrder: { type: Number, default: 0 },
    
    // Stats
    viewCount: { type: Number, default: 0 },
    searchCount: { type: Number, default: 0 },
    
    // Status
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
    collection: 'landmarks',
  }
);

// Indexes
LandmarkSchema.index({ location: '2dsphere' }); // Geospatial index
LandmarkSchema.index({ name: 'text', nameLocal: 'text', searchKeywords: 'text' }); // Text search
LandmarkSchema.index({ isPopular: 1, sortOrder: 1 });
LandmarkSchema.index({ type: 1, province: 1 });
LandmarkSchema.index({ isActive: 1, type: 1 });

// Methods
LandmarkSchema.methods.incrementViewCount = async function(): Promise<ILandmark> {
  this.viewCount += 1;
  return await this.save();
};

LandmarkSchema.methods.incrementSearchCount = async function(): Promise<ILandmark> {
  this.searchCount += 1;
  return await this.save();
};

// Statics
LandmarkSchema.statics.findByKeyword = async function(keyword: string, limit = 10) {
  const regex = new RegExp(keyword, 'i');
  return this.find({
    isActive: true,
    $or: [
      { name: regex },
      { nameLocal: regex },
      { searchKeywords: regex },
    ],
  })
  .limit(limit)
  .sort({ isPopular: -1, sortOrder: 1 });
};

LandmarkSchema.statics.findPopular = async function(limit = 10) {
  return this.find({ isActive: true, isPopular: true })
    .sort({ sortOrder: 1, viewCount: -1 })
    .limit(limit);
};

LandmarkSchema.statics.findNearby = async function(
  longitude: number, 
  latitude: number, 
  maxDistance = 5000, // 5km default
  limit = 10
) {
  return this.find({
    isActive: true,
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        $maxDistance: maxDistance,
      },
    },
  }).limit(limit);
};

// Transform output
LandmarkSchema.methods.toJSON = function() {
  const landmark = this.toObject();
  delete landmark.__v;
  return landmark;
};

// Model
const Landmark: Model<ILandmark> = mongoose.model<ILandmark>('Landmark', LandmarkSchema);

export default Landmark;
