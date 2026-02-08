/**
 * POS V1 Adapter
 * Implements the IPOSAdapter interface for POS V1 (appzap-app-api)
 * 
 * This adapter wraps the existing posV1Api.service.ts and transforms
 * POS V1 data to the unified format.
 * 
 * IMPORTANT: This adapter does NOT modify POS V1. It only reads from it
 * and transforms the data for the Consumer API.
 */

import { posV1Service, PosV1Store, PosV1Menu, PosV1Bill, PosV1Table, PosV1Category } from '../services/posV1Api.service';
import { IPOSAdapter, POSAdapterConfig } from './pos.interface';
import {
  POSVersion,
  POS_VERSION,
  PaginationParams,
  PaginatedResponse,
  UnifiedRestaurant,
  UnifiedMenu,
  UnifiedMenuItem,
  UnifiedCategory,
  UnifiedOrder,
  UnifiedOrderItem,
  UnifiedTable,
  UnifiedReservation,
  UnifiedReservationStatus,
  UnifiedBill,
  TimeSlot,
  CreateOrderInput,
  CreateReservationInput,
  AvailabilityParams,
  POSHealthStatus,
  UnifiedOrderStatus,
  RestaurantFeatures,
  DayHours,
  Address,
  OrderPricing,
  OrderPayment,
  OrderTiming,
} from '../types/unified.types';
import logger from '../utils/logger';

// ============================================================================
// STATUS MAPPINGS
// ============================================================================

// POS V1 Bill status → Unified Order status
const V1_ORDER_STATUS_MAP: Record<string, UnifiedOrderStatus> = {
  'CART': 'pending',
  'WAITING': 'pending',
  'pending': 'pending',
  'DOING': 'preparing',
  'cooking': 'preparing',
  'confirmed': 'confirmed',
  'SERVED': 'served',
  'served': 'served',
  'CHECKOUT': 'completed',
  'checkout': 'completed',
  'PAID': 'completed',
  'PRINTBILL': 'completed',
  'CANCELED': 'cancelled',
  'cancelled': 'cancelled',
  'FEEDBACK': 'completed',
};

// Unified status → POS V1 status (for updates)
const UNIFIED_TO_V1_STATUS_MAP: Record<UnifiedOrderStatus, string> = {
  'pending': 'WAITING',
  'confirmed': 'DOING',
  'preparing': 'DOING',
  'ready': 'SERVED',
  'served': 'SERVED',
  'completed': 'CHECKOUT',
  'cancelled': 'CANCELED',
};

// POS V1 Reservation status → Unified Reservation status
const V1_RESERVATION_STATUS_MAP: Record<string, UnifiedReservationStatus> = {
  'WAITING': 'pending',
  'WATTING': 'pending',  // Typo in V1
  'STAFF_CONFIRM': 'confirmed',
  'SUCCESS': 'completed',
  'CANCEL': 'cancelled',
};

// ============================================================================
// ADAPTER IMPLEMENTATION
// ============================================================================

export class POSV1Adapter implements IPOSAdapter {
  readonly version: POSVersion = POS_VERSION.V1;
  private config: POSAdapterConfig;

  constructor(config?: POSAdapterConfig) {
    this.config = config || {
      baseUrl: process.env.POS_V1_API_URL || 'http://localhost:7070',
      apiKey: process.env.POS_V1_API_KEY,
      timeout: 30000,
    };
  }

  // ==========================================================================
  // HEALTH CHECK
  // ==========================================================================

  async healthCheck(): Promise<POSHealthStatus> {
    const startTime = Date.now();
    try {
      const isHealthy = await posV1Service.healthCheck();
      return {
        isHealthy,
        latency: Date.now() - startTime,
        lastCheck: new Date(),
      };
    } catch (error: any) {
      return {
        isHealthy: false,
        latency: Date.now() - startTime,
        lastCheck: new Date(),
        error: error.message,
      };
    }
  }

  // ==========================================================================
  // RESTAURANTS
  // ==========================================================================

