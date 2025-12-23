import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISupplementNutrition {
  servingSize: string; // e.g., "2 capsules", "1 scoop (30g)"
  servingsPerContainer: number;
  nutrientsPer Serving: {
    name: string; // e.g., "Protein", "Vitamin D", "Omega-3"
    amount: number;
    unit: string; // g, mg, mcg, IU
    dailyValue?: number; // percentage
  }[];
}

export interface ISupplement extends Document {
  supplementCode: string;
  name: string;
  brand?: string;
  description: string;
  imageUrl?: string;
  
  // Category
  category: 'protein' | 'vitamins' | 'minerals' | 'pre_workout' | 'post_workout' | 'omega' | 'probiotics' | 'energy' | 'other';
  subCategory?: string;
  
  // Product Details
  type: 'powder' | 'capsules' | 'tablets' | 'liquid' | 'gummies' | 'bars';
  flavor?: string;
  size?: string; // e.g., "1kg", "60 capsules"
  
  // Nutrition & Ingredients
  nutrition: ISupplementNutrition;
  ingredients: string[];
  allergens?: string[];
  
  // Usage
  recommendedDosage: string;
  timing?: string[]; // morning, pre-workout, post-workout, before-bed
  benefitsFor: string[]; // muscle-gain, weight-loss, energy, immunity, etc.
  
  // Tags for filtering
  tags: string[]; // vegan, gluten-free, non-gmo, organic, etc.
  healthGoals: string[]; // weight_loss, muscle_gain, energy, immunity, etc.
  
  // Certifications
  certifications?: string[]; // FDA, USDA Organic, NSF Certified, etc.
  
  // Pricing
  price: number;
  comparePrice?: number; // original price if on sale
  pricePerServing: number;
  discountPercent?: number;
  
  // Stock & Availability
  isActive: boolean;
  stock: number;
  isInStock: boolean;
  lowStockThreshold: number;
  
  // Ratings & Reviews
  rating: number; // 0-5
  reviewCount: number;
  
  // SEO & Marketing
  shortDescription?: string;
  longDescription?: string;
  howToUse?: string;
  warnings?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  decrementStock(quantity: number): Promise<ISupplement>;
  incrementStock(quantity: number): Promise<ISupplement>;
  checkStock(): boolean;
  calculatePricePerServing(): number;
}

// Sub-schemas
const SupplementNutritionSchema = new Schema<ISupplementNutrition>(
  {
    servingSize: { type: String, required: true, trim: true },
    servingsPerContainer: { type: Number, required: true, min: 1 },
    nutrientsPerServing: [
      {
        name: { type: String, required: true, trim: true },
        amount: { type: Number, required: true, min: 0 },
        unit: { type: String, required: true, trim: true },
        dailyValue: { type: Number, min: 0, max: 1000 },
      },
    ],
  },
  { _id: false }
);

// Main Supplement Schema
const SupplementSchema = new Schema<ISupplement>(
  {
    supplementCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    brand: {
      type: String,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    
    // Category
    category: {
      type: String,
      enum: [
        'protein',
        'vitamins',
        'minerals',
        'pre_workout',
        'post_workout',
        'omega',
        'probiotics',
        'energy',
        'other',
      ],
      required: true,
      index: true,
    },
    subCategory: {
      type: String,
      trim: true,
    },
    
    // Product Details
    type: {
      type: String,
      enum: ['powder', 'capsules', 'tablets', 'liquid', 'gummies', 'bars'],
      required: true,
    },
    flavor: {
      type: String,
      trim: true,
    },
    size: {
      type: String,
      trim: true,
    },
    
    // Nutrition & Ingredients
    nutrition: {
      type: SupplementNutritionSchema,
      required: true,
    },
    ingredients: {
      type: [String],
      required: true,
    },
    allergens: {
      type: [String],
      default: [],
    },
    
    // Usage
    recommendedDosage: {
      type: String,
      required: true,
      trim: true,
    },
    timing: {
      type: [String],
      default: [],
    },
    benefitsFor: {
      type: [String],
      default: [],
      index: true,
    },
    
    // Tags
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    healthGoals: {
      type: [String],
      default: [],
      index: true,
    },
    
    // Certifications
    certifications: {
      type: [String],
      default: [],
    },
    
    // Pricing
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    comparePrice: {
      type: Number,
      min: 0,
    },
    pricePerServing: {
      type: Number,
      required: true,
      min: 0,
    },
    discountPercent: {
      type: Number,
      min: 0,
      max: 100,
    },
    
    // Stock & Availability
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    isInStock: {
      type: Boolean,
      default: true,
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
      min: 0,
    },
    
    // Ratings & Reviews
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    // SEO & Marketing
    shortDescription: {
      type: String,
      trim: true,
    },
    longDescription: {
      type: String,
      trim: true,
    },
    howToUse: {
      type: String,
      trim: true,
    },
    warnings: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'supplements',
  }
);

// Indexes
SupplementSchema.index({ isActive: 1, isInStock: 1 });
SupplementSchema.index({ category: 1, isActive: 1 });
SupplementSchema.index({ tags: 1, isActive: 1 });
SupplementSchema.index({ healthGoals: 1, isActive: 1 });
SupplementSchema.index({ price: 1 });
SupplementSchema.index({ brand: 1, isActive: 1 });
SupplementSchema.index({ rating: -1, reviewCount: -1 });

// Methods
SupplementSchema.methods.decrementStock = async function (quantity: number): Promise<ISupplement> {
  if (this.stock < quantity) {
    throw new Error('Insufficient stock');
  }
  
  this.stock -= quantity;
  this.isInStock = this.stock > 0;
  
  return await this.save();
};

SupplementSchema.methods.incrementStock = async function (quantity: number): Promise<ISupplement> {
  this.stock += quantity;
  this.isInStock = true;
  
  return await this.save();
};

SupplementSchema.methods.checkStock = function (): boolean {
  return this.stock > 0 && this.isActive;
};

SupplementSchema.methods.calculatePricePerServing = function (): number {
  if (this.nutrition.servingsPerContainer > 0) {
    this.pricePerServing = Math.round((this.price / this.nutrition.servingsPerContainer) * 100) / 100;
  }
  return this.pricePerServing;
};

// Pre-save middleware
SupplementSchema.pre('save', function (next) {
  if (this.isModified('price') || this.isModified('nutrition.servingsPerContainer')) {
    this.calculatePricePerServing();
  }
  
  if (this.isModified('stock')) {
    this.isInStock = this.stock > 0;
  }
  
  if (this.comparePrice && this.price < this.comparePrice) {
    this.discountPercent = Math.round(((this.comparePrice - this.price) / this.comparePrice) * 100);
  }
  
  next();
});

// Model
const Supplement: Model<ISupplement> = mongoose.model<ISupplement>('Supplement', SupplementSchema);

export default Supplement;

