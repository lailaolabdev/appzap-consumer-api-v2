import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Ad Analytics - Time-series data for ad performance tracking
 * Aggregated daily for sponsor ROI reports
 */

/**
 * Ad Analytics Interface
 */
export interface IAdAnalytics extends Document {
  // References
  advertiserId: mongoose.Types.ObjectId;
  adId?: mongoose.Types.ObjectId;
  
  // Dimensions
  placement: string;
  date: Date;                      // Date only (no time)
  
  // Metrics - Engagement
  impressions: number;
  uniqueImpressions: number;       // Unique users
  clicks: number;
  uniqueClicks: number;
  ctr: number;                     // Click-through rate %
  
  // Metrics - Conversions
  conversions: number;             // Orders placed after clicking
  conversionValue: number;         // Total order value in USD
  conversionRate: number;          // % of clicks that converted
  
  // Metrics - Cost
  cost: number;                    // Amount charged to advertiser
  costPerClick: number;
  costPerConversion: number;
  roi: number;                     // Return on investment %
  
  // Metrics - Engagement Quality
  avgViewDuration?: number;        // Seconds
  bounceRate?: number;             // % who left immediately
  
  // Breakdown by hour (for time analysis)
  hourlyBreakdown?: Map<string, {
    impressions: number;
    clicks: number;
  }>;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Ad Analytics Schema
 */
const AdAnalyticsSchema = new Schema<IAdAnalytics>(
  {
    advertiserId: {
      type: Schema.Types.ObjectId,
      ref: 'Advertiser',
      required: true,
      index: true,
    },
    adId: {
      type: Schema.Types.ObjectId,
      ref: 'Advertisement',
      index: true,
    },
    
    placement: {
      type: String,
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    
    // Engagement Metrics
    impressions: { type: Number, default: 0, min: 0 },
    uniqueImpressions: { type: Number, default: 0, min: 0 },
    clicks: { type: Number, default: 0, min: 0 },
    uniqueClicks: { type: Number, default: 0, min: 0 },
    ctr: { type: Number, default: 0, min: 0 },
    
    // Conversion Metrics
    conversions: { type: Number, default: 0, min: 0 },
    conversionValue: { type: Number, default: 0, min: 0 },
    conversionRate: { type: Number, default: 0, min: 0 },
    
    // Cost Metrics
    cost: { type: Number, default: 0, min: 0 },
    costPerClick: { type: Number, default: 0, min: 0 },
    costPerConversion: { type: Number, default: 0, min: 0 },
    roi: { type: Number, default: 0 },
    
    // Engagement Quality
    avgViewDuration: { type: Number, min: 0 },
    bounceRate: { type: Number, min: 0, max: 100 },
    
    // Hourly breakdown
    hourlyBreakdown: {
      type: Map,
      of: {
        impressions: { type: Number, default: 0 },
        clicks: { type: Number, default: 0 },
      },
    },
  },
  {
    timestamps: true,
    collection: 'ad_analytics',
  }
);

// Compound indexes for efficient queries
AdAnalyticsSchema.index({ advertiserId: 1, date: 1 });
AdAnalyticsSchema.index({ advertiserId: 1, placement: 1, date: 1 });
AdAnalyticsSchema.index({ adId: 1, date: 1 });
AdAnalyticsSchema.index({ date: 1, placement: 1 });

// Unique constraint - one record per ad per placement per day
AdAnalyticsSchema.index(
  { advertiserId: 1, adId: 1, placement: 1, date: 1 },
  { unique: true }
);

// Static methods for aggregation
AdAnalyticsSchema.statics.getSponsorSummary = async function(
  advertiserId: mongoose.Types.ObjectId,
  startDate: Date,
  endDate: Date
) {
  const result = await this.aggregate([
    {
      $match: {
        advertiserId,
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: null,
        totalImpressions: { $sum: '$impressions' },
        totalUniqueImpressions: { $sum: '$uniqueImpressions' },
        totalClicks: { $sum: '$clicks' },
        totalConversions: { $sum: '$conversions' },
        totalConversionValue: { $sum: '$conversionValue' },
        totalCost: { $sum: '$cost' },
      },
    },
    {
      $project: {
        _id: 0,
        impressions: '$totalImpressions',
        uniqueUsers: '$totalUniqueImpressions',
        clicks: '$totalClicks',
        conversions: '$totalConversions',
        conversionValue: '$totalConversionValue',
        cost: '$totalCost',
        ctr: {
          $cond: [
            { $gt: ['$totalImpressions', 0] },
            { $multiply: [{ $divide: ['$totalClicks', '$totalImpressions'] }, 100] },
            0,
          ],
        },
        conversionRate: {
          $cond: [
            { $gt: ['$totalClicks', 0] },
            { $multiply: [{ $divide: ['$totalConversions', '$totalClicks'] }, 100] },
            0,
          ],
        },
        roi: {
          $cond: [
            { $gt: ['$totalCost', 0] },
            { $multiply: [{ $divide: ['$totalConversionValue', '$totalCost'] }, 100] },
            0,
          ],
        },
        costPerClick: {
          $cond: [
            { $gt: ['$totalClicks', 0] },
            { $divide: ['$totalCost', '$totalClicks'] },
            0,
          ],
        },
        costPerConversion: {
          $cond: [
            { $gt: ['$totalConversions', 0] },
            { $divide: ['$totalCost', '$totalConversions'] },
            0,
          ],
        },
      },
    },
  ]);
  
  return result[0] || {
    impressions: 0,
    uniqueUsers: 0,
    clicks: 0,
    conversions: 0,
    conversionValue: 0,
    cost: 0,
    ctr: 0,
    conversionRate: 0,
    roi: 0,
    costPerClick: 0,
    costPerConversion: 0,
  };
};

AdAnalyticsSchema.statics.getByPlacement = async function(
  advertiserId: mongoose.Types.ObjectId,
  startDate: Date,
  endDate: Date
) {
  return this.aggregate([
    {
      $match: {
        advertiserId,
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: '$placement',
        impressions: { $sum: '$impressions' },
        clicks: { $sum: '$clicks' },
        conversions: { $sum: '$conversions' },
        conversionValue: { $sum: '$conversionValue' },
        cost: { $sum: '$cost' },
      },
    },
    {
      $project: {
        placement: '$_id',
        _id: 0,
        impressions: 1,
        clicks: 1,
        conversions: 1,
        conversionValue: 1,
        cost: 1,
        ctr: {
          $cond: [
            { $gt: ['$impressions', 0] },
            { $round: [{ $multiply: [{ $divide: ['$clicks', '$impressions'] }, 100] }, 2] },
            0,
          ],
        },
      },
    },
    { $sort: { impressions: -1 } },
  ]);
};

AdAnalyticsSchema.statics.getDailyTrend = async function(
  advertiserId: mongoose.Types.ObjectId,
  startDate: Date,
  endDate: Date
) {
  return this.aggregate([
    {
      $match: {
        advertiserId,
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: '$date',
        impressions: { $sum: '$impressions' },
        clicks: { $sum: '$clicks' },
        conversions: { $sum: '$conversions' },
        cost: { $sum: '$cost' },
      },
    },
    {
      $project: {
        date: '$_id',
        _id: 0,
        impressions: 1,
        clicks: 1,
        conversions: 1,
        cost: 1,
      },
    },
    { $sort: { date: 1 } },
  ]);
};

// Transform output
AdAnalyticsSchema.methods.toJSON = function() {
  const analytics = this.toObject();
  delete analytics.__v;
  return analytics;
};

// Model
const AdAnalytics: Model<IAdAnalytics> = mongoose.model<IAdAnalytics>('AdAnalytics', AdAnalyticsSchema);

export default AdAnalytics;