  async getRestaurants(params?: PaginationParams & {
    search?: string;
    isActive?: boolean;
    hasReservation?: boolean;
    location?: { lat: number; lng: number; radiusKm?: number };
  }): Promise<PaginatedResponse<UnifiedRestaurant>> {
    try {
      const { data, total } = await posV1Service.getStores({
        skip: params?.skip || ((params?.page || 1) - 1) * (params?.limit || 20),
        limit: params?.limit || 20,
        search: params?.search,
        isActive: params?.isActive,
      });

      const restaurants = data.map((store) => this.transformRestaurant(store));
      const limit = params?.limit || 20;
      const page = params?.page || 1;

      return {
        data: restaurants,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total,
        },
      };
    } catch (error) {
      logger.error('[POS V1 Adapter] Failed to get restaurants', { error });
      throw error;
    }
  }

  async getRestaurantById(id: string): Promise<UnifiedRestaurant | null> {
    try {
      const store = await posV1Service.getStoreById(id);
      if (!store) return null;
      return this.transformRestaurant(store);
    } catch (error) {
      logger.error('[POS V1 Adapter] Failed to get restaurant', { id, error });
      throw error;
    }
  }

  // ==========================================================================
  // MENU
  // ==========================================================================

  async getMenu(restaurantId: string): Promise<UnifiedMenu> {
    try {
      const [categoriesData, menusData] = await Promise.all([
        posV1Service.getCategories(restaurantId),
        posV1Service.getMenus(restaurantId, { limit: 1000 }),
      ]);

      const categories = categoriesData.map((cat) => this.transformCategory(cat));
      const items = menusData.data.map((menu) => this.transformMenuItem(menu, restaurantId));

      return {
        restaurantId: `v1_${restaurantId}`,
        posVersion: POS_VERSION.V1,
        categories,
        items,
      };
    } catch (error) {
      logger.error('[POS V1 Adapter] Failed to get menu', { restaurantId, error });
      throw error;
    }
  }

  async getMenuItem(restaurantId: string, itemId: string): Promise<UnifiedMenuItem | null> {
    try {
      const menu = await posV1Service.getMenuById(itemId);
      if (!menu) return null;
      return this.transformMenuItem(menu, restaurantId);
    } catch (error) {
      logger.error('[POS V1 Adapter] Failed to get menu item', { restaurantId, itemId, error });
      throw error;
    }
  }

  // ==========================================================================
  // ORDERS
  // ==========================================================================

  async createOrder(order: CreateOrderInput): Promise<UnifiedOrder> {
    try {
      // Extract original restaurant ID (remove v1_ prefix if present)
      const restaurantId = order.restaurantId.replace(/^v1_/, '');

      // Transform items to V1 format
      const v1Orders = order.items.map((item) => ({
        menuId: item.menuItemId.replace(/^v1_/, ''),
        quantity: item.quantity,
        options: item.modifiers?.map((m) => m.id) || [],
        toppings: [],
        note: item.note,
      }));

      // Build note with pickup time if scheduled
      let note = order.note || '';
      if (order.scheduling?.pickupTime) {
        const pickupTimeStr = new Date(order.scheduling.pickupTime).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });
        note = `[Pickup Time: ${pickupTimeStr}] ${note}`.trim();
      }

      const bill = await posV1Service.createBill({
        storeId: restaurantId,
        tableId: order.tableId?.replace(/^v1_/, ''),
        orders: v1Orders,
        customerPhone: order.customer?.phone,
        consumerId: order.customer?.id,
        orderType: order.orderType,
      });

      return this.transformOrder(bill);
    } catch (error) {
      logger.error('[POS V1 Adapter] Failed to create order', { error });
      throw error;
    }
  }

  async getOrderById(orderId: string): Promise<UnifiedOrder | null> {
    try {
      const bill = await posV1Service.getBillById(orderId);
      if (!bill) return null;
      return this.transformOrder(bill);
    } catch (error) {
      logger.error('[POS V1 Adapter] Failed to get order', { orderId, error });
      throw error;
    }
  }

  async getUserOrders(params: {
    userId?: string;
    phone?: string;
    consumerId?: string;
  } & PaginationParams): Promise<PaginatedResponse<UnifiedOrder>> {
    try {
      const { data, total } = await posV1Service.getUserOrders({
        customerPhone: params.phone,
        consumerId: params.consumerId || params.userId,
        skip: params.skip || ((params.page || 1) - 1) * (params.limit || 20),
        limit: params.limit || 20,
      });

      const orders = data.map((bill) => this.transformOrder(bill));
      const limit = params.limit || 20;
      const page = params.page || 1;

      return {
        data: orders,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total,
        },
      };
    } catch (error) {
      logger.error('[POS V1 Adapter] Failed to get user orders', { params, error });
      throw error;
    }
  }

  async updateOrderStatus(orderId: string, status: UnifiedOrderStatus): Promise<UnifiedOrder> {
    // POS V1 doesn't have a direct status update endpoint from Consumer API
    // This would need to be added to POS V1 or handled via webhook
    logger.warn('[POS V1 Adapter] Order status update not directly supported', { orderId, status });
    
    // Return the current order state
    const order = await this.getOrderById(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }
    return order;
  }

  // ==========================================================================
  // TABLES
  // ==========================================================================

  async getTables(restaurantId: string): Promise<UnifiedTable[]> {
    try {
      const tables = await posV1Service.getTables(restaurantId);
      return tables.map((table) => this.transformTable(table, restaurantId));
    } catch (error) {
      logger.error('[POS V1 Adapter] Failed to get tables', { restaurantId, error });
      throw error;
    }
  }

  // ==========================================================================
  // RESERVATIONS
  // ==========================================================================

  async checkAvailability(params: AvailabilityParams): Promise<TimeSlot[]> {
    try {
      // POS V1 doesn't have a native availability endpoint
      // We need to calculate availability from tables and existing reservations
      const restaurantId = params.restaurantId.replace(/^v1_/, '');
      
      // Get all tables for the restaurant
      const tables = await posV1Service.getTables(restaurantId);
      
      // Get restaurant hours (would need to be fetched from store)
      // For now, return basic time slots
      const timeSlots: TimeSlot[] = [];
      const availableTables = tables.filter((t: any) => t.isPublished !== false);
      
      // Generate time slots from 10:00 to 22:00
      for (let hour = 10; hour <= 21; hour++) {
        for (let min = 0; min < 60; min += 30) {
          const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
          timeSlots.push({
            time,
            available: availableTables.length > 0,
            tables: availableTables.map((t: any) => `v1_${t._id}`),
            maxPartySize: Math.max(...availableTables.map((t: any) => t.capacity || 4)),
          });
        }
      }

      return timeSlots;
    } catch (error) {
      logger.error('[POS V1 Adapter] Failed to check availability', { params, error });
      throw error;
    }
  }

  async createReservation(reservation: CreateReservationInput): Promise<UnifiedReservation> {
    // POS V1 reservation creation would need to call /v5/reservation/create
    // This is a placeholder - actual implementation depends on POS V1 endpoint
    logger.warn('[POS V1 Adapter] Reservation creation needs POS V1 endpoint implementation');
    
    throw new Error('Reservation creation not fully implemented for POS V1');
  }

  async getReservationById(reservationId: string): Promise<UnifiedReservation | null> {
    // POS V1 doesn't have a direct get reservation by ID endpoint exposed
    logger.warn('[POS V1 Adapter] Get reservation by ID needs POS V1 endpoint');
    return null;
  }

  async getUserReservations(params: {
    userId?: string;
    phone?: string;
    consumerId?: string;
    restaurantId?: string;
    status?: string;
  } & PaginationParams): Promise<PaginatedResponse<UnifiedReservation>> {
    // POS V1 reservation listing would need to be implemented
    logger.warn('[POS V1 Adapter] User reservations query needs POS V1 endpoint');
    
    return {
      data: [],
      pagination: {
        total: 0,
        page: params.page || 1,
        limit: params.limit || 20,
        totalPages: 0,
        hasMore: false,
      },
    };
  }

  async cancelReservation(reservationId: string, reason?: string): Promise<void> {
    // POS V1 reservation cancellation would need to call PUT /v5/reservation/:id/update
    logger.warn('[POS V1 Adapter] Reservation cancellation needs POS V1 endpoint implementation');
    throw new Error('Reservation cancellation not fully implemented for POS V1');
  }

  // ==========================================================================
  // TRANSFORMATION HELPERS
  // ==========================================================================

  private transformRestaurant(store: PosV1Store): UnifiedRestaurant {
    const address: Address = {
      village: store.address?.village,
      district: store.address?.district,
      province: store.address?.province,
      coordinates: store.address?.latitude && store.address?.longitude
        ? {
            lat: parseFloat(store.address.latitude),
            lng: parseFloat(store.address.longitude),
          }
        : undefined,
    };

    const features: RestaurantFeatures = {
      dineIn: true,
      takeaway: true,
      delivery: false,
      reservation: store.isReservable || false,
      qrOrdering: true,
      liveBill: false,
      splitBill: false,
      loyaltyPoints: true,
    };

    // Parse business hours from openTime/closeTime
    const businessHours: DayHours[] = [];
    if (store.openTime && store.closeTime) {
      for (let day = 0; day <= 6; day++) {
        businessHours.push({
          day,
          dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day],
          isOpen: true,
          shifts: [{ open: store.openTime, close: store.closeTime }],
        });
      }
    }

    return {
      id: `v1_${store._id}`,
      posVersion: POS_VERSION.V1,
      originalId: store._id,
      name: store.name,
      description: store.nameEn,
      translations: store.nameEn ? { en: { name: store.nameEn } } : undefined,
      image: store.image,
      coverImage: store.coverImage,
      address,
      contact: {
        phone: store.phone,
        email: store.email,
      },
      rating: store.rating
        ? { average: store.rating, count: 0 }
        : undefined,
      features,
      businessHours,
      currency: {
        main: 'LAK',
        supported: ['LAK'],
      },
      isOpen: store.isOpen || false,
      isActive: store.isActive !== false,
      createdAt: store.createdAt ? new Date(store.createdAt) : undefined,
      updatedAt: store.updatedAt ? new Date(store.updatedAt) : undefined,
      _posData: store,
    };
  }

  private transformCategory(category: PosV1Category): UnifiedCategory {
    return {
      id: `v1_${category._id}`,
      posVersion: POS_VERSION.V1,
      originalId: category._id,
      name: category.name,
      translations: category.nameEn ? { en: { name: category.nameEn } } : undefined,
      image: category.image,
      sortOrder: category.sort,
      isActive: true,
    };
  }

  private transformMenuItem(menu: PosV1Menu, restaurantId: string): UnifiedMenuItem {
    return {
      id: `v1_${menu._id}`,
      posVersion: POS_VERSION.V1,
      originalId: menu._id,
      name: menu.name,
      description: menu.description,
      translations: menu.nameEn ? { en: { name: menu.nameEn } } : undefined,
      categoryId: menu.categoryId ? `v1_${menu.categoryId}` : '',
      categoryName: menu.categoryName,
      price: menu.price,
      currency: 'LAK',
      image: menu.image,
      options: menu.options?.map((opt) => ({
        id: opt._id,
        name: opt.name,
        price: opt.price,
      })),
      isAvailable: menu.isAvailable !== false,
      isActive: menu.isActive !== false,
      isShowOnApp: true,
      createdAt: menu.createdAt ? new Date(menu.createdAt) : undefined,
      updatedAt: menu.updatedAt ? new Date(menu.updatedAt) : undefined,
      _posData: menu,
    };
  }

  private transformOrder(bill: PosV1Bill): UnifiedOrder {
    const items: UnifiedOrderItem[] = (bill.orders || []).map((order) => ({
      id: `v1_${order._id}`,
      menuItemId: `v1_${order.menuId}`,
      name: order.menuName,
      quantity: order.quantity,
      unitPrice: order.price,
      totalPrice: order.totalPrice,
      currency: 'LAK',
      modifiers: [
        ...(order.options || []).map((opt) => ({
          id: opt.name,
          name: opt.name,
          price: opt.price,
          quantity: 1,
        })),
        ...(order.toppings || []).map((top) => ({
          id: top.name,
          name: top.name,
          price: top.price,
          quantity: 1,
        })),
      ],
      note: order.note,
      status: order.status as any,
      _posData: order,
    }));

    const pricing: OrderPricing = {
      subtotal: bill.totalAmount,
      discount: bill.discountAmount || 0,
      tax: 0,
      serviceCharge: 0,
      total: bill.finalAmount,
      currency: 'LAK',
    };

    const payment: OrderPayment = {
      status: bill.isPaid ? 'paid' : 'pending',
      method: bill.paymentMethod,
      totalDue: bill.finalAmount,
      paidAmount: bill.isPaid ? bill.finalAmount : 0,
    };

    const timing: OrderTiming = {
      orderedAt: bill.createdAt ? new Date(bill.createdAt) : new Date(),
      completedAt: bill.isPaid && bill.updatedAt ? new Date(bill.updatedAt) : undefined,
    };

    return {
      id: `v1_${bill._id}`,
      posVersion: POS_VERSION.V1,
      originalId: bill._id,
      orderCode: bill.billNo || bill._id.slice(-6).toUpperCase(),
      restaurantId: `v1_${bill.storeId}`,
      orderType: 'dine_in',
      status: V1_ORDER_STATUS_MAP[bill.status] || 'pending',
      customer: bill.customerPhone ? { phone: bill.customerPhone } : undefined,
      table: bill.tableId
        ? { id: `v1_${bill.tableId}`, name: bill.tableName || '' }
        : undefined,
      items,
      pricing,
      payment,
      timing,
      source: 'app',
      createdAt: bill.createdAt ? new Date(bill.createdAt) : new Date(),
      updatedAt: bill.updatedAt ? new Date(bill.updatedAt) : new Date(),
      _posData: bill,
    };
  }

  private transformTable(table: PosV1Table, restaurantId: string): UnifiedTable {
    return {
      id: `v1_${table._id}`,
      posVersion: POS_VERSION.V1,
      originalId: table._id,
      restaurantId: `v1_${restaurantId}`,
      name: table.name,
      zone: table.zoneId,
      zoneName: table.zoneName,
      capacity: table.capacity || 4,
      status: (table.status as any) || 'available',
      isActive: true,
      _posData: table,
    };
  }
}

// ============================================================================
// EXPORT
// ============================================================================

// Factory function
export const createPOSV1Adapter = (config?: POSAdapterConfig): IPOSAdapter => {
  return new POSV1Adapter(config);
};

// Default instance
export const posV1Adapter = new POSV1Adapter();

export default posV1Adapter;
