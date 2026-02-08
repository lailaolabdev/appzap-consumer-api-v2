/**
 * POS Router
 * Routes requests to the appropriate POS adapter based on restaurant ID
 * 
 * This is the main entry point for all POS operations. It:
 * 1. Determines which POS system handles a given restaurant
 * 2. Routes the request to the correct adapter
 * 3. Combines results from multiple POS systems when needed
 * 4. Handles graceful degradation if one POS is unavailable
 */

import { IPOSAdapter, CombinedAdapterResult, AdapterResult } from './pos.interface';
import { POSV1Adapter, posV1Adapter } from './posV1.adapter';
import { POSV2Adapter, posV2Adapter } from './posV2.adapter';
import {
  POSVersion,
  POS_VERSION,
  PaginationParams,
  PaginatedResponse,
  UnifiedRestaurant,
  UnifiedMenu,
  UnifiedMenuItem,
  UnifiedOrder,
  UnifiedTable,
  UnifiedReservation,
  UnifiedBill,
  TimeSlot,
  CreateOrderInput,
  CreateReservationInput,
  AvailabilityParams,
  SplitBillInput,
  POSConnectionStatus,
  UnifiedOrderStatus,
} from '../types/unified.types';
import logger from '../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface ParsedRestaurantId {
  version: POSVersion | null;
  originalId: string;
}

export interface RouterConfig {
  enableV1: boolean;
  enableV2: boolean;
  preferredVersion?: POSVersion;  // When version is unknown, try this first
  parallelFetch: boolean;         // Fetch from both POS systems in parallel
  gracefulDegradation: boolean;   // Continue if one POS fails
}

// ============================================================================
// POS ROUTER CLASS
// ============================================================================

export class POSRouter {
  private v1Adapter: IPOSAdapter;
  private v2Adapter: IPOSAdapter;
  private config: RouterConfig;

  constructor(config?: Partial<RouterConfig>) {
    this.v1Adapter = posV1Adapter;
    this.v2Adapter = posV2Adapter;
    
    this.config = {
      enableV1: true,
      enableV2: true,
      preferredVersion: POS_VERSION.V2,
      parallelFetch: true,
      gracefulDegradation: true,
      ...config,
    };
  }

  // ==========================================================================
  // ID PARSING & ROUTING
  // ==========================================================================

  /**
   * Parse a unified restaurant ID to extract version and original ID
   * Format: v1_xxxx or v2_xxxx
   */
  parseRestaurantId(unifiedId: string): ParsedRestaurantId {
    if (unifiedId.startsWith('v1_')) {
      return {
        version: POS_VERSION.V1,
        originalId: unifiedId.substring(3),
      };
    }
    
    if (unifiedId.startsWith('v2_')) {
      return {
        version: POS_VERSION.V2,
        originalId: unifiedId.substring(3),
      };
    }

    // Unknown format - return as-is with null version
    return {
      version: null,
      originalId: unifiedId,
    };
  }

  /**
   * Get the appropriate adapter for a given restaurant ID
   */
  getAdapterForRestaurant(unifiedId: string): IPOSAdapter {
    const { version } = this.parseRestaurantId(unifiedId);
    
    if (version === POS_VERSION.V1 && this.config.enableV1) {
      return this.v1Adapter;
    }
    
    if (version === POS_VERSION.V2 && this.config.enableV2) {
      return this.v2Adapter;
    }

    // If version unknown, use preferred version
    if (this.config.preferredVersion === POS_VERSION.V2 && this.config.enableV2) {
      return this.v2Adapter;
    }
    
    return this.v1Adapter;
  }

  /**
   * Get adapter by version
   */
  getAdapter(version: POSVersion): IPOSAdapter {
    return version === POS_VERSION.V1 ? this.v1Adapter : this.v2Adapter;
  }

  // ==========================================================================
  // HEALTH & STATUS
  // ==========================================================================

  /**
   * Check health of both POS systems
   */
  async checkHealth(): Promise<POSConnectionStatus> {
    const [v1Health, v2Health] = await Promise.all([
      this.config.enableV1 ? this.v1Adapter.healthCheck() : Promise.resolve({ isHealthy: false, lastCheck: new Date(), error: 'Disabled' }),
      this.config.enableV2 ? this.v2Adapter.healthCheck() : Promise.resolve({ isHealthy: false, lastCheck: new Date(), error: 'Disabled' }),
    ]);

    return { v1: v1Health, v2: v2Health };
  }

