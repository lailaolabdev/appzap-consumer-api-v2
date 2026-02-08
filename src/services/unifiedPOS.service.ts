/**
 * Unified POS Service
 * 
 * A new service layer that uses the POS adapters for all operations.
 * This service can be used alongside the existing unifiedRestaurant.service.ts
 * and provides the same functionality but with the new adapter pattern.
 * 
 * Usage:
 * - For new features, use this service
 * - For existing features, gradually migrate from unifiedRestaurant.service.ts
 * - Both services can coexist during the migration period
 */

import { posRouter, POSRouter } from '../adapters/pos.router';
import {
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
  POSVersion,
} from '../types/unified.types';
import * as registryService from './restaurantRegistry.service';
import logger from '../utils/logger';

// ============================================================================
// SERVICE CLASS
// ============================================================================

class UnifiedPOSService {
  private router: POSRouter;

  constructor() {
    this.router = posRouter;
  }

  // ==========================================================================
  // HEALTH & STATUS
  // ==========================================================================

  /**
   * Check health of both POS systems
   */
  async checkHealth(): Promise<POSConnectionStatus> {
    return this.router.checkHealth();
  }

  /**
   * Get registry statistics
   */
  async getRegistryStats(): Promise<{
    totalRestaurants: number;
    v1Restaurants: number;
    v2Restaurants: number;
    activeRestaurants: number;
    withReservation: number;
  }> {
    return registryService.getRegistryStats();
  }

  // ==========================================================================
  // RESTAURANTS
  // ==========================================================================

  /**
   * Get all restaurants from both POS systems
   */
  async getRestaurants(params?: PaginationParams & {
    search?: string;
    isActive?: boolean;
    hasReservation?: boolean;
    location?: { lat: number; lng: number; radiusKm?: number };
  }): Promise<PaginatedResponse<UnifiedRestaurant>> {
    try {
      const result = await this.router.getRestaurants(params);

      // Optionally register restaurants in registry for faster future lookups
      // This happens in the background
      this.registerRestaurantsAsync(result.data);

      return result;
    } catch (error) {
      logger.error('[UnifiedPOS] Failed to get restaurants', { error });
      throw error;
    }
  }

  /**
   * Get a single restaurant by unified ID
   */
  async getRestaurantById(unifiedId: string): Promise<UnifiedRestaurant | null> {
    try {
      const restaurant = await this.router.getRestaurantById(unifiedId);

      if (restaurant) {
        // Update registry
        this.registerRestaurantsAsync([restaurant]);
      }

      return restaurant;
    } catch (error) {
      logger.error('[UnifiedPOS] Failed to get restaurant', { unifiedId, error });
      throw error;
    }
  }

