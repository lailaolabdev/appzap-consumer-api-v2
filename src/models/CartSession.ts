import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ICartSession extends Document {
    phone: string;
    userId?: mongoose.Types.ObjectId;
    restaurantId: string;
    tableId?: string;
    items: Array<{
        productId: string;
        productName: string;
        quantity: number;
        unitPrice: number;
        modifiers?: Array<{
            groupId: string;
            optionId: string;
            optionName: string;
            priceContribution: number;
        }>;
        specialInstructions?: string;
    }>;
    status: 'active' | 'abandoned' | 'converted';
    expiresAt: Date;
}

const cartSessionSchema = new Schema<ICartSession>({
    phone: {
        type: String,
        required: true,
        index: true,
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    restaurantId: {
        type: String,
        required: true,
    },
    tableId: {
        type: String,
    },
    items: [{
        productId: { type: String, required: true },
        productName: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        modifiers: [{
            groupId: String,
            optionId: String,
            optionName: String,
            priceContribution: Number,
        }],
        specialInstructions: String,
    }],
    status: {
        type: String,
        enum: ['active', 'abandoned', 'converted'],
        default: 'active',
    },
    expiresAt: {
        type: Date,
        required: true,
        default: () => new Date(+new Date() + 24 * 60 * 60 * 1000), // 24 hours
    }
}, {
    timestamps: true,
});

// Auto-delete abandoned carts via TTL index
cartSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const CartSession: Model<ICartSession> = mongoose.models.CartSession || mongoose.model<ICartSession>('CartSession', cartSessionSchema);

export default CartSession;