  // ==========================================================================
  // RESTAURANTS
  // ==========================================================================

  /**
   * Get restaurants from all enabled POS systems
   */
  async getRestaurants(params?: PaginationParams & {
    search?: string;
    isActive?: boolean;
    hasReservation?: boolean;
    location?: { lat: number; lng: number; radiusKm?: number };
  }): Promise<PaginatedResponse<UnifiedRestaurant>> {
    const results: UnifiedRestaurant[] = [];
    let totalCount = 0;

    const page = params?.page || 1;
    const limit = params?.limit || 20;

    try {
      if (this.config.parallelFetch) {
        // Fetch from both POS systems in parallel
        const [v1Result, v2Result] = await Promise.allSettled([
          this.config.enableV1
            ? this.v1Adapter.getRestaurants({ ...params, limit: 500 })
            : Promise.resolve({ data: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0, hasMore: false } }),
          this.config.enableV2
            ? this.v2Adapter.getRestaurants({ ...params, limit: 500 })
            : Promise.resolve({ data: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0, hasMore: false } }),
        ]);

        // Collect results from V1
        if (v1Result.status === 'fulfilled') {
          results.push(...v1Result.value.data);
          totalCount += v1Result.value.pagination.total;
        } else if (!this.config.gracefulDegradation) {
          logger.error('[POS Router] V1 fetch failed', { error: v1Result.reason });
          throw v1Result.reason;
        } else {
          logger.warn('[POS Router] V1 fetch failed, continuing with V2 only', { error: v1Result.reason });
        }

        // Collect results from V2
        if (v2Result.status === 'fulfilled') {
          results.push(...v2Result.value.data);
          totalCount += v2Result.value.pagination.total;
        } else if (!this.config.gracefulDegradation) {
          logger.error('[POS Router] V2 fetch failed', { error: v2Result.reason });
          throw v2Result.reason;
        } else {
          logger.warn('[POS Router] V2 fetch failed, continuing with V1 only', { error: v2Result.reason });
        }
      } else {
        // Sequential fetch
        if (this.config.enableV1) {
          try {
            const v1Result = await this.v1Adapter.getRestaurants({ ...params, limit: 500 });
            results.push(...v1Result.data);
            totalCount += v1Result.pagination.total;
          } catch (error) {
            if (!this.config.gracefulDegradation) throw error;
            logger.warn('[POS Router] V1 fetch failed', { error });
          }
        }

        if (this.config.enableV2) {
          try {
            const v2Result = await this.v2Adapter.getRestaurants({ ...params, limit: 500 });
            results.push(...v2Result.data);
            totalCount += v2Result.pagination.total;
          } catch (error) {
            if (!this.config.gracefulDegradation) throw error;
            logger.warn('[POS Router] V2 fetch failed', { error });
          }
        }
      }

      // Sort by name or relevance
      results.sort((a, b) => a.name.localeCompare(b.name));

      // Apply pagination to combined results
      const startIndex = (page - 1) * limit;
      const paginatedResults = results.slice(startIndex, startIndex + limit);

