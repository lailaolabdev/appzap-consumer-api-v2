import mongoose, { Schema, Document, Model } from 'mongoose';

export interface INutritionInfo {
  calories: number;
  protein: number; // grams
  carbs: number; // grams
  fats: number; // grams
  fiber: number; // grams
  sodium?: number; // mg
  sugar?: number; // grams
}

export interface IMeal {
  mealId: string; // Reference to actual meal/recipe
  name: string;
  description?: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  imageUrl?: string;
  prepTime?: number; // minutes
  cookTime?: number; // minutes
  servings: number;
  nutrition: INutritionInfo;
  ingredients: string[];
  tags: string[]; // vegetarian, vegan, gluten-free, high-protein, low-carb, etc.
  isAvailable: boolean;
}

export interface IMealPlan extends Document {
  planCode: string;
  name: string;
  description: string;
  imageUrl?: string;
  
  // Plan Details
  duration: number; // days (7 for weekly, 30 for monthly)
  mealsPerDay: number; // 2, 3, 4
  totalMeals: number; // duration * mealsPerDay
  
  // Target Audience
  dietaryTags: string[]; // vegetarian, vegan, keto, paleo, low-carb, high-protein, etc.
  healthGoals: string[]; // weight_loss, muscle_gain, energy, etc.
  
  // Meals (array of meals for the entire plan)
  meals: IMeal[];
  
  // Nutrition Summary
  avgDailyCalories: number;
  avgDailyProtein: number;
  avgDailyCarbs: number;
  avgDailyFats: number;
  
  // Pricing
  price: number;
  pricePerMeal: number;
  discountPercent?: number;
  
  // Availability
  isActive: boolean;
  stock?: number; // null = unlimited
  maxSubscribers?: number;
  currentSubscribers: number;
  
  // Features
  features: string[]; // "Nutritionist approved", "Chef prepared", "Organic ingredients"
  
  // Chef/Creator
  createdBy?: string;
  nutritionistApproved: boolean;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  
  // Methods
  calculateAverageNutrition(): void;
  isCompatibleWithHealthProfile(profileId: string): Promise<boolean>;
  incrementSubscribers(): Promise<IMealPlan>;
  decrementSubscribers(): Promise<IMealPlan>;
}

// Sub-schemas
const NutritionInfoSchema = new Schema<INutritionInfo>(
  {
    calories: { type: Number, required: true, min: 0 },
    protein: { type: Number, required: true, min: 0 },
    carbs: { type: Number, required: true, min: 0 },
    fats: { type: Number, required: true, min: 0 },
    fiber: { type: Number, required: true, min: 0 },
    sodium: { type: Number, min: 0 },
    sugar: { type: Number, min: 0 },
  },
  { _id: false }
);

const MealSchema = new Schema<IMeal>(
  {
    mealId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    mealType: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner', 'snack'],
      required: true,
    },
    imageUrl: { type: String, trim: true },
    prepTime: { type: Number, min: 0 },
    cookTime: { type: Number, min: 0 },
    servings: { type: Number, required: true, min: 1 },
    nutrition: { type: NutritionInfoSchema, required: true },
    ingredients: { type: [String], default: [] },
    tags: { type: [String], default: [], index: true },
    isAvailable: { type: Boolean, default: true },
  },
  { _id: true }
);

