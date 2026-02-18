import mongoose from 'mongoose';
import Advertiser, { IAdvertiser, AdvertiserCategory, ContractStatus } from '../models/Advertiser';
import AdAnalytics from '../models/AdAnalytics';
import Advertisement, { IAdvertisement } from '../models/Advertisement';

/**
 * Advertiser Service
 * Manages sponsors and their contracts
 */
class AdvertiserService {
  /**
   * Create a new advertiser
   */
  async createAdvertiser(data: Partial<IAdvertiser>): Promise<IAdvertiser> {
    const advertiser = new Advertiser(data);
    return advertiser.save();
  }

  /**
   * Get all advertisers with optional filters
   */
  async getAdvertisers(filters: {
    status?: ContractStatus;
    category?: AdvertiserCategory;
    productScope?: string;
  } = {}): Promise<IAdvertiser[]> {
    const query: Record<string, unknown> = {};

    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.category) {
      query.category = filters.category;
    }
    if (filters.productScope) {
      query['contract.productScope'] = filters.productScope;
    }

    return Advertiser.find(query).sort({ createdAt: -1 });
  }

  /**
   * Get advertiser by ID
   */
  async getAdvertiserById(id: string): Promise<IAdvertiser | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    return Advertiser.findById(id);
  }

  /**
   * Update advertiser
   */
  async updateAdvertiser(id: string, data: Partial<IAdvertiser>): Promise<IAdvertiser | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    return Advertiser.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  /**
   * Update advertiser status
   */
  async updateStatus(id: string, status: ContractStatus): Promise<IAdvertiser | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    return Advertiser.findByIdAndUpdate(id, { status }, { new: true });
  }

  /**
   * Get comprehensive analytics for a sponsor
   */
  async getSponsorAnalytics(
    advertiserId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    sponsor: IAdvertiser | null;
    period: { start: Date; end: Date };
    summary: Record<string, unknown>;
    byPlacement: Record<string, unknown>[];
    dailyTrend: Record<string, unknown>[];
    adPerformance: Record<string, unknown>[];
  }> {
    const sponsor = await this.getAdvertiserById(advertiserId);
    if (!sponsor) {
      return {
        sponsor: null,
        period: { start: startDate, end: endDate },
        summary: {},
        byPlacement: [],
        dailyTrend: [],
        adPerformance: [],
      };
    }

    const objectId = new mongoose.Types.ObjectId(advertiserId);

    // Get summary metrics
    const summary = await (AdAnalytics as unknown as {
      getSponsorSummary: (id: mongoose.Types.ObjectId, start: Date, end: Date) => Promise<Record<string, unknown>>;
    }).getSponsorSummary(objectId, startDate, endDate);

    // Get breakdown by placement
    const byPlacement = await (AdAnalytics as unknown as {
      getByPlacement: (id: mongoose.Types.ObjectId, start: Date, end: Date) => Promise<Record<string, unknown>[]>;
    }).getByPlacement(objectId, startDate, endDate);

    // Get daily trend
    const dailyTrend = await (AdAnalytics as unknown as {
      getDailyTrend: (id: mongoose.Types.ObjectId, start: Date, end: Date) => Promise<Record<string, unknown>[]>;
    }).getDailyTrend(objectId, startDate, endDate);

    // Get individual ad performance
    const ads = await Advertisement.find({ sponsorId: objectId });
    const adPerformance = ads.map(ad => ({
      id: ad._id,
      name: ad.name,
      placement: ad.placement,
      type: ad.type,
      status: ad.status,
      impressions: ad.stats.impressions,
      clicks: ad.stats.clicks,
      ctr: ad.stats.ctr,
      conversions: ad.stats.conversions,
      revenue: ad.stats.revenue,
    }));

    return {
      sponsor,
      period: { start: startDate, end: endDate },
      summary: {
        ...summary,
        totalSpend: sponsor.contract.amountSpent,
        remainingBudget: sponsor.getRemainingBudget(),
        daysRemaining: sponsor.getDaysRemaining(),
      },
      byPlacement,
      dailyTrend,
      adPerformance,
    };
  }

  /**
   * Get ads by sponsor
   */
  async getAdsBySponsor(advertiserId: string): Promise<IAdvertisement[]> {
    if (!mongoose.Types.ObjectId.isValid(advertiserId)) {
      return [];
    }
    return Advertisement.find({ sponsorId: advertiserId }).sort({ priority: -1 });
  }

  /**
   * Check if a placement is exclusively held by a sponsor
   */
  async checkPlacementExclusivity(placement: string): Promise<{
    isExclusive: boolean;
    sponsor: IAdvertiser | null;
  }> {
    const sponsor = await Advertiser.findOne({
      status: 'active',
      'contract.exclusivePlacements': placement,
      'contract.startDate': { $lte: new Date() },
      'contract.endDate': { $gte: new Date() },
    });

    return {
      isExclusive: !!sponsor,
      sponsor,
    };
  }

  /**
   * Update advertiser stats (called when tracking impressions/clicks)
   */
  async updateStats(
    advertiserId: string,
    stats: {
      impressions?: number;
      clicks?: number;
      conversions?: number;
      revenue?: number;
    }
  ): Promise<void> {
    const update: Record<string, number> = {};

    if (stats.impressions) {
      update.totalImpressions = stats.impressions;
    }
    if (stats.clicks) {
      update.totalClicks = stats.clicks;
    }
    if (stats.conversions) {
      update.totalConversions = stats.conversions;
    }
    if (stats.revenue) {
      update.totalRevenue = stats.revenue;
    }

    if (Object.keys(update).length > 0) {
      await Advertiser.findByIdAndUpdate(advertiserId, {
        $inc: update,
      });
    }
  }

  /**
   * Check and update expired contracts
   */
  async checkExpiredContracts(): Promise<number> {
    const result = await Advertiser.updateMany(
      {
        status: 'active',
        'contract.endDate': { $lt: new Date() },
      },
      {
        status: 'expired',
      }
    );
    return result.modifiedCount;
  }
}

export default new AdvertiserService();