  /**
   * Search restaurants with registry support
   */
  async searchRestaurants(params: {
    search?: string;
    province?: string;
    hasReservation?: boolean;
    location?: { lat: number; lng: number; radiusKm?: number };
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<UnifiedRestaurant>> {
    // For location-based searches, check registry first
    if (params.location) {
      try {
        const registryResults = await registryService.searchRegistry({
          ...params,
          posVersion: undefined,
          isActive: true,
        });

        // If we have registry results, use them (fast)
        if (registryResults.data.length > 0) {
          // Fetch full data for registry results
          const restaurants: UnifiedRestaurant[] = [];
          for (const reg of registryResults.data) {
            const full = await this.router.getRestaurantById(reg.unifiedId);
            if (full) restaurants.push(full);
          }

          return {
            data: restaurants,
            pagination: {
              total: registryResults.total,
              page: params.page || 1,
              limit: params.limit || 20,
              totalPages: Math.ceil(registryResults.total / (params.limit || 20)),
              hasMore: (params.page || 1) * (params.limit || 20) < registryResults.total,
            },
          };
        }
      } catch (error) {
        logger.warn('[UnifiedPOS] Registry search failed, falling back to direct', { error });
      }
    }

    // Fall back to direct POS query
    return this.getRestaurants(params);
  }

  // ==========================================================================
  // MENU
  // ==========================================================================

  /**
   * Get menu for a restaurant
   */
  async getMenu(unifiedRestaurantId: string): Promise<UnifiedMenu> {
    return this.router.getMenu(unifiedRestaurantId);
  }

  /**
   * Get a single menu item
   */
  async getMenuItem(
    unifiedRestaurantId: string,
    unifiedItemId: string
  ): Promise<UnifiedMenuItem | null> {
    return this.router.getMenuItem(unifiedRestaurantId, unifiedItemId);
  }

  // ==========================================================================
  // ORDERS
  // ==========================================================================

  /**
   * Create an order
   */
  async createOrder(order: CreateOrderInput): Promise<UnifiedOrder> {
    return this.router.createOrder(order);
  }

  /**
   * Get an order by ID
   */
  async getOrderById(unifiedOrderId: string): Promise<UnifiedOrder | null> {
    return this.router.getOrderById(unifiedOrderId);
  }

  /**
   * Get user's orders from all POS systems
   */
  async getUserOrders(params: {
    userId?: string;
    phone?: string;
    consumerId?: string;
  } & PaginationParams): Promise<PaginatedResponse<UnifiedOrder>> {
    return this.router.getUserOrders(params);
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    unifiedOrderId: string,
    status: UnifiedOrderStatus
  ): Promise<UnifiedOrder> {
    return this.router.updateOrderStatus(unifiedOrderId, status);
  }

  // ==========================================================================
  // TABLES
  // ==========================================================================

  /**
   * Get tables for a restaurant
   */
  async getTables(unifiedRestaurantId: string): Promise<UnifiedTable[]> {
    return this.router.getTables(unifiedRestaurantId);
  }

  // ==========================================================================
  // RESERVATIONS
  // ==========================================================================

  /**
   * Check table availability
   */
  async checkAvailability(params: AvailabilityParams): Promise<TimeSlot[]> {
    return this.router.checkAvailability(params);
  }

  /**
   * Create a reservation
   */
  async createReservation(
    reservation: CreateReservationInput
  ): Promise<UnifiedReservation> {
    return this.router.createReservation(reservation);
  }

  /**
   * Get reservation by ID
   */
  async getReservationById(
    unifiedReservationId: string
  ): Promise<UnifiedReservation | null> {
    return this.router.getReservationById(unifiedReservationId);
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
    return this.router.getUserReservations(params);
  }

  /**
   * Cancel a reservation
   */
  async cancelReservation(
    unifiedReservationId: string,
    reason?: string
  ): Promise<void> {
    return this.router.cancelReservation(unifiedReservationId, reason);
  }

  // ==========================================================================
  // BILLS
  // ==========================================================================

  /**
   * Get a bill by ID
   */
  async getBill(unifiedBillId: string): Promise<UnifiedBill | null> {
    return this.router.getBill(unifiedBillId);
  }

  /**
   * Split a bill (V2 only)
   */
  async splitBill(input: SplitBillInput): Promise<UnifiedBill> {
    return this.router.splitBill(input);
  }

  // ==========================================================================
  // REGISTRY OPERATIONS
  // ==========================================================================

  /**
   * Sync registry with POS systems
   */
  async syncRegistry(): Promise<{ synced: number; errors: number }> {
    return registryService.syncRegistry();
  }

  /**
   * Get POS version for a restaurant
   */
  async getRestaurantPOSVersion(unifiedId: string): Promise<POSVersion | null> {
    const version = await registryService.getRestaurantPOSVersion(unifiedId);
    return version as POSVersion | null;
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Parse a unified ID to extract version and original ID
   */
  parseUnifiedId(unifiedId: string): {
    version: POSVersion | null;
    originalId: string;
  } {
    return this.router.parseRestaurantId(unifiedId);
  }

  /**
   * Register restaurants in registry (background)
   */
  private registerRestaurantsAsync(restaurants: UnifiedRestaurant[]): void {
    registryService.bulkRegisterRestaurants(restaurants).catch((error) => {
      logger.warn('[UnifiedPOS] Failed to register restaurants in background', { error });
    });
  }
}

// ============================================================================
// EXPORT
// ============================================================================

// Default instance
export const unifiedPOSService = new UnifiedPOSService();

export default unifiedPOSService;
