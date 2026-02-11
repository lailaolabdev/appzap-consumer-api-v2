/**
 * Advertisement Service
 * Handles ad serving and tracking
 */

import Advertisement, { IAdvertisement, AdType, AdPlacement, AdStatus } from '../models/Advertisement';
import logger from '../utils/logger';
import mongoose from 'mongoose';

interface GetAdsParams {
  placement: AdPlacement;
  province?: string;
  language?: string;
  nationality?: string;
  userType?: 'new' | 'returning' | 'premium' | 'inactive';
  device?: 'ios' | 'android';
  limit?: number;
}

interface AdImpression {
  adId: string;
  userId?: string;
  sessionId: string;
  timestamp: Date;
  placement: AdPlacement;
}

class AdvertisementService {
  /**
   * Get ads for a specific placement
   */
  async getAdsForPlacement(params: GetAdsParams): Promise<IAdvertisement[]> {
    try {
      const {
        placement,
        province,
        language,
        nationality,
        userType,
        device,
        limit = 5,
      } = params;

      const now = new Date();

      // Build filter
      const filter: Record<string, unknown> = {
        status: 'active',
        placement,
        'schedule.startDate': { $lte: now },
        'schedule.endDate': { $gte: now },
      };

      // Don't exceed budget
      filter.$or = [
        { 'budget.total': { $exists: false } },
        { $expr: { $lt: ['$budget.spent', '$budget.total'] } },
      ];

      // Build targeting filter
      const targetingConditions: Record<string, unknown>[] = [];

      if (province) {
        targetingConditions.push({
          $or: [
            { 'targeting.provinces': { $size: 0 } },
            { 'targeting.provinces': { $exists: false } },
            { 'targeting.provinces': province },
          ],
        });
      }

      if (language) {
        targetingConditions.push({
          $or: [
            { 'targeting.languages': { $size: 0 } },
            { 'targeting.languages': { $exists: false } },
            { 'targeting.languages': language },
          ],
        });
      }

      if (nationality) {
        targetingConditions.push({
          $or: [
            { 'targeting.nationalities': { $size: 0 } },
            { 'targeting.nationalities': { $exists: false } },
            { 'targeting.nationalities': nationality },
          ],
        });
      }

      if (userType) {
        targetingConditions.push({
          $or: [
            { 'targeting.userTypes': { $size: 0 } },
            { 'targeting.userTypes': { $exists: false } },
            { 'targeting.userTypes': userType },
          ],
        });
      }

      if (device) {
        targetingConditions.push({
          $or: [
            { 'targeting.devices': { $size: 0 } },
            { 'targeting.devices': { $exists: false } },
            { 'targeting.devices': device },
          ],
        });
      }

      if (targetingConditions.length > 0) {
        filter.$and = targetingConditions;
      }

      // Get ads sorted by priority and weight
      const ads = await Advertisement.find(filter)
        .sort({ priority: -1, weight: -1 })
        .limit(limit * 2) // Get more for random selection
        .lean();

      // Weighted random selection
      if (ads.length > limit) {
        return this.weightedRandomSelection(ads as unknown as IAdvertisement[], limit);
      }

      return ads as unknown as IAdvertisement[];
    } catch (error) {
      logger.error('[AdvertisementService] Error getting ads:', error);
      throw error;
    }
  }

  /**
   * Weighted random selection of ads
   */
  private weightedRandomSelection(ads: IAdvertisement[], limit: number): IAdvertisement[] {
    const selected: IAdvertisement[] = [];
    const remaining = [...ads];

    while (selected.length < limit && remaining.length > 0) {
      const totalWeight = remaining.reduce((sum, ad) => sum + (ad.weight || 50), 0);
      let random = Math.random() * totalWeight;

      for (let i = 0; i < remaining.length; i++) {
        random -= remaining[i].weight || 50;
        if (random <= 0) {
          selected.push(remaining[i]);
          remaining.splice(i, 1);
          break;
        }
      }
    }

    return selected;
  }

