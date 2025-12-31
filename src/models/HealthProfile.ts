// @ts-nocheck
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IHealthGoal {
  type: 'weight_loss' | 'muscle_gain' | 'maintenance' | 'energy' | 'immunity' | 'digestion';
  priority: number; // 1-5, higher = more important
  targetDate?: Date;
}

export interface IActivityLevel {
  level: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';
  stepsPerDay?: number;
  workoutFrequency?: number; // times per week
}

export interface IMealPreferences {
  mealsPerDay: number; // 2, 3, 4, 5
  preferredMealTimes: string[]; // e.g., ["08:00", "12:00", "18:00"]
  portionSize: 'small' | 'medium' | 'large';
  spicyLevel: number; // 0-5
  sweetLevel: number; // 0-5
}

export interface IHealthProfile extends Document {
  userId: mongoose.Types.ObjectId;
  
  // Basic Health Info
  age?: number;
  gender?: 'male' | 'female' | 'other';
  height?: number; // cm
  weight?: number; // kg
  targetWeight?: number; // kg
  bmi?: number;
  
  // Dietary Restrictions & Allergies
  dietaryRestrictions: string[]; // vegetarian, vegan, pescatarian, keto, paleo, etc.
  allergies: string[]; // nuts, dairy, gluten, seafood, eggs, soy, etc.
  foodDislikes: string[]; // specific foods to avoid
  
  // Health Goals
  healthGoals: IHealthGoal[];
  
  // Activity Level
  activityLevel: IActivityLevel;
  
  // Meal Preferences
  mealPreferences: IMealPreferences;
  
  // Medical Conditions (optional)
  medicalConditions?: string[]; // diabetes, hypertension, celiac, etc.
  medications?: string[];
  
  // Calculated Nutrition Needs
  dailyCalories?: number;
  dailyProtein?: number; // grams
  dailyCarbs?: number; // grams
  dailyFats?: number; // grams
  dailyFiber?: number; // grams
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastUpdated: Date;
  
  // Methods
  calculateBMI(): number;
  calculateDailyCalories(): number;
  calculateMacros(): { protein: number; carbs: number; fats: number };
  isCompatibleWith(tags: string[]): boolean;
}

// Sub-schemas
const HealthGoalSchema = new Schema<IHealthGoal>(
  {
    type: {
      type: String,
      enum: ['weight_loss', 'muscle_gain', 'maintenance', 'energy', 'immunity', 'digestion'],
      required: true,
    },
    priority: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    targetDate: {
      type: Date,
    },
  },
  { _id: false }
);

const ActivityLevelSchema = new Schema<IActivityLevel>(
  {
    level: {
      type: String,
      enum: ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active'],
      default: 'moderately_active',
    },
    stepsPerDay: {
      type: Number,
      min: 0,
    },
    workoutFrequency: {
      type: Number,
      min: 0,
      max: 14,
    },
  },
  { _id: false }
);

const MealPreferencesSchema = new Schema<IMealPreferences>(
  {
    mealsPerDay: {
      type: Number,
      default: 3,
      min: 2,
      max: 6,
    },
    preferredMealTimes: {
      type: [String],
      default: ['08:00', '12:00', '18:00'],
    },
    portionSize: {
      type: String,
      enum: ['small', 'medium', 'large'],
      default: 'medium',
    },
    spicyLevel: {
      type: Number,
      default: 2,
      min: 0,
      max: 5,
    },
    sweetLevel: {
      type: Number,
      default: 2,
      min: 0,
      max: 5,
    },
  },
  { _id: false }
);

// Main HealthProfile Schema
const HealthProfileSchema = new Schema<IHealthProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    
    // Basic Health Info
    age: {
      type: Number,
      min: 10,
      max: 120,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
    },
    height: {
      type: Number,
      min: 50,
      max: 250,
    },
    weight: {
      type: Number,
      min: 20,
      max: 300,
    },
    targetWeight: {
      type: Number,
      min: 20,
      max: 300,
    },
    bmi: {
      type: Number,
      min: 10,
      max: 60,
    },
    
    // Dietary Restrictions & Allergies
    dietaryRestrictions: {
      type: [String],
      default: [],
      index: true,
    },
    allergies: {
      type: [String],
      default: [],
      index: true,
    },
    foodDislikes: {
      type: [String],
      default: [],
    },
    
    // Health Goals
    healthGoals: {
      type: [HealthGoalSchema],
      default: [],
    },
    
    // Activity Level
    activityLevel: {
      type: ActivityLevelSchema,
      default: () => ({}),
    },
    
    // Meal Preferences
    mealPreferences: {
      type: MealPreferencesSchema,
      default: () => ({}),
    },
    
    // Medical Conditions
    medicalConditions: {
      type: [String],
      default: [],
    },
    medications: {
      type: [String],
      default: [],
    },
    
    // Calculated Nutrition Needs
    dailyCalories: {
      type: Number,
      min: 800,
      max: 5000,
    },
    dailyProtein: {
      type: Number,
      min: 20,
      max: 500,
    },
    dailyCarbs: {
      type: Number,
      min: 50,
      max: 1000,
    },
    dailyFats: {
      type: Number,
      min: 20,
      max: 300,
    },
    dailyFiber: {
      type: Number,
      min: 10,
      max: 100,
    },
    
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'health_profiles',
  }
);

