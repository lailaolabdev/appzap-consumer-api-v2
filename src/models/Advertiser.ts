import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Advertiser Category - For exclusivity management
 */
export type AdvertiserCategory =
  | 'beverage_beer'      // Heineken, Tiger, Beerlao
  | 'beverage_soft'      // Coca-Cola, Pepsi
  | 'beverage_alcohol'   // Spirits, wine
  | 'food_fmcg'          // Unilever, Nestle
  | 'telecom'            // Unitel, Lao Telecom
  | 'banking'            // BCEL, JDB Bank
  | 'tourism'            // Airlines, tour operators
  | 'automotive'         // Car brands
  | 'retail'             // Shopping malls
  | 'technology'         // Tech companies
  | 'healthcare'         // Hospitals, pharma
  | 'other';

/**
 * Contract Status
 */
export type ContractStatus =
  | 'pending'     // Contract being negotiated
  | 'active'      // Contract active and running
  | 'paused'      // Temporarily paused
  | 'expired'     // Contract ended
  | 'cancelled';  // Contract cancelled

/**
 * Product Scope - Which AppZap products they can advertise on
 */
export type ProductScope = 'eat' | 'market' | 'activity' | 'stay' | 'home' | 'all';

/**
 * Contract Interface
 */
export interface IContract {
  startDate: Date;
  endDate: Date;
  monthlyBudget: number;
  totalBudget: number;
  currency: 'LAK' | 'USD';
  amountSpent: number;
  productScope: ProductScope[];
  exclusivePlacements: string[];  // Placement IDs they have exclusive rights to
  terms?: string;
  signedAt?: Date;
}

/**
 * Contact Person Interface
 */
export interface IContactPerson {
  name: string;
  email: string;
  phone?: string;
  role?: string;  // Marketing Manager, Brand Manager, etc.
}

/**
 * Advertiser Interface
 */
export interface IAdvertiser extends Document {
  // Basic Info
  name: string;                   // "Heineken"
  companyName: string;            // "Heineken Laos Co., Ltd"
  logo?: string;                  // Logo URL
  website?: string;
  
  // Category (for exclusivity)
  category: AdvertiserCategory;
  
  // Contact
  contacts: IContactPerson[];
  billingEmail?: string;
  billingAddress?: string;
  
  // Contract
  contract: IContract;
  
  // Status
  status: ContractStatus;
  
  // Stats
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;           // Revenue generated for AppZap
  
  // Notes
  notes?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  isActive(): boolean;
  getRemainingBudget(): number;
  getDaysRemaining(): number;
}

/**
 * Contact Person Schema
 */
const ContactPersonSchema = new Schema<IContactPerson>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    role: { type: String, trim: true },
  },
  { _id: false }
);

/**
 * Contract Schema
 */
const ContractSchema = new Schema<IContract>(
  {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    monthlyBudget: { type: Number, required: true, min: 0 },
    totalBudget: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['LAK', 'USD'], default: 'USD' },
    amountSpent: { type: Number, default: 0, min: 0 },
    productScope: [{
      type: String,
      enum: ['eat', 'market', 'activity', 'stay', 'home', 'all'],
    }],
    exclusivePlacements: [{ type: String, trim: true }],
    terms: { type: String },
    signedAt: { type: Date },
  },
  { _id: false }
);

/**
 * Advertiser Schema
 */
const AdvertiserSchema = new Schema<IAdvertiser>(
  {
    name: {
      type: String,
      required: [true, 'Advertiser name is required'],
      trim: true,
      maxlength: 100,
      index: true,
    },
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      maxlength: 200,
    },
    logo: { type: String, trim: true },
    website: { type: String, trim: true },
    
    category: {
      type: String,
      enum: [
        'beverage_beer', 'beverage_soft', 'beverage_alcohol',
        'food_fmcg', 'telecom', 'banking', 'tourism',
        'automotive', 'retail', 'technology', 'healthcare', 'other'
      ],
      required: true,
      index: true,
    },
    
    contacts: {
      type: [ContactPersonSchema],
      validate: [
        (arr: IContactPerson[]) => arr.length > 0,
        'At least one contact person is required'
      ],
    },
    billingEmail: { type: String, trim: true, lowercase: true },
    billingAddress: { type: String, trim: true },
    
    contract: { type: ContractSchema, required: true },
    
    status: {
      type: String,
      enum: ['pending', 'active', 'paused', 'expired', 'cancelled'],
      default: 'pending',
      index: true,
    },
    
    totalImpressions: { type: Number, default: 0, min: 0 },
    totalClicks: { type: Number, default: 0, min: 0 },
    totalConversions: { type: Number, default: 0, min: 0 },
    totalRevenue: { type: Number, default: 0, min: 0 },
    
    notes: { type: String, trim: true, maxlength: 1000 },
  },
  {
    timestamps: true,
    collection: 'advertisers',
  }
);

// Indexes
AdvertiserSchema.index({ status: 1, category: 1 });
AdvertiserSchema.index({ 'contract.endDate': 1 });
AdvertiserSchema.index({ 'contract.productScope': 1 });

// Methods
AdvertiserSchema.methods.isActive = function(): boolean {
  const now = new Date();
  return (
    this.status === 'active' &&
    this.contract.startDate <= now &&
    this.contract.endDate >= now &&
    this.contract.amountSpent < this.contract.totalBudget
  );
};

AdvertiserSchema.methods.getRemainingBudget = function(): number {
  return this.contract.totalBudget - this.contract.amountSpent;
};

AdvertiserSchema.methods.getDaysRemaining = function(): number {
  const now = new Date();
  const end = new Date(this.contract.endDate);
  const diffTime = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
};

// Transform output
AdvertiserSchema.methods.toJSON = function() {
  const advertiser = this.toObject();
  delete advertiser.__v;
  return advertiser;
};

// Model
const Advertiser: Model<IAdvertiser> = mongoose.model<IAdvertiser>('Advertiser', AdvertiserSchema);

export default Advertiser;
