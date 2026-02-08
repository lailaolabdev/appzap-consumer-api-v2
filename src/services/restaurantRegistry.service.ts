/**
 * Restaurant Registry Service
 * 
 * Manages the restaurant registry which maps restaurants to their POS systems.
 * Provides fast lookups and caching for routing decisions.
 */

import RestaurantRegistry, {
  IRestaurantRegistry,
  POSVersionType,
  IRestaurantFeatureFlags,
} from '../models/RestaurantRegistry';
import { posRouter } from '../adapters/pos.router';
import { UnifiedRestaurant, POSVersion } from '../types/unified.types';
import logger from '../utils/logger';
import { redisHelpers } from '../config/redis';

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_PREFIX = 'registry:';
const CACHE_TTL = 3600; // 1 hour
const SYNC_BATCH_SIZE = 100;

// ============================================================================
// TYPES
// ============================================================================

export interface RegistrySearchParams {
  search?: string;
  province?: string;
  posVersion?: POSVersionType;
  hasReservation?: boolean;
  isActive?: boolean;
  location?: {
    lat: number;
    lng: number;
    radiusKm?: number;
  };
  page?: number;
  limit?: number;
}

export interface RegistryStats {
  totalRestaurants: number;
  v1Restaurants: number;
  v2Restaurants: number;
  activeRestaurants: number;
  withReservation: number;
  lastSyncAt?: Date;
}

// ============================================================================
// SERVICE FUNCTIONS
// ============================================================================

/**
 * Get restaurant POS version by unified ID
 * Uses cache for fast lookups
 */
export const getRestaurantPOSVersion = async (
  unifiedId: string
): Promise<POSVersionType | null> => {
  try {
    // Check cache first
    const cacheKey = `${CACHE_PREFIX}version:${unifiedId}`;
    const cached = await redisHelpers.get(cacheKey);
    if (cached) {
      return cached as POSVersionType;
    }

    // Parse from ID if prefixed
    if (unifiedId.startsWith('v1_')) {
      await redisHelpers.setWithTTL(cacheKey, 'v1', CACHE_TTL);
      return 'v1';
    }
    if (unifiedId.startsWith('v2_')) {
      await redisHelpers.setWithTTL(cacheKey, 'v2', CACHE_TTL);
      return 'v2';
    }

    // Look up in registry
    const registry = await RestaurantRegistry.findByUnifiedId(unifiedId);
    if (registry) {
      await redisHelpers.setWithTTL(cacheKey, registry.posVersion, CACHE_TTL);
      return registry.posVersion;
    }

    return null;
  } catch (error) {
    logger.error('[Registry] Failed to get POS version', { unifiedId, error });
    return null;
  }
};

/**
 * Register or update a restaurant in the registry
 */
export const registerRestaurant = async (
  restaurant: UnifiedRestaurant
): Promise<IRestaurantRegistry> => {
  try {
    const features: IRestaurantFeatureFlags = {
      hasReservation: restaurant.features.reservation,
      hasTakeaway: restaurant.features.takeaway,
      hasDelivery: restaurant.features.delivery,
      hasLoyalty: restaurant.features.loyaltyPoints,
      hasQROrdering: restaurant.features.qrOrdering,
      hasLiveBill: restaurant.features.liveBill,
      hasSplitBill: restaurant.features.splitBill,
    };

    const registryData = {
      unifiedId: restaurant.id,
      posVersion: restaurant.posVersion as POSVersionType,
      posId: restaurant.originalId,
      name: restaurant.name,
      nameEn: restaurant.translations?.en?.name,
      image: restaurant.image,
      location: restaurant.address.coordinates
        ? {
            type: 'Point' as const,
            coordinates: [
              restaurant.address.coordinates.lng,
              restaurant.address.coordinates.lat,
            ] as [number, number],
          }
        : undefined,
      province: restaurant.address.province,
      district: restaurant.address.district,
      features,
      isActive: restaurant.isActive,
      isOpen: restaurant.isOpen,
    };

    const registry = await RestaurantRegistry.upsertFromPOS(registryData);

    // Invalidate cache
    const cacheKey = `${CACHE_PREFIX}version:${restaurant.id}`;
    await redisHelpers.del(cacheKey);

    logger.debug('[Registry] Restaurant registered', {
      unifiedId: restaurant.id,
      posVersion: restaurant.posVersion,
    });

    return registry;
  } catch (error) {
    logger.error('[Registry] Failed to register restaurant', {
      restaurantId: restaurant.id,
      error,
    });
    throw error;
  }
};

/**
 * Bulk register restaurants
 */
export const bulkRegisterRestaurants = async (
  restaurants: UnifiedRestaurant[]
): Promise<number> => {
  let registered = 0;

  for (const restaurant of restaurants) {
    try {
      await registerRestaurant(restaurant);
      registered++;
    } catch (error) {
      logger.error('[Registry] Failed to register restaurant in bulk', {
        restaurantId: restaurant.id,
        error,
      });
    }
  }

  logger.info('[Registry] Bulk registration complete', {
    total: restaurants.length,
    registered,
    failed: restaurants.length - registered,
  });

  return registered;
};