      return {
        data: paginatedResults,
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
          hasMore: page * limit < totalCount,
        },
      };
    } catch (error) {
      logger.error('[POS Router] Failed to get restaurants', { error });
      throw error;
    }
  }

  /**
   * Get a single restaurant by unified ID
   */
  async getRestaurantById(unifiedId: string): Promise<UnifiedRestaurant | null> {
    const { version, originalId } = this.parseRestaurantId(unifiedId);

    // If version is known, use specific adapter
    if (version) {
      const adapter = this.getAdapter(version);
      return adapter.getRestaurantById(originalId);
    }

    // Version unknown - try both adapters
    // Try preferred version first
    const preferredAdapter = this.getAdapter(this.config.preferredVersion || POS_VERSION.V2);
    const otherAdapter = preferredAdapter === this.v2Adapter ? this.v1Adapter : this.v2Adapter;

    try {
      const result = await preferredAdapter.getRestaurantById(originalId);
      if (result) return result;
    } catch (error) {
      logger.debug('[POS Router] Preferred adapter failed, trying other', { error });
    }

    try {
      return await otherAdapter.getRestaurantById(originalId);
    } catch (error) {
      logger.debug('[POS Router] Both adapters failed', { error });
      return null;
    }
  }

  // ==========================================================================
  // MENU
  // ==========================================================================

  /**
   * Get menu for a restaurant
   */
  async getMenu(unifiedRestaurantId: string): Promise<UnifiedMenu> {
    const { version, originalId } = this.parseRestaurantId(unifiedRestaurantId);
    const adapter = version ? this.getAdapter(version) : this.getAdapterForRestaurant(unifiedRestaurantId);
    
    return adapter.getMenu(originalId);
  }

  /**
   * Get a single menu item
   */
  async getMenuItem(unifiedRestaurantId: string, unifiedItemId: string): Promise<UnifiedMenuItem | null> {
    const { version: rVersion, originalId: restaurantId } = this.parseRestaurantId(unifiedRestaurantId);
    const { originalId: itemId } = this.parseRestaurantId(unifiedItemId);
    
    const adapter = rVersion ? this.getAdapter(rVersion) : this.getAdapterForRestaurant(unifiedRestaurantId);
    
    return adapter.getMenuItem(restaurantId, itemId);
  }

  // ==========================================================================
  // ORDERS
  // ==========================================================================

  /**
   * Create an order
   */
  async createOrder(order: CreateOrderInput): Promise<UnifiedOrder> {
    const adapter = this.getAdapterForRestaurant(order.restaurantId);
    return adapter.createOrder(order);
  }

  /**
   * Get an order by ID
   */
  async getOrderById(unifiedOrderId: string): Promise<UnifiedOrder | null> {
    const { version, originalId } = this.parseRestaurantId(unifiedOrderId);
    
    if (version) {
      const adapter = this.getAdapter(version);
      return adapter.getOrderById(originalId);
    }

    // Try both if version unknown
    try {
      const v2Result = await this.v2Adapter.getOrderById(originalId);
      if (v2Result) return v2Result;
    } catch (error) {
      logger.debug('[POS Router] V2 order fetch failed', { error });
    }

    try {
      return await this.v1Adapter.getOrderById(originalId);
    } catch (error) {
      logger.debug('[POS Router] V1 order fetch failed', { error });
      return null;
    }
  }

  /**
   * Get user's orders from all POS systems
   */
  async getUserOrders(params: {
    userId?: string;
    phone?: string;
    consumerId?: string;
  } & PaginationParams): Promise<PaginatedResponse<UnifiedOrder>> {
    const allOrders: UnifiedOrder[] = [];
    let totalCount = 0;

    const page = params.page || 1;
    const limit = params.limit || 20;

    try {
      const [v1Result, v2Result] = await Promise.allSettled([
        this.config.enableV1 ? this.v1Adapter.getUserOrders(params) : Promise.resolve({ data: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0, hasMore: false } }),
        this.config.enableV2 ? this.v2Adapter.getUserOrders(params) : Promise.resolve({ data: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0, hasMore: false } }),
      ]);

      if (v1Result.status === 'fulfilled') {
        allOrders.push(...v1Result.value.data);
        totalCount += v1Result.value.pagination.total;
      }

      if (v2Result.status === 'fulfilled') {
        allOrders.push(...v2Result.value.data);
        totalCount += v2Result.value.pagination.total;
      }

      // Sort by creation date (newest first)
      allOrders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const paginatedOrders = allOrders.slice(startIndex, startIndex + limit);

      return {
        data: paginatedOrders,
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
          hasMore: page * limit < totalCount,
        },
      };
    } catch (error) {
      logger.error('[POS Router] Failed to get user orders', { error });
      throw error;
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(unifiedOrderId: string, status: UnifiedOrderStatus): Promise<UnifiedOrder> {
    const { version, originalId } = this.parseRestaurantId(unifiedOrderId);
    const adapter = version ? this.getAdapter(version) : this.v2Adapter;
    
    return adapter.updateOrderStatus(originalId, status);
  }

  // ==========================================================================
  // TABLES
  // ==========================================================================

  /**
   * Get tables for a restaurant
   */
  async getTables(unifiedRestaurantId: string): Promise<UnifiedTable[]> {
    const { version, originalId } = this.parseRestaurantId(unifiedRestaurantId);
    const adapter = version ? this.getAdapter(version) : this.getAdapterForRestaurant(unifiedRestaurantId);
    
    return adapter.getTables(originalId);
  }

  // ==========================================================================
  // RESERVATIONS
  // ==========================================================================

  /**
   * Check table availability
   */
  async checkAvailability(params: AvailabilityParams): Promise<TimeSlot[]> {
    const adapter = this.getAdapterForRestaurant(params.restaurantId);
    return adapter.checkAvailability(params);
  }

  /**
   * Create a reservation
   */
  async createReservation(reservation: CreateReservationInput): Promise<UnifiedReservation> {
    const adapter = this.getAdapterForRestaurant(reservation.restaurantId);
    return adapter.createReservation(reservation);
  }

  /**
   * Get reservation by ID
   */
  async getReservationById(unifiedReservationId: string): Promise<UnifiedReservation | null> {
    const { version, originalId } = this.parseRestaurantId(unifiedReservationId);
    const adapter = version ? this.getAdapter(version) : this.v2Adapter;
    
    return adapter.getReservationById(originalId);
  }

  /**
   * Get user's reservations from all POS systems
   */
  async getUserReservations(params: {
    userId?: string;
    phone?: string;
    consumerId?: string;
    restaurantId?: string;
    status?: string;
  } & PaginationParams): Promise<PaginatedResponse<UnifiedReservation>> {
    const allReservations: UnifiedReservation[] = [];
    let totalCount = 0;

    const page = params.page || 1;
    const limit = params.limit || 20;

    try {
      const [v1Result, v2Result] = await Promise.allSettled([
        this.config.enableV1 ? this.v1Adapter.getUserReservations(params) : Promise.resolve({ data: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0, hasMore: false } }),
        this.config.enableV2 ? this.v2Adapter.getUserReservations(params) : Promise.resolve({ data: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0, hasMore: false } }),
      ]);

      if (v1Result.status === 'fulfilled') {
        allReservations.push(...v1Result.value.data);
        totalCount += v1Result.value.pagination.total;
      }

      if (v2Result.status === 'fulfilled') {
        allReservations.push(...v2Result.value.data);
        totalCount += v2Result.value.pagination.total;
      }

      // Sort by date (upcoming first)
      allReservations.sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`);
        const dateB = new Date(`${b.date}T${b.time}`);
        return dateA.getTime() - dateB.getTime();
      });

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const paginatedReservations = allReservations.slice(startIndex, startIndex + limit);

      return {
        data: paginatedReservations,
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
          hasMore: page * limit < totalCount,
        },
      };
    } catch (error) {
      logger.error('[POS Router] Failed to get user reservations', { error });
      throw error;
    }
  }

  /**
   * Cancel a reservation
   */
  async cancelReservation(unifiedReservationId: string, reason?: string): Promise<void> {
    const { version, originalId } = this.parseRestaurantId(unifiedReservationId);
    const adapter = version ? this.getAdapter(version) : this.v2Adapter;
    
    return adapter.cancelReservation(originalId, reason);
  }

  // ==========================================================================
  // BILLS (V2 specific features gracefully handled)
  // ==========================================================================

  /**
   * Get a bill by ID
   */
  async getBill(unifiedBillId: string): Promise<UnifiedBill | null> {
    const { version, originalId } = this.parseRestaurantId(unifiedBillId);
    
    // Bill feature is primarily V2
    if (version === POS_VERSION.V2 || !version) {
      const v2Adapter = this.v2Adapter as POSV2Adapter;
      if (v2Adapter.getBill) {
        return v2Adapter.getBill(originalId);
      }
    }

    // V1 doesn't have a dedicated bill endpoint
    logger.warn('[POS Router] Bill feature not available for V1');
    return null;
  }

  /**
   * Split a bill (V2 only)
   */
  async splitBill(input: SplitBillInput): Promise<UnifiedBill> {
    const { version } = this.parseRestaurantId(input.billId);
    
    if (version === POS_VERSION.V1) {
      throw new Error('Bill splitting is not supported for V1 restaurants');
    }

    const v2Adapter = this.v2Adapter as POSV2Adapter;
    if (!v2Adapter.splitBill) {
      throw new Error('Bill splitting not available');
    }

    return v2Adapter.splitBill(input);
  }
}

// ============================================================================
// EXPORT
// ============================================================================

// Default instance
export const posRouter = new POSRouter();

// Factory function
export const createPOSRouter = (config?: Partial<RouterConfig>): POSRouter => {
  return new POSRouter(config);
};

export default posRouter;