// Main MealPlan Schema
const MealPlanSchema = new Schema<IMealPlan>(
  {
    planCode: {
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
    description: {
      type: String,
      required: true,
      trim: true,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    
    // Plan Details
    duration: {
      type: Number,
      required: true,
      min: 1,
      max: 90,
    },
    mealsPerDay: {
      type: Number,
      required: true,
      min: 2,
      max: 6,
    },
    totalMeals: {
      type: Number,
      required: true,
      min: 1,
    },
    
    // Target Audience
    dietaryTags: {
      type: [String],
      default: [],
      index: true,
    },
    healthGoals: {
      type: [String],
      default: [],
      index: true,
    },
    
    // Meals
    meals: {
      type: [MealSchema],
      required: true,
      validate: {
        validator: function (meals: IMeal[]) {
          return meals.length === this.totalMeals;
        },
        message: 'Number of meals must match totalMeals',
      },
    },
    
    // Nutrition Summary
    avgDailyCalories: {
      type: Number,
      required: true,
      min: 800,
      max: 5000,
    },
    avgDailyProtein: {
      type: Number,
      required: true,
      min: 20,
    },
    avgDailyCarbs: {
      type: Number,
      required: true,
      min: 20,
    },
    avgDailyFats: {
      type: Number,
      required: true,
      min: 10,
    },
    
    // Pricing
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    pricePerMeal: {
      type: Number,
      required: true,
      min: 0,
    },
    discountPercent: {
      type: Number,
      min: 0,
      max: 100,
    },
    
    // Availability
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    stock: {
      type: Number,
      min: 0,
    },
    maxSubscribers: {
      type: Number,
      min: 0,
    },
    currentSubscribers: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    // Features
    features: {
      type: [String],
      default: [],
    },
    
    // Chef/Creator
    createdBy: {
      type: String,
      trim: true,
    },
    nutritionistApproved: {
      type: Boolean,
      default: false,
    },
    
    publishedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'meal_plans',
  }
);

// Indexes
MealPlanSchema.index({ isActive: 1, publishedAt: -1 });
MealPlanSchema.index({ dietaryTags: 1, isActive: 1 });
MealPlanSchema.index({ healthGoals: 1, isActive: 1 });
MealPlanSchema.index({ price: 1 });
MealPlanSchema.index({ 'meals.tags': 1 });

// Methods
MealPlanSchema.methods.calculateAverageNutrition = function (): void {
  if (!this.meals || this.meals.length === 0) {
    return;
  }
  
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFats = 0;
  
  this.meals.forEach((meal: IMeal) => {
    totalCalories += meal.nutrition.calories;
    totalProtein += meal.nutrition.protein;
    totalCarbs += meal.nutrition.carbs;
    totalFats += meal.nutrition.fats;
  });
  
  this.avgDailyCalories = Math.round(totalCalories / this.duration);
  this.avgDailyProtein = Math.round(totalProtein / this.duration);
  this.avgDailyCarbs = Math.round(totalCarbs / this.duration);
  this.avgDailyFats = Math.round(totalFats / this.duration);
};

MealPlanSchema.methods.isCompatibleWithHealthProfile = async function (
  profileId: string
): Promise<boolean> {
  const HealthProfile = mongoose.model('HealthProfile');
  const profile = await HealthProfile.findById(profileId);
  
  if (!profile) {
    return true; // If no profile, allow all
  }
  
  // Check each meal for compatibility
  for (const meal of this.meals) {
    if (!profile.isCompatibleWith(meal.tags)) {
      return false;
    }
  }
  
  return true;
};

MealPlanSchema.methods.incrementSubscribers = async function (): Promise<IMealPlan> {
  this.currentSubscribers += 1;
  return await this.save();
};

MealPlanSchema.methods.decrementSubscribers = async function (): Promise<IMealPlan> {
  if (this.currentSubscribers > 0) {
    this.currentSubscribers -= 1;
  }
  return await this.save();
};

// Pre-save middleware
MealPlanSchema.pre('save', function (next) {
  if (this.isModified('meals') || this.isModified('duration')) {
    this.totalMeals = this.duration * this.mealsPerDay;
    this.calculateAverageNutrition();
    this.pricePerMeal = this.totalMeals > 0 ? Math.round(this.price / this.totalMeals) : 0;
  }
  next();
});

// Model
const MealPlan: Model<IMealPlan> = mongoose.model<IMealPlan>('MealPlan', MealPlanSchema);

export default MealPlan;

