import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * PublicEvent — Feature 11: Live Events Discovery
 *
 * Events are created exclusively by AppZap Admins via the dashboard.
 * MongoDB TTL index auto-deletes documents 24 h after endDate to guarantee
 * a clean consumer feed with zero expired events.
 */

export interface IPublicEvent extends Document {
    title: string;
    description?: string;
    coverImage: string;
    /** Decimal degrees, e.g. 17.9757 */
    latitude: number;
    /** Decimal degrees, e.g. 102.6331 */
    longitude: number;
    /** Human-readable address shown under the event card */
    locationName: string;
    /** Optional deep-link to a POS merchant's restaurant page */
    restaurantId?: string;
    restaurantName?: string;
    startDate: Date;
    endDate: Date;
    /** While true, the event is invisible to all consumer-facing queries */
    isDraft: boolean;
    /** Optional array of tag strings: ["festival", "live music", "free entry"] */
    tags: string[];
    /** Tracks unique viewer count */
    viewCount: number;
    /** Admin who created the event */
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
}

const PublicEventSchema = new Schema<IPublicEvent>(
    {
        title: {
            type: String,
            required: [true, 'Event title is required'],
            trim: true,
            maxlength: 120,
        },
        description: {
            type: String,
            trim: true,
            maxlength: 2000,
        },
        coverImage: {
            type: String,
            required: [true, 'Cover image URL is required'],
            trim: true,
        },
        latitude: {
            type: Number,
            required: [true, 'Latitude is required'],
            min: -90,
            max: 90,
        },
        longitude: {
            type: Number,
            required: [true, 'Longitude is required'],
            min: -180,
            max: 180,
        },
        locationName: {
            type: String,
            required: [true, 'Location name is required'],
            trim: true,
            maxlength: 200,
        },
        restaurantId: {
            type: String,
            trim: true,
        },
        restaurantName: {
            type: String,
            trim: true,
        },
        startDate: {
            type: Date,
            required: [true, 'Start date is required'],
        },
        endDate: {
            type: Date,
            required: [true, 'End date is required'],
        },
        isDraft: {
            type: Boolean,
            default: true,       // require explicit publish action
            index: true,
        },
        tags: [{ type: String, trim: true, lowercase: true }],
        viewCount: { type: Number, default: 0, min: 0 },
        createdBy: { type: String, trim: true },
    },
    {
        timestamps: true,
        collection: 'public_events',
    }
);

// ── Indexes ──────────────────────────────────────────────────────────────────

// Feed query: published, future/ongoing, sorted by start date
PublicEventSchema.index({ isDraft: 1, startDate: 1 });
// Ensure expired events are culled 24 h after endDate by MongoDB TTL mechanism
PublicEventSchema.index({ endDate: 1 }, { expireAfterSeconds: 86400 });

// ── Model ─────────────────────────────────────────────────────────────────────

const PublicEvent: Model<IPublicEvent> =
    mongoose.models.PublicEvent ||
    mongoose.model<IPublicEvent>('PublicEvent', PublicEventSchema);

export default PublicEvent;
