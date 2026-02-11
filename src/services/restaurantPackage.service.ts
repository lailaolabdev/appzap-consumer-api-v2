/**
 * Restaurant Package Service
 * 
 * Handles restaurant monetization features:
 * - Premium listings
 * - New restaurant spotlight
 * - Featured restaurants
 * - Package management
 * - Revenue tracking
 */

import RestaurantPackage, { 
  IRestaurantPackage, 
  PackageType, 
  PACKAGE_PRICING 
} from '../models/RestaurantPackage';
import { unifiedRestaurantService, UnifiedRestaurant } from './unifiedRestaurant.service';
import logger from '../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface FeaturedRestaurant extends UnifiedRestaurant {
  package?: {
    type: PackageType;
    badge?: string;
    daysRemaining: number;
    priorityRank: number;
  };
  isSponsored: boolean;
}

export interface RestaurantWithAvailability extends UnifiedRestaurant {
  availability?: {
    hasAvailableTables: boolean;
    nextAvailableSlot?: string;
    availableTableCount: number;
  };
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

class RestaurantPackageService {

  // ==========================================================================
  // FEATURED RESTAURANTS
  // ==========================================================================

  /**
   * Get featured/premium restaurants (for top of search)
   */
  async getFeaturedRestaurants(params: {
    limit?: number;
    province?: string;
    lat?: number;
    lng?: number;
  } = {}): Promise<FeaturedRestaurant[]> {
    try {
      const { limit = 10 } = params;

      // Get premium packages
      const premiumPackages = await RestaurantPackage.getPremiumRestaurants(limit);
      
      if (premiumPackages.length === 0) {
        // If no premium packages, return top restaurants
        const { data } = await unifiedRestaurantService.getAllRestaurants({ limit });
        return data.map(r => ({
          ...r,
          isSponsored: false,
        }));
      }

      // Fetch restaurant details for each package
      const featuredRestaurants: FeaturedRestaurant[] = [];

      for (const pkg of premiumPackages) {
        try {
          const restaurant = await unifiedRestaurantService.getRestaurantById(
            pkg.restaurantId,
            pkg.posVersion
          );

          if (restaurant) {
            featuredRestaurants.push({
              ...restaurant,
              package: {
                type: pkg.packageType,
                badge: this.getBadgeForPackage(pkg.packageType),
                daysRemaining: pkg.daysRemaining(),
                priorityRank: pkg.features.priorityRank,
              },
              isSponsored: true,
            });

            // Track impression
            await this.trackImpression(pkg._id.toString());
          }
        } catch (error) {
          logger.warn(`Failed to fetch restaurant ${pkg.restaurantId}:`, error);
        }
      }

      return featuredRestaurants;
    } catch (error) {
      logger.error('[RestaurantPackage] Failed to get featured restaurants:', error);
      throw error;
    }
  }

  /**
   * Get new restaurants (spotlight section)
   */
  async getNewRestaurants(params: {
    limit?: number;
    daysBack?: number;
  } = {}): Promise<FeaturedRestaurant[]> {
    try {
      const { limit = 10, daysBack = 30 } = params;

      // Get restaurants with new_spotlight package
      const spotlightPackages = await RestaurantPackage.getNewSpotlightRestaurants(limit);

      const newRestaurants: FeaturedRestaurant[] = [];

      // First, add spotlight packages
      for (const pkg of spotlightPackages) {
        try {
          const restaurant = await unifiedRestaurantService.getRestaurantById(
            pkg.restaurantId,
            pkg.posVersion
          );

          if (restaurant) {
            newRestaurants.push({
              ...restaurant,
              package: {
                type: pkg.packageType,
                badge: 'NEW',
                daysRemaining: pkg.daysRemaining(),
                priorityRank: pkg.features.priorityRank,
              },
              isSponsored: true,
            });

            await this.trackImpression(pkg._id.toString());
          }
        } catch (error) {
          logger.warn(`Failed to fetch restaurant ${pkg.restaurantId}:`, error);
        }
      }

      // If we need more, get recently created restaurants
      if (newRestaurants.length < limit) {
        const remaining = limit - newRestaurants.length;
        const { data } = await unifiedRestaurantService.getAllRestaurants({ 
          limit: remaining * 2  // Fetch more to filter
        });

        // Filter to only recently created (within daysBack days)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);

        const recentRestaurants = data
          .filter(r => {
            const createdAt = r.createdAt ? new Date(r.createdAt) : new Date(0);
            return createdAt >= cutoffDate;
          })
          .filter(r => !newRestaurants.some(nr => nr._id === r._id))
          .slice(0, remaining);

        for (const r of recentRestaurants) {
          newRestaurants.push({
            ...r,
            isSponsored: false,
          });
        }
      }

      return newRestaurants;
    } catch (error) {
      logger.error('[RestaurantPackage] Failed to get new restaurants:', error);
      throw error;
    }
  }

  /**
   * Get restaurants with table availability
   */
  async getRestaurantsWithAvailability(params: {
    date?: string;
    time?: string;
    partySize?: number;
    limit?: number;
  } = {}): Promise<RestaurantWithAvailability[]> {
    try {
      const { limit = 20 } = params;

      // Get all reservable restaurants
      const { data } = await unifiedRestaurantService.getAllRestaurants({
        limit,
        isReservable: true,
      });

      // For now, return with mock availability
      // In production, this would check POS for real-time table data
      return data.map(restaurant => ({
        ...restaurant,
        availability: {
          hasAvailableTables: Math.random() > 0.3,  // 70% have tables
          nextAvailableSlot: this.getNextAvailableSlot(),
          availableTableCount: Math.floor(Math.random() * 5) + 1,
        },
      }));
    } catch (error) {
      logger.error('[RestaurantPackage] Failed to get restaurants with availability:', error);
      throw error;
    }
  }

