import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRecommendedRestaurant extends Document {
    // Mapping to unified RestaurantRegistry schema
    unifiedId: string;

    // Promotion Schedule Windows
    startDate: Date;
    endDate: Date;

    // Sorting Control (Priority 1 = Highest / First Output)
    priorityIndex: number;

    // Tracking Admin action
    createdBy: string;
    isActive: boolean;

    createdAt: Date;
    updatedAt: Date;
}

const RecommendedRestaurantSchema = new Schema<IRecommendedRestaurant>(
    {
        unifiedId: {
            type: String,
            required: true,
            index: true,
            ref: 'RestaurantRegistry'
        },
        startDate: {
            type: Date,
            required: true,
            index: true,
        },
        endDate: {
            type: Date,
            required: true,
            index: true,
        },
        priorityIndex: {
            type: Number,
            required: true,
            default: 5, // Range 1-10
            min: 1,
            max: 10,
        },
        createdBy: {
            type: String,
            required: true,
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
    },
    {
        timestamps: true,
        collection: 'recommended_restaurants',
    }
);

// Compound Index to explicitly quickly find valid "Active Targets" across the temporal query
RecommendedRestaurantSchema.index({ isActive: 1, startDate: 1, endDate: 1, priorityIndex: 1 });

const RecommendedRestaurant = mongoose.model<IRecommendedRestaurant>('RecommendedRestaurant', RecommendedRestaurantSchema);

export default RecommendedRestaurant;