// Indexes
HealthProfileSchema.index({ userId: 1 }, { unique: true });
HealthProfileSchema.index({ dietaryRestrictions: 1 });
HealthProfileSchema.index({ allergies: 1 });
HealthProfileSchema.index({ 'healthGoals.type': 1 });

// Methods
HealthProfileSchema.methods.calculateBMI = function (): number {
  if (!this.height || !this.weight) {
    return 0;
  }
  const heightInMeters = this.height / 100;
  const bmi = this.weight / (heightInMeters * heightInMeters);
  this.bmi = Math.round(bmi * 10) / 10;
  return this.bmi;
};

HealthProfileSchema.methods.calculateDailyCalories = function (): number {
  if (!this.age || !this.gender || !this.height || !this.weight) {
    return 2000; // Default
  }
  
  // Mifflin-St Jeor Equation
  let bmr: number;
  if (this.gender === 'male') {
    bmr = 10 * this.weight + 6.25 * this.height - 5 * this.age + 5;
  } else {
    bmr = 10 * this.weight + 6.25 * this.height - 5 * this.age - 161;
  }
  
  // Activity multiplier
  const activityMultipliers: Record<string, number> = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
    extremely_active: 1.9,
  };
  
  const multiplier = activityMultipliers[this.activityLevel.level] || 1.55;
  let tdee = bmr * multiplier;
  
  // Adjust based on health goals
  const primaryGoal = this.healthGoals.find((g) => g.priority === 5);
  if (primaryGoal) {
    if (primaryGoal.type === 'weight_loss') {
      tdee -= 500; // 500 calorie deficit
    } else if (primaryGoal.type === 'muscle_gain') {
      tdee += 300; // 300 calorie surplus
    }
  }
  
  this.dailyCalories = Math.round(tdee);
  return this.dailyCalories;
};

HealthProfileSchema.methods.calculateMacros = function (): { protein: number; carbs: number; fats: number } {
  const calories = this.dailyCalories || this.calculateDailyCalories();
  
  // Default macro split (can be adjusted based on goals)
  let proteinPercent = 0.3;
  let carbsPercent = 0.4;
  let fatsPercent = 0.3;
  
  // Adjust for specific goals
  const primaryGoal = this.healthGoals.find((g) => g.priority === 5);
  if (primaryGoal) {
    if (primaryGoal.type === 'muscle_gain') {
      proteinPercent = 0.35;
      carbsPercent = 0.45;
      fatsPercent = 0.2;
    } else if (primaryGoal.type === 'weight_loss') {
      proteinPercent = 0.35;
      carbsPercent = 0.3;
      fatsPercent = 0.35;
    }
  }
  
  // Check for keto diet
  if (this.dietaryRestrictions.includes('keto')) {
    proteinPercent = 0.25;
    carbsPercent = 0.05;
    fatsPercent = 0.7;
  }
  
  this.dailyProtein = Math.round((calories * proteinPercent) / 4); // 4 cal per gram
  this.dailyCarbs = Math.round((calories * carbsPercent) / 4);
  this.dailyFats = Math.round((calories * fatsPercent) / 9); // 9 cal per gram
  this.dailyFiber = Math.round(14 * (calories / 1000)); // 14g per 1000 calories
  
  return {
    protein: this.dailyProtein,
    carbs: this.dailyCarbs,
    fats: this.dailyFats,
  };
};

HealthProfileSchema.methods.isCompatibleWith = function (tags: string[]): boolean {
  // Check if meal tags conflict with user's restrictions or allergies
  const allRestrictions = [...this.dietaryRestrictions, ...this.allergies];
  
  // Check for conflicts
  for (const restriction of allRestrictions) {
    const conflictingTags = getConflictingTags(restriction);
    for (const tag of tags) {
      if (conflictingTags.includes(tag.toLowerCase())) {
        return false;
      }
    }
  }
  
  return true;
};

// Helper function to map restrictions to conflicting tags
function getConflictingTags(restriction: string): string[] {
  const conflicts: Record<string, string[]> = {
    vegetarian: ['meat', 'chicken', 'beef', 'pork', 'lamb', 'fish', 'seafood'],
    vegan: ['meat', 'chicken', 'beef', 'pork', 'lamb', 'fish', 'seafood', 'dairy', 'eggs', 'honey'],
    'gluten-free': ['gluten', 'wheat', 'bread'],
    'dairy-free': ['dairy', 'milk', 'cheese', 'butter', 'cream'],
    'nut-free': ['nuts', 'peanuts', 'almonds', 'cashews'],
    'egg-free': ['eggs'],
    halal: ['pork', 'alcohol'],
    kosher: ['pork', 'shellfish'],
  };
  
  return conflicts[restriction.toLowerCase()] || [];
}

// Pre-save middleware
HealthProfileSchema.pre('save', function (next) {
  if (this.isModified('height') || this.isModified('weight')) {
    this.calculateBMI();
  }
  
  if (
    this.isModified('age') ||
    this.isModified('gender') ||
    this.isModified('height') ||
    this.isModified('weight') ||
    this.isModified('activityLevel') ||
    this.isModified('healthGoals')
  ) {
    this.calculateDailyCalories();
    this.calculateMacros();
  }
  
  this.lastUpdated = new Date();
  next();
});

// Model
const HealthProfile: Model<IHealthProfile> = mongoose.model<IHealthProfile>(
  'HealthProfile',
  HealthProfileSchema
);

export default HealthProfile;