  /**
   * Track ad impression
   */
  async trackImpression(adId: string, sessionId?: string, userId?: string): Promise<void> {
    try {
      await Advertisement.updateOne(
        { _id: adId },
        {
          $inc: { 'stats.impressions': 1 },
        }
      );

      // Update CTR
      const ad = await Advertisement.findById(adId);
      if (ad && ad.stats.impressions > 0) {
        ad.stats.ctr = (ad.stats.clicks / ad.stats.impressions) * 100;
        
        // Update spent for CPM
        if (ad.pricing.type === 'cpm' && ad.budget) {
          ad.budget.spent += ad.pricing.amount / 1000;
        }
        
        await ad.save();
      }

      // TODO: Log impression for analytics
      logger.debug(`[AdvertisementService] Impression tracked: ${adId}`);
    } catch (error) {
      logger.error('[AdvertisementService] Error tracking impression:', error);
    }
  }

  /**
   * Track ad click
   */
  async trackClick(adId: string, sessionId?: string, userId?: string): Promise<string | null> {
    try {
      const ad = await Advertisement.findById(adId);
      
      if (!ad) {
        logger.warn(`[AdvertisementService] Ad not found: ${adId}`);
        return null;
      }

      ad.stats.clicks += 1;
      
      // Update CTR
      if (ad.stats.impressions > 0) {
        ad.stats.ctr = (ad.stats.clicks / ad.stats.impressions) * 100;
      }

      // Update spent for CPC
      if (ad.pricing.type === 'cpc' && ad.budget) {
        ad.budget.spent += ad.pricing.amount;
      }

      await ad.save();

      // TODO: Log click for analytics
      logger.debug(`[AdvertisementService] Click tracked: ${adId}`);

      return ad.content.ctaUrl || null;
    } catch (error) {
      logger.error('[AdvertisementService] Error tracking click:', error);
      throw error;
    }
  }

  /**
   * Track ad conversion
   */
  async trackConversion(adId: string, revenue = 0): Promise<void> {
    try {
      const ad = await Advertisement.findById(adId);
      
      if (!ad) {
        logger.warn(`[AdvertisementService] Ad not found: ${adId}`);
        return;
      }

      ad.stats.conversions += 1;
      ad.stats.revenue += revenue;

      // Update conversion rate
      if (ad.stats.clicks > 0) {
        ad.stats.conversionRate = (ad.stats.conversions / ad.stats.clicks) * 100;
      }

      // Update spent for CPA
      if (ad.pricing.type === 'cpa' && ad.budget) {
        ad.budget.spent += ad.pricing.amount;
      }

      await ad.save();

      logger.debug(`[AdvertisementService] Conversion tracked: ${adId}, revenue: ${revenue}`);
    } catch (error) {
      logger.error('[AdvertisementService] Error tracking conversion:', error);
    }
  }

  /**
   * Get ad by ID
   */
  async getAdById(id: string): Promise<IAdvertisement | null> {
    try {
      return await Advertisement.findById(id);
    } catch (error) {
      logger.error('[AdvertisementService] Error getting ad:', error);
      throw error;
    }
  }

  /**
   * Get ads by advertiser
   */
  async getAdsByAdvertiser(userId: string): Promise<IAdvertisement[]> {
    try {
      return await Advertisement.find({ 'advertiser.userId': userId })
        .sort({ createdAt: -1 });
    } catch (error) {
      logger.error('[AdvertisementService] Error getting ads by advertiser:', error);
      throw error;
    }
  }

  // ============================================
  // ADMIN METHODS
  // ============================================

  /**
   * Get all ads (admin)
   */
  async getAllAds(params: {
    status?: AdStatus;
    type?: AdType;
    placement?: AdPlacement;
    skip?: number;
    limit?: number;
  } = {}): Promise<{ ads: IAdvertisement[]; total: number }> {
    try {
      const { status, type, placement, skip = 0, limit = 20 } = params;

      const filter: Record<string, unknown> = {};
      if (status) filter.status = status;
      if (type) filter.type = type;
      if (placement) filter.placement = placement;

      const [ads, total] = await Promise.all([
        Advertisement.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Advertisement.countDocuments(filter),
      ]);

      return { ads, total };
    } catch (error) {
      logger.error('[AdvertisementService] Error getting all ads:', error);
      throw error;
    }
  }

  /**
   * Create ad (admin)
   */
  async createAd(data: Partial<IAdvertisement>): Promise<IAdvertisement> {
    try {
      const ad = new Advertisement({
        ...data,
        status: 'pending_approval',
        stats: {
          impressions: 0,
          clicks: 0,
          conversions: 0,
          ctr: 0,
          conversionRate: 0,
          revenue: 0,
        },
      });

      await ad.save();
      logger.info(`[AdvertisementService] Created ad: ${ad.name}`);

      return ad;
    } catch (error) {
      logger.error('[AdvertisementService] Error creating ad:', error);
      throw error;
    }
  }

