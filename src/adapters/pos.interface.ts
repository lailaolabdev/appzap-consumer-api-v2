/**
 * POS Adapter Interface
 * Defines the contract that both POS V1 and POS V2 adapters must implement
 * This ensures consistent behavior regardless of which POS system is being used
 */

import {
  POSVersion,
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
  POSHealthStatus,
  UnifiedOrderStatus,
} from '../types/unified.types';

// ============================================================================
// ADAPTER INTERFACE
// ============================================================================

/**
 * IPOSAdapter - Interface for POS system adapters
 * 
 * Each adapter (V1 and V2) must implement this interface to provide
 * a consistent API for the Consumer API to interact with.
 */
export interface IPOSAdapter {
  /**
   * The POS version this adapter handles
   */
  readonly version: POSVersion;

  // ==========================================================================
  // HEALTH & CONNECTION
  // ==========================================================================

  /**
   * Check if the POS system is reachable and healthy
   */
  healthCheck(): Promise<POSHealthStatus>;

  // ==========================================================================
  // RESTAURANTS
  // ==========================================================================

  /**
   * Get a list of restaurants from this POS system
   * @param params - Pagination and filter parameters
   */
  getRestaurants(params?: PaginationParams & {
    search?: string;
    isActive?: boolean;
    hasReservation?: boolean;
    location?: { lat: number; lng: number; radiusKm?: number };
  }): Promise<PaginatedResponse<UnifiedRestaurant>>;

  /**
   * Get a single restaurant by its original POS ID
   * @param id - The original POS restaurant ID (not prefixed)
   */
  getRestaurantById(id: string): Promise<UnifiedRestaurant | null>;

  // ==========================================================================
  // MENU
  // ==========================================================================

  /**
   * Get the full menu for a restaurant (categories + items)
   * @param restaurantId - The original POS restaurant ID
   */
  getMenu(restaurantId: string): Promise<UnifiedMenu>;

  /**
   * Get a single menu item
   * @param restaurantId - The original POS restaurant ID
   * @param itemId - The original POS menu item ID
   */
  getMenuItem(restaurantId: string, itemId: string): Promise<UnifiedMenuItem | null>;

  // ==========================================================================
  // ORDERS
  // ==========================================================================

  /**
   * Create a new order
   * @param order - The order creation input
   * @returns The created order
   */
  createOrder(order: CreateOrderInput): Promise<UnifiedOrder>;

  /**
   * Get an order by ID
   * @param orderId - The original POS order ID
   */
  getOrderById(orderId: string): Promise<UnifiedOrder | null>;

  /**
   * Get orders for a specific user/customer
   * @param params - User identifier and pagination
   */
  getUserOrders(params: {
    userId?: string;
    phone?: string;
    consumerId?: string;
  } & PaginationParams): Promise<PaginatedResponse<UnifiedOrder>>;

  /**
   * Update the status of an order
   * @param orderId - The original POS order ID
   * @param status - The new status
   */
  updateOrderStatus(orderId: string, status: UnifiedOrderStatus): Promise<UnifiedOrder>;

  /**
   * Apply a discount to an order
   * @param orderId - The original POS order ID  
   * @param discount - The discount to apply
   */
  applyDiscount?(orderId: string, discount: {
    type: 'percent' | 'amount' | 'loyalty' | 'voucher';
    value: number;
    code?: string;
    reason?: string;
  }): Promise<UnifiedOrder>;

  // ==========================================================================
  // TABLES
  // ==========================================================================

  /**
   * Get tables for a restaurant
   * @param restaurantId - The original POS restaurant ID
   */
  getTables(restaurantId: string): Promise<UnifiedTable[]>;

  /**
   * Get a single table by ID
   * @param restaurantId - The original POS restaurant ID
   * @param tableId - The original POS table ID
   */
  getTableById?(restaurantId: string, tableId: string): Promise<UnifiedTable | null>;

  // ==========================================================================
  // RESERVATIONS
  // ==========================================================================

  /**
   * Check table availability for a specific date/time
   * @param params - Availability check parameters
   */
  checkAvailability(params: AvailabilityParams): Promise<TimeSlot[]>;

  /**
   * Create a new reservation
   * @param reservation - The reservation creation input
   */
  createReservation(reservation: CreateReservationInput): Promise<UnifiedReservation>;

  /**
   * Get a reservation by ID
   * @param reservationId - The original POS reservation ID
   */
  getReservationById(reservationId: string): Promise<UnifiedReservation | null>;

  /**
   * Get reservations for a user
   * @param params - User identifier and pagination
   */
  getUserReservations(params: {
    userId?: string;
    phone?: string;
    consumerId?: string;
    restaurantId?: string;
    status?: string;
  } & PaginationParams): Promise<PaginatedResponse<UnifiedReservation>>;

  /**
   * Cancel a reservation
   * @param reservationId - The original POS reservation ID
   * @param reason - Optional cancellation reason
   */
  cancelReservation(reservationId: string, reason?: string): Promise<void>;

  /**
   * Update a reservation
   * @param reservationId - The original POS reservation ID
   * @param updates - Fields to update
   */
  updateReservation?(reservationId: string, updates: Partial<CreateReservationInput>): Promise<UnifiedReservation>;

  // ==========================================================================
  // BILLS & PAYMENTS
  // ==========================================================================

  /**
   * Get a bill by ID
   * @param billId - The original POS bill ID
   */
  getBill?(billId: string): Promise<UnifiedBill | null>;

  /**
   * Get the active bill for a table
   * @param restaurantId - The original POS restaurant ID
   * @param tableId - The original POS table ID
   */
  getTableBill?(restaurantId: string, tableId: string): Promise<UnifiedBill | null>;

  /**
   * Split a bill among multiple participants
   * @param input - Split bill input
   */
  splitBill?(input: SplitBillInput): Promise<UnifiedBill>;

  /**
   * Request checkout for a bill
   * @param billId - The original POS bill ID
   */
  requestCheckout?(billId: string): Promise<void>;
}

// ============================================================================
// ADAPTER FACTORY TYPE
// ============================================================================

/**
 * Factory function type for creating POS adapters
 */
export type POSAdapterFactory = (config: POSAdapterConfig) => IPOSAdapter;

/**
 * Configuration for POS adapters
 */
export interface POSAdapterConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

// ============================================================================
// ADAPTER RESULT TYPES
// ============================================================================

/**
 * Result wrapper for adapter operations that might fail
 */
export interface AdapterResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  source: POSVersion;
}

/**
 * Combined result from multiple adapters
 */
export interface CombinedAdapterResult<T> {
  v1?: AdapterResult<T>;
  v2?: AdapterResult<T>;
  combined?: T;
}

// ============================================================================
// TRANSFORMATION HELPERS
// ============================================================================

/**
 * Type for transformation functions that convert POS data to unified format
 */
export type TransformFn<TInput, TOutput> = (input: TInput, version: POSVersion) => TOutput;

/**
 * Options for transformation functions
 */
export interface TransformOptions {
  includeRawData?: boolean;  // Include _posData field
  restaurantId?: string;     // For items that need restaurant context
}