  // ==========================================================================
  // PACKAGE MANAGEMENT
  // ==========================================================================

  /**
   * Get available packages
   */
  getAvailablePackages() {
    return PACKAGE_PRICING.filter(p => p.isActive);
  }

  /**
   * Get package for a restaurant
   */
  async getRestaurantPackage(restaurantId: string): Promise<IRestaurantPackage | null> {
    return RestaurantPackage.getActivePackage(restaurantId);
  }

  /**
   * Purchase a package
   */
  async purchasePackage(data: {
    restaurantId: string;
    posVersion: 'v1' | 'v2';
    packageType: PackageType;
    paymentMethod?: string;
    paymentReference?: string;
  }): Promise<IRestaurantPackage> {
    try {
      // Check if restaurant already has an active package of same type
      const existing = await RestaurantPackage.findOne({
        restaurantId: data.restaurantId,
        packageType: data.packageType,
        status: 'active',
        endDate: { $gte: new Date() },
      });

      if (existing) {
        throw new Error('Restaurant already has an active package of this type');
      }

      const pkg = await RestaurantPackage.createPackage({
        restaurantId: data.restaurantId,
        posVersion: data.posVersion,
        packageType: data.packageType,
        paymentMethod: data.paymentMethod,
        paymentReference: data.paymentReference,
      });

      logger.info(`[RestaurantPackage] Package created: ${pkg._id} for ${data.restaurantId}`);
      return pkg;
    } catch (error) {
      logger.error('[RestaurantPackage] Failed to purchase package:', error);
      throw error;
    }
  }

  /**
   * Confirm payment for a package
   */
  async confirmPayment(
    packageId: string,
    paymentReference: string
  ): Promise<IRestaurantPackage> {
    const pkg = await RestaurantPackage.findByIdAndUpdate(
      packageId,
      {
        $set: {
          status: 'active',
          isPaid: true,
          paidAt: new Date(),
          paymentReference,
        },
      },
      { new: true }
    );

    if (!pkg) {
      throw new Error('Package not found');
    }

    logger.info(`[RestaurantPackage] Payment confirmed for package: ${packageId}`);
    return pkg;
  }

  // ==========================================================================
  // ANALYTICS
  // ==========================================================================

  /**
   * Track impression
   */
  async trackImpression(packageId: string): Promise<void> {
    await RestaurantPackage.findByIdAndUpdate(packageId, {
      $inc: { impressions: 1 },
    });
  }

  /**
   * Track click
   */
  async trackClick(packageId: string): Promise<void> {
    await RestaurantPackage.findByIdAndUpdate(packageId, {
      $inc: { clicks: 1 },
    });
  }

  /**
   * Track conversion (booking/order)
   */
  async trackConversion(restaurantId: string): Promise<void> {
    const pkg = await RestaurantPackage.getActivePackage(restaurantId);
    if (pkg) {
      await RestaurantPackage.findByIdAndUpdate(pkg._id, {
        $inc: { conversions: 1 },
      });
    }
  }

  /**
   * Get package analytics
   */
  async getPackageAnalytics(packageId: string) {
    const pkg = await RestaurantPackage.findById(packageId);
    if (!pkg) {
      throw new Error('Package not found');
    }

    const ctr = pkg.impressions > 0 
      ? (pkg.clicks / pkg.impressions * 100).toFixed(2) 
      : '0';
    
    const conversionRate = pkg.clicks > 0 
      ? (pkg.conversions / pkg.clicks * 100).toFixed(2) 
      : '0';

    return {
      packageId: pkg._id,
      restaurantId: pkg.restaurantId,
      packageType: pkg.packageType,
      status: pkg.status,
      daysRemaining: pkg.daysRemaining(),
      metrics: {
        impressions: pkg.impressions,
        clicks: pkg.clicks,
        conversions: pkg.conversions,
        clickThroughRate: `${ctr}%`,
        conversionRate: `${conversionRate}%`,
      },
    };
  }

  /**
   * Get revenue summary for AppZap admin
   */
  async getRevenueSummary(params: {
    startDate?: Date;
    endDate?: Date;
  } = {}) {
    const { 
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date() 
    } = params;

    const packages = await RestaurantPackage.find({
      isPaid: true,
      paidAt: { $gte: startDate, $lte: endDate },
    });

    const totalRevenue = packages.reduce((sum, pkg) => sum + pkg.price, 0);
    
    const byType: Record<string, { count: number; revenue: number }> = {};
    for (const pkg of packages) {
      if (!byType[pkg.packageType]) {
        byType[pkg.packageType] = { count: 0, revenue: 0 };
      }
      byType[pkg.packageType].count++;
      byType[pkg.packageType].revenue += pkg.price;
    }

    return {
      period: { startDate, endDate },
      totalPackagesSold: packages.length,
      totalRevenue,
      byPackageType: byType,
    };
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private getBadgeForPackage(packageType: PackageType): string | undefined {
    switch (packageType) {
      case 'grand_opening': return 'GRAND OPENING';
      case 'premium_plus': return 'PREMIUM+';
      case 'premium': return 'PREMIUM';
      case 'new_spotlight': return 'NEW';
      default: return undefined;
    }
  }

  private getNextAvailableSlot(): string {
    const now = new Date();
    const hours = now.getHours();
    
    // Find next available slot (on the hour)
    let nextHour = hours + 1;
    if (nextHour >= 22) {
      // Tomorrow lunch time
      return '12:00';
    }
    if (nextHour < 11) {
      return '11:00';
    }
    return `${nextHour}:00`;
  }
}

// Export singleton
export const restaurantPackageService = new RestaurantPackageService();
export default restaurantPackageService;