/**
 * Search restaurants in registry
 */
export const searchRegistry = async (
  params: RegistrySearchParams
): Promise<{
  data: IRestaurantRegistry[];
  total: number;
  page: number;
  limit: number;
}> => {
  try {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    // Build query
    const query: any = {};

    if (params.isActive !== undefined) {
      query.isActive = params.isActive;
    } else {
      query.isActive = true; // Default to active only
    }

    if (params.posVersion) {
      query.posVersion = params.posVersion;
    }

    if (params.hasReservation) {
      query['features.hasReservation'] = true;
    }

    if (params.province) {
      query.province = params.province;
    }

    if (params.search) {
      query.$text = { $search: params.search };
    }

    // Location-based search
    if (params.location) {
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [params.location.lng, params.location.lat],
          },
          $maxDistance: (params.location.radiusKm || 10) * 1000,
        },
      };
    }

    const [data, total] = await Promise.all([
      RestaurantRegistry.find(query).skip(skip).limit(limit).lean(),
      RestaurantRegistry.countDocuments(query),
    ]);

    return {
      data: data as IRestaurantRegistry[],
      total,
      page,
      limit,
    };
  } catch (error) {
    logger.error('[Registry] Failed to search registry', { params, error });
    throw error;
  }
};

/**
 * Get registry statistics
 */
export const getRegistryStats = async (): Promise<RegistryStats> => {
  try {
    const [total, v1, v2, active, withReservation, lastSync] = await Promise.all([
      RestaurantRegistry.countDocuments({}),
      RestaurantRegistry.countDocuments({ posVersion: 'v1' }),
      RestaurantRegistry.countDocuments({ posVersion: 'v2' }),
      RestaurantRegistry.countDocuments({ isActive: true }),
      RestaurantRegistry.countDocuments({ 'features.hasReservation': true }),
      RestaurantRegistry.findOne({}).sort({ 'syncStatus.lastSyncedAt': -1 }).select('syncStatus.lastSyncedAt'),
    ]);

    return {
      totalRestaurants: total,
      v1Restaurants: v1,
      v2Restaurants: v2,
      activeRestaurants: active,
      withReservation,
      lastSyncAt: lastSync?.syncStatus?.lastSyncedAt,
    };
  } catch (error) {
    logger.error('[Registry] Failed to get stats', { error });
    throw error;
  }
};

/**
 * Sync registry with POS systems
 * Fetches all restaurants from both POS systems and updates the registry
 */
export const syncRegistry = async (): Promise<{
  synced: number;
  errors: number;
}> => {
  logger.info('[Registry] Starting registry sync...');

  let synced = 0;
  let errors = 0;

  try {
    // Fetch all restaurants from both POS systems
    const result = await posRouter.getRestaurants({ limit: 1000 });

    // Register each restaurant
    for (const restaurant of result.data) {
      try {
        await registerRestaurant(restaurant);
        synced++;
      } catch (error) {
        errors++;
        logger.error('[Registry] Sync error for restaurant', {
          restaurantId: restaurant.id,
          error,
        });
      }
    }

    logger.info('[Registry] Registry sync complete', { synced, errors });

    return { synced, errors };
  } catch (error) {
    logger.error('[Registry] Registry sync failed', { error });
    throw error;
  }
};

/**
 * Mark restaurant as inactive
 */
export const deactivateRestaurant = async (unifiedId: string): Promise<void> => {
  try {
    await RestaurantRegistry.findOneAndUpdate(
      { unifiedId },
      { isActive: false }
    );

    // Invalidate cache
    const cacheKey = `${CACHE_PREFIX}version:${unifiedId}`;
    await redisHelpers.del(cacheKey);

    logger.info('[Registry] Restaurant deactivated', { unifiedId });
  } catch (error) {
    logger.error('[Registry] Failed to deactivate restaurant', { unifiedId, error });
    throw error;
  }
};

/**
 * Get restaurants by POS version
 */
export const getRestaurantsByVersion = async (
  posVersion: POSVersionType,
  params?: { page?: number; limit?: number }
): Promise<{
  data: IRestaurantRegistry[];
  total: number;
}> => {
  try {
    const page = params?.page || 1;
    const limit = params?.limit || 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      RestaurantRegistry.find({ posVersion, isActive: true })
        .skip(skip)
        .limit(limit)
        .lean(),
      RestaurantRegistry.countDocuments({ posVersion, isActive: true }),
    ]);

    return { data: data as IRestaurantRegistry[], total };
  } catch (error) {
    logger.error('[Registry] Failed to get restaurants by version', { posVersion, error });
    throw error;
  }
};

// ============================================================================
// EXPORT
// ============================================================================

export default {
  getRestaurantPOSVersion,
  registerRestaurant,
  bulkRegisterRestaurants,
  searchRegistry,
  getRegistryStats,
  syncRegistry,
  deactivateRestaurant,
  getRestaurantsByVersion,
};