  /**
   * Update ad (admin)
   */
  async updateAd(id: string, data: Partial<IAdvertisement>): Promise<IAdvertisement | null> {
    try {
      const ad = await Advertisement.findByIdAndUpdate(
        id,
        { $set: data },
        { new: true, runValidators: true }
      );

      if (ad) {
        logger.info(`[AdvertisementService] Updated ad: ${ad.name}`);
      }

      return ad;
    } catch (error) {
      logger.error('[AdvertisementService] Error updating ad:', error);
      throw error;
    }
  }

  /**
   * Approve ad (admin)
   */
  async approveAd(id: string, approvedBy: string): Promise<IAdvertisement | null> {
    try {
      const ad = await Advertisement.findByIdAndUpdate(
        id,
        {
          $set: {
            status: 'approved',
            approvedBy: new mongoose.Types.ObjectId(approvedBy),
            approvedAt: new Date(),
          },
        },
        { new: true }
      );

      if (ad) {
        logger.info(`[AdvertisementService] Approved ad: ${ad.name}`);
      }

      return ad;
    } catch (error) {
      logger.error('[AdvertisementService] Error approving ad:', error);
      throw error;
    }
  }

  /**
   * Reject ad (admin)
   */
  async rejectAd(id: string, reason: string): Promise<IAdvertisement | null> {
    try {
      const ad = await Advertisement.findByIdAndUpdate(
        id,
        {
          $set: {
            status: 'rejected',
            rejectionReason: reason,
          },
        },
        { new: true }
      );

      if (ad) {
        logger.info(`[AdvertisementService] Rejected ad: ${ad.name}`);
      }

      return ad;
    } catch (error) {
      logger.error('[AdvertisementService] Error rejecting ad:', error);
      throw error;
    }
  }

  /**
   * Change ad status (admin)
   */
  async updateAdStatus(id: string, status: AdStatus): Promise<boolean> {
    try {
      const result = await Advertisement.updateOne(
        { _id: id },
        { $set: { status } }
      );

      return result.modifiedCount > 0;
    } catch (error) {
      logger.error('[AdvertisementService] Error updating ad status:', error);
      throw error;
    }
  }

  /**
   * Get ad analytics (admin)
   */
  async getAdAnalytics(adId: string): Promise<{
    ad: IAdvertisement;
    roi: number;
    costPerConversion: number;
  } | null> {
    try {
      const ad = await Advertisement.findById(adId);
      
      if (!ad) return null;

      // Calculate ROI
      const spent = ad.budget?.spent || 0;
      const roi = spent > 0 ? ((ad.stats.revenue - spent) / spent) * 100 : 0;

      // Calculate cost per conversion
      const costPerConversion = ad.stats.conversions > 0 
        ? spent / ad.stats.conversions 
        : 0;

      return {
        ad,
        roi,
        costPerConversion,
      };
    } catch (error) {
      logger.error('[AdvertisementService] Error getting ad analytics:', error);
      throw error;
    }
  }

  /**
   * Get revenue summary (admin)
   */
  async getRevenueSummary(params: {
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<{
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    totalRevenue: number;
    averageCtr: number;
  }> {
    try {
      const { startDate, endDate } = params;

      const filter: Record<string, unknown> = {};
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) (filter.createdAt as Record<string, Date>).$gte = startDate;
        if (endDate) (filter.createdAt as Record<string, Date>).$lte = endDate;
      }

      const result = await Advertisement.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalImpressions: { $sum: '$stats.impressions' },
            totalClicks: { $sum: '$stats.clicks' },
            totalConversions: { $sum: '$stats.conversions' },
            totalRevenue: { $sum: '$stats.revenue' },
          },
        },
      ]);

      const data = result[0] || {
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 0,
        totalRevenue: 0,
      };

      return {
        ...data,
        averageCtr: data.totalImpressions > 0 
          ? (data.totalClicks / data.totalImpressions) * 100 
          : 0,
      };
    } catch (error) {
      logger.error('[AdvertisementService] Error getting revenue summary:', error);
      throw error;
    }
  }
}

export const advertisementService = new AdvertisementService();
export default advertisementService;
