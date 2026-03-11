import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * SongRequest Model — Feature 16: Live Song Requests & Band Tipping
 *
 * Lifecycle:
 *  QUEUED    → user submitted, no tip or tip in escrow
 *  PLAYING   → band confirmed, tip transferred to restaurant ledger
 *  REJECTED  → band rejected, tip returned to wallet
 *  EXPIRED   → restaurant closed before played, cron unlocks escrow
 */

export type SongRequestStatus = 'QUEUED' | 'PLAYING' | 'REJECTED' | 'EXPIRED';

export interface ISongRequest extends Document {
    restaurantId: string;
    userId: string;
    userPhone?: string;
    userNickname?: string;
    /** Song being requested */
    songTitle: string;
    artist?: string;
    /** LAK amount. 0 means no tip. */
    tipAmount: number;
    /** Escrow status — funds deducted from wallet but not yet confirmed for restaurant */
    tipInEscrow: boolean;
    status: SongRequestStatus;
    /** ISO string when band accepted/rejected */
    resolvedAt?: Date;
    /** Message from the band on rejection */
    rejectReason?: string;
    /** Message from sender to the band */
    senderNote?: string;
    createdAt: Date;
    updatedAt: Date;
}

const SongRequestSchema = new Schema<ISongRequest>(
    {
        restaurantId: {
            type: String,
            required: [true, 'restaurantId is required'],
            index: true,
        },
        userId: {
            type: String,
            required: [true, 'userId is required'],
            index: true,
        },
        userPhone: { type: String, trim: true },
        userNickname: { type: String, trim: true, maxlength: 50 },
        songTitle: {
            type: String,
            required: [true, 'songTitle is required'],
            trim: true,
            maxlength: 200,
        },
        artist: { type: String, trim: true, maxlength: 200 },
        tipAmount: {
            type: Number,
            default: 0,
            min: [0, 'tipAmount cannot be negative'],
        },
        tipInEscrow: { type: Boolean, default: false },
        status: {
            type: String,
            enum: ['QUEUED', 'PLAYING', 'REJECTED', 'EXPIRED'],
            default: 'QUEUED',
            index: true,
        },
        resolvedAt: { type: Date },
        rejectReason: { type: String, trim: true, maxlength: 500 },
        senderNote: { type: String, trim: true, maxlength: 200 },
    },
    {
        timestamps: true,
        collection: 'song_requests',
    }
);

// Feed query: active queue for a restaurant
SongRequestSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
// Escrow cron: find all in-escrow for a restaurant that haven't resolved
SongRequestSchema.index({ restaurantId: 1, tipInEscrow: 1 });

const SongRequest: Model<ISongRequest> =
    mongoose.models.SongRequest ||
    mongoose.model<ISongRequest>('SongRequest', SongRequestSchema);

export default SongRequest;
