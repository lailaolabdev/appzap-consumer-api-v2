/**
 * POS V2 Adapter
 * Implements the IPOSAdapter interface for POS V2 (appzap-pos-api-v2)
 * 
 * This adapter wraps the existing posV2Api.service.ts and transforms
 * POS V2 data to the unified format.
 * 
 * IMPORTANT: This adapter does NOT modify POS V2. It only reads from it
 * and transforms the data for the Consumer API.
 */

import * as posV2Service from '../services/posV2Api.service';
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
  PaymentSplit,
} from '../types/unified.types';
import logger from '../utils/logger';
import axios, { AxiosInstance } from 'axios';
import config from '../config/env';

// ============================================================================
// STATUS MAPPINGS
// ============================================================================

// POS V2 Order status → Unified Order status
const V2_ORDER_STATUS_MAP: Record<string, UnifiedOrderStatus> = {
  'pending': 'pending',
  'new': 'pending',
  'confirmed': 'confirmed',
  'accepted': 'confirmed',
  'preparing': 'preparing',
  'cooking': 'preparing',
  'in_progress': 'preparing',
  'ready': 'ready',
  'ready_for_pickup': 'ready',
  'served': 'served',
  'delivered': 'served',
  'completed': 'completed',
  'paid': 'completed',
  'closed': 'completed',
  'cancelled': 'cancelled',
  'rejected': 'cancelled',
  'refunded': 'cancelled',
};

// Unified status → POS V2 status (for updates)
const UNIFIED_TO_V2_STATUS_MAP: Record<UnifiedOrderStatus, string> = {
  'pending': 'pending',
  'confirmed': 'confirmed',
  'preparing': 'preparing',
  'ready': 'ready',
  'served': 'served',
  'completed': 'completed',
  'cancelled': 'cancelled',
};

// POS V2 Reservation status → Unified Reservation status
const V2_RESERVATION_STATUS_MAP: Record<string, UnifiedReservationStatus> = {
  'pending': 'pending',
  'confirmed': 'confirmed',
  'seated': 'seated',
  'completed': 'completed',
  'cancelled': 'cancelled',
  'no_show': 'no_show',
};

// ============================================================================
// ADAPTER IMPLEMENTATION
// ============================================================================

export class POSV2Adapter implements IPOSAdapter {
  readonly version: POSVersion = POS_VERSION.V2;
  private config: POSAdapterConfig;
  private client: AxiosInstance;

  constructor(adapterConfig?: POSAdapterConfig) {
    this.config = adapterConfig || {
      baseUrl: config.posV2Api.url || 'http://localhost:8080',
      apiKey: config.posV2Api.apiKey,
      timeout: 30000,
    };

    // Create dedicated axios client for additional methods
    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'X-API-Key': this.config.apiKey }),
      },
    });
  }

  // ==========================================================================
  // HEALTH CHECK
  // ==========================================================================

  async healthCheck(): Promise<POSHealthStatus> {
    const startTime = Date.now();
    try {
      // Try to fetch one restaurant to verify API is working
      await posV2Service.getRestaurants({ page: 1, limit: 1 });
      return {
        isHealthy: true,
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
      const page = params?.page || 1;
      const limit = params?.limit || 20;

      const { data, total } = await posV2Service.getRestaurants({
        page,
        limit,
      });

      // Filter by search if provided
      let filteredData = data;
      if (params?.search) {
        const searchLower = params.search.toLowerCase();
        filteredData = data.filter((r: any) =>
          r.name?.toLowerCase().includes(searchLower) ||
          r.nameEn?.toLowerCase().includes(searchLower)
        );
      }

      const restaurants = filteredData.map((restaurant: any) =>
        this.transformRestaurant(restaurant)
      );

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
      logger.error('[POS V2 Adapter] Failed to get restaurants', { error });
      throw error;
    }
  }

  async getRestaurantById(id: string): Promise<UnifiedRestaurant | null> {
    try {
      const restaurant = await posV2Service.getRestaurantById(id);
      if (!restaurant) return null;
      return this.transformRestaurant(restaurant);
    } catch (error) {
      logger.error('[POS V2 Adapter] Failed to get restaurant', { id, error });
      throw error;
    }
  }

  // ==========================================================================
  // MENU
  // ==========================================================================

  async getMenu(restaurantId: string): Promise<UnifiedMenu> {
    try {
      const restaurant = await posV2Service.getRestaurantById(restaurantId);
      
      const categories: UnifiedCategory[] = [];
      const items: UnifiedMenuItem[] = [];

      if (restaurant?.menu) {
        // Transform categories
        if (restaurant.menu.categories) {
          for (const cat of restaurant.menu.categories) {
            categories.push(this.transformCategory(cat));
          }
        }

        // Transform menu items
        if (restaurant.menu.items) {
          for (const item of restaurant.menu.items) {
            items.push(this.transformMenuItem(item, restaurantId));
          }
        }
      }

      return {
        restaurantId: `v2_${restaurantId}`,
        posVersion: POS_VERSION.V2,
        categories,
        items,
      };
    } catch (error) {
      logger.error('[POS V2 Adapter] Failed to get menu', { restaurantId, error });
      throw error;
    }
  }

  async getMenuItem(restaurantId: string, itemId: string): Promise<UnifiedMenuItem | null> {
    try {
      // POS V2 doesn't have a single item endpoint, get from full menu
      const menu = await this.getMenu(restaurantId);
      return menu.items.find((item) => item.originalId === itemId) || null;
    } catch (error) {
      logger.error('[POS V2 Adapter] Failed to get menu item', { restaurantId, itemId, error });
      throw error;
    }
  }

  // ==========================================================================
  // ORDERS
  // ==========================================================================

  async createOrder(order: CreateOrderInput): Promise<UnifiedOrder> {
    try {
      // Extract original restaurant ID (remove v2_ prefix if present)
      const restaurantId = order.restaurantId.replace(/^v2_/, '');

      // Transform items to V2 format
      const v2Items = order.items.map((item) => ({
        menuItemId: item.menuItemId.replace(/^v2_/, ''),
        quantity: item.quantity,
        modifiers: item.modifiers?.map((m) => ({
          id: m.id,
          name: '', // Will be filled by POS
          price: 0,
        })),
        specialInstructions: item.note,
      }));

      // Generate external order ID
      const externalOrderId = `consumer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const posOrder = await posV2Service.createOrder({
        restaurantId,
        tableId: order.tableId?.replace(/^v2_/, ''),
        items: v2Items,
        orderSource: 'consumer_app',
        externalOrderId,
        customerInfo: order.customer
          ? {
              name: order.customer.name,
              phone: order.customer.phone,
            }
          : undefined,
      });

      // Transform the response
      return this.transformOrderResponse(posOrder, order, restaurantId);
    } catch (error) {
      logger.error('[POS V2 Adapter] Failed to create order', { error });
      throw error;
    }
  }

  async getOrderById(orderId: string): Promise<UnifiedOrder | null> {
    try {
      // POS V2 order retrieval endpoint
      const response = await this.client.get(`/api/v1/orders/${orderId}`);
      const orderData = response.data.data || response.data;
      
      if (!orderData) return null;
      
      return this.transformFullOrder(orderData);
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      logger.error('[POS V2 Adapter] Failed to get order', { orderId, error });
      throw error;
    }
  }

  async getUserOrders(params: {
    userId?: string;
    phone?: string;
    consumerId?: string;
  } & PaginationParams): Promise<PaginatedResponse<UnifiedOrder>> {
    try {
      // POS V2 may support filtering by customer
      const page = params.page || 1;
      const limit = params.limit || 20;

      const response = await this.client.get('/api/v1/orders', {
        params: {
          customerId: params.consumerId || params.userId,
          customerPhone: params.phone,
          page,
          limit,
        },
      });

      const responseData = response.data.data || response.data;
      const orders = Array.isArray(responseData) 
        ? responseData 
        : responseData.results || [];
      const total = responseData.totalCount || responseData.total || orders.length;

      const transformedOrders = orders.map((order: any) => this.transformFullOrder(order));

      return {
        data: transformedOrders,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total,
        },
      };
    } catch (error) {
      logger.error('[POS V2 Adapter] Failed to get user orders', { params, error });
      // Return empty result instead of throwing for graceful degradation
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
  }

  async updateOrderStatus(orderId: string, status: UnifiedOrderStatus): Promise<UnifiedOrder> {
    try {
      const v2Status = UNIFIED_TO_V2_STATUS_MAP[status];
      await posV2Service.updateOrderStatus(orderId, v2Status);
      
      // Fetch and return updated order
      const order = await this.getOrderById(orderId);
      if (!order) {
        throw new Error(`Order ${orderId} not found after update`);
      }
      return order;
    } catch (error) {
      logger.error('[POS V2 Adapter] Failed to update order status', { orderId, status, error });
      throw error;
    }
  }

  // ==========================================================================
  // TABLES
  // ==========================================================================

  async getTables(restaurantId: string): Promise<UnifiedTable[]> {
    try {
      const response = await this.client.get('/api/v1/tables', {
        params: { restaurantId },
      });

      const tables = response.data.data || response.data || [];
      return tables.map((table: any) => this.transformTable(table, restaurantId));
    } catch (error) {
      logger.error('[POS V2 Adapter] Failed to get tables', { restaurantId, error });
      return [];
    }
  }

  // ==========================================================================
  // RESERVATIONS
  // ==========================================================================

  async checkAvailability(params: AvailabilityParams): Promise<TimeSlot[]> {
    try {
      const restaurantId = params.restaurantId.replace(/^v2_/, '');
      
      const slots = await posV2Service.checkAvailability({
        restaurantId,
        date: params.date,
        guests: params.partySize,
      });

      return slots.map((slot: any) => ({
        time: slot.time,
        available: slot.available,
        tables: (slot.tables || []).map((t: any) => `v2_${t}`),
        maxPartySize: slot.maxGuests,
        waitTime: slot.waitTime,
      }));
    } catch (error) {
      logger.error('[POS V2 Adapter] Failed to check availability', { params, error });
      throw error;
    }
  }

  async createReservation(reservation: CreateReservationInput): Promise<UnifiedReservation> {
    try {
      const restaurantId = reservation.restaurantId.replace(/^v2_/, '');
      const externalBookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const posReservation = await posV2Service.createReservation({
        restaurantId,
        date: reservation.date,
        time: reservation.time,
        guests: reservation.guestCount,
        customerInfo: {
          name: reservation.customerName,
          phone: reservation.customerPhone,
        },
        specialRequests: reservation.specialRequests,
        externalBookingId,
      });

      return this.transformReservation(posReservation, reservation, restaurantId);
    } catch (error) {
      logger.error('[POS V2 Adapter] Failed to create reservation', { error });
      throw error;
    }
  }

  async getReservationById(reservationId: string): Promise<UnifiedReservation | null> {
    try {
      const reservation = await posV2Service.getReservationById(reservationId);
      if (!reservation) return null;
      return this.transformReservationData(reservation);
    } catch (error) {
      logger.error('[POS V2 Adapter] Failed to get reservation', { reservationId, error });
      throw error;
    }
  }

  async getUserReservations(params: {
    userId?: string;
    phone?: string;
    consumerId?: string;
    restaurantId?: string;
    status?: string;
  } & PaginationParams): Promise<PaginatedResponse<UnifiedReservation>> {
    try {
      const result = await posV2Service.getUserReservations({
        customerId: params.consumerId || params.userId || params.phone || '',
        status: params.status,
        limit: params.limit,
        skip: params.skip || ((params.page || 1) - 1) * (params.limit || 20),
      });

      const reservations = (result.data || []).map((r: any) =>
        this.transformReservationData(r)
      );

      return {
        data: reservations,
        pagination: {
          total: result.total || reservations.length,
          page: params.page || 1,
          limit: params.limit || 20,
          totalPages: Math.ceil((result.total || reservations.length) / (params.limit || 20)),
          hasMore: false,
        },
      };
    } catch (error) {
      logger.error('[POS V2 Adapter] Failed to get user reservations', { params, error });
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
  }

  async cancelReservation(reservationId: string, reason?: string): Promise<void> {
    try {
      await posV2Service.cancelReservation(reservationId);
      logger.info('[POS V2 Adapter] Reservation cancelled', { reservationId, reason });
    } catch (error) {
      logger.error('[POS V2 Adapter] Failed to cancel reservation', { reservationId, error });
      throw error;
    }
  }

  // ==========================================================================
  // BILLS (V2 Specific - supports split)
  // ==========================================================================

  async getBill(billId: string): Promise<UnifiedBill | null> {
    try {
      const response = await this.client.get(`/api/v1/transactions/${billId}`);
      const billData = response.data.data || response.data;
      
      if (!billData) return null;
      
      return this.transformBill(billData);
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      logger.error('[POS V2 Adapter] Failed to get bill', { billId, error });
      throw error;
    }
  }

  async splitBill(input: {
    billId: string;
    splitType: 'equal' | 'by_amount' | 'by_items';
    participants: Array<{
      userId?: string;
      name?: string;
      amount?: number;
      items?: string[];
    }>;
  }): Promise<UnifiedBill> {
    try {
      const response = await this.client.post(`/api/v1/transactions/${input.billId}/split`, {
        splitType: input.splitType,
        splits: input.participants.map((p) => ({
          userId: p.userId,
          name: p.name,
          amount: p.amount,
          itemIds: p.items,
        })),
      });

      const billData = response.data.data || response.data;
      return this.transformBill(billData);
    } catch (error) {
      logger.error('[POS V2 Adapter] Failed to split bill', { input, error });
      throw error;
    }
  }

  // ==========================================================================
  // TRANSFORMATION HELPERS
  // ==========================================================================

  private transformRestaurant(restaurant: any): UnifiedRestaurant {
    const address: Address = restaurant.location
      ? {
          street: restaurant.location.address,
          coordinates: {
            lat: restaurant.location.latitude,
            lng: restaurant.location.longitude,
          },
          fullAddress: restaurant.location.address,
        }
      : {};

    // Extract features from restaurant settings
    const features: RestaurantFeatures = {
      dineIn: restaurant.serviceOptions?.dineIn !== false,
      takeaway: restaurant.serviceOptions?.pickup !== false,
      delivery: restaurant.serviceOptions?.delivery === true,
      reservation: restaurant.serviceOptions?.reservation !== false,
      qrOrdering: restaurant.digitalServices?.qrMenu !== false,
      liveBill: true, // V2 supports live bills
      splitBill: true, // V2 supports split bills
      loyaltyPoints: restaurant.digitalServices?.loyaltyProgram !== false,
    };

    // Transform business hours
    const businessHours: DayHours[] = [];
    if (restaurant.operatingHours || restaurant.enhancedBusinessHours) {
      const hours = restaurant.enhancedBusinessHours || restaurant.operatingHours;
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      for (let day = 0; day <= 6; day++) {
        const dayHours = hours[dayNames[day].toLowerCase()] || hours[day];
        if (dayHours) {
          businessHours.push({
            day,
            dayName: dayNames[day],
            isOpen: dayHours.isOpen !== false,
            shifts: dayHours.shifts || [{ open: dayHours.open || '09:00', close: dayHours.close || '22:00' }],
          });
        }
      }
    }

    // Extract currency settings
    const currencySettings = restaurant.settings?.currency || {};

    return {
      id: `v2_${restaurant._id}`,
      posVersion: POS_VERSION.V2,
      originalId: restaurant._id,
      name: restaurant.name,
      description: restaurant.description,
      translations: restaurant.translations,
      image: restaurant.coverImage || restaurant.logo,
      logo: restaurant.logo,
      coverImage: restaurant.coverImage,
      address,
      contact: {
        phone: restaurant.phone,
        email: restaurant.email,
      },
      rating: restaurant.rating
        ? { average: restaurant.rating.average || 0, count: restaurant.rating.count || 0 }
        : undefined,
      features,
      businessHours,
      currency: {
        main: currencySettings.mainCurrency || 'LAK',
        supported: currencySettings.supportedCurrencies || ['LAK'],
        exchangeRates: currencySettings.exchangeRates,
      },
      taxRate: restaurant.taxSettings?.vatRate,
      serviceChargeRate: restaurant.taxSettings?.serviceChargeRate,
      isOpen: restaurant.isActive !== false,
      isActive: restaurant.isActive !== false,
      createdAt: restaurant.createdAt ? new Date(restaurant.createdAt) : undefined,
      updatedAt: restaurant.updatedAt ? new Date(restaurant.updatedAt) : undefined,
      _posData: restaurant,
    };
  }

  private transformCategory(category: any): UnifiedCategory {
    return {
      id: `v2_${category._id}`,
      posVersion: POS_VERSION.V2,
      originalId: category._id,
      name: category.name,
      description: category.description,
      translations: category.translations,
      image: category.image,
      sortOrder: category.sortOrder || category.displayOrder,
      isActive: category.isActive !== false,
      itemCount: category.itemCount,
    };
  }

  private transformMenuItem(item: any, restaurantId: string): UnifiedMenuItem {
    // Extract price from pricing object or direct price field
    const price = item.pricing?.basePrice || item.price || 0;
    const originalPrice = item.pricing?.originalPrice || item.originalPrice;

    // Transform customizations to options
    const options = (item.customizations || []).map((cust: any) => ({
      id: cust._id || cust.id,
      name: cust.name,
      price: cust.price || 0,
      isRequired: cust.isRequired,
      maxSelections: cust.maxSelections,
      choices: cust.options?.map((opt: any) => ({
        id: opt._id || opt.id,
        name: opt.name,
        price: opt.price || 0,
        isDefault: opt.isDefault,
      })),
    }));

    // Transform variants
    const variants = (item.variants || []).map((v: any) => ({
      id: v._id || v.id,
      name: v.name,
      price: v.price || 0,
      sku: v.sku,
    }));

    return {
      id: `v2_${item._id}`,
      posVersion: POS_VERSION.V2,
      originalId: item._id,
      name: item.name,
      description: item.description,
      translations: item.translations,
      categoryId: item.categoryId ? `v2_${item.categoryId}` : '',
      categoryName: item.categoryName,
      price,
      originalPrice,
      currency: item.pricing?.currency || 'LAK',
      multiCurrencyPrices: item.pricing?.multiCurrencyPrices,
      image: item.images?.[0]?.original || item.image,
      images: item.images?.map((img: any) => img.original || img),
      options,
      variants,
      isAvailable: item.isActive !== false && item.inventory?.trackInventory !== true || (item.inventory?.quantity || 0) > 0,
      quantity: item.inventory?.quantity,
      trackInventory: item.inventory?.trackInventory,
      sku: item.sku,
      barcode: item.barcode,
      sortOrder: item.sortOrder || item.displayOrder,
      isActive: item.isActive !== false,
      isShowOnApp: true,
      _posData: item,
    };
  }

  private transformOrderResponse(
    posOrder: any,
    input: CreateOrderInput,
    restaurantId: string
  ): UnifiedOrder {
    const now = new Date();

    return {
      id: `v2_${posOrder.orderId}`,
      posVersion: POS_VERSION.V2,
      originalId: posOrder.orderId,
      orderCode: posOrder.orderNumber || posOrder.orderId.slice(-6).toUpperCase(),
      restaurantId: `v2_${restaurantId}`,
      orderType: input.orderType,
      status: V2_ORDER_STATUS_MAP[posOrder.status] || 'pending',
      customer: input.customer,
      table: input.tableId ? { id: input.tableId, name: '' } : undefined,
      items: input.items.map((item, idx) => ({
        id: `item_${idx}`,
        menuItemId: item.menuItemId,
        name: '',
        quantity: item.quantity,
        unitPrice: 0,
        totalPrice: 0,
        currency: 'LAK',
        note: item.note,
      })),
      pricing: {
        subtotal: 0,
        discount: 0,
        tax: 0,
        serviceCharge: 0,
        total: 0,
        currency: 'LAK',
      },
      payment: {
        status: 'pending',
        totalDue: 0,
        paidAmount: 0,
      },
      timing: {
        orderedAt: posOrder.createdAt ? new Date(posOrder.createdAt) : now,
        pickupTime: input.scheduling?.pickupTime,
      },
      source: 'app',
      createdAt: posOrder.createdAt ? new Date(posOrder.createdAt) : now,
      updatedAt: now,
      _posData: posOrder,
    };
  }

  private transformFullOrder(order: any): UnifiedOrder {
    const items: UnifiedOrderItem[] = (order.lineItems || order.items || []).map((item: any) => ({
      id: `v2_${item._id || item.id}`,
      menuItemId: `v2_${item.menuItemId}`,
      name: item.name || item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice?.amount || item.unitPrice || item.price || 0,
      totalPrice: item.lineTotal?.amount || item.totalPrice || item.total || 0,
      currency: item.unitPrice?.currency || 'LAK',
      modifiers: (item.modifiers || item.customizations || []).map((mod: any) => ({
        id: mod.id || mod._id,
        name: mod.name,
        price: mod.price || 0,
        quantity: mod.quantity || 1,
      })),
      note: item.specialInstructions || item.note,
      status: item.status,
      _posData: item,
    }));

    const pricing: OrderPricing = {
      subtotal: order.pricing?.lineItemsTotal?.amount || order.subtotal || 0,
      discount: order.pricing?.discounts?.totalDiscount?.amount || order.discount || 0,
      discountType: order.pricing?.discounts?.discountType,
      tax: order.pricing?.taxes?.totalTax?.amount || order.tax || 0,
      taxRate: order.pricing?.taxes?.taxRate,
      serviceCharge: order.pricing?.fees?.serviceCharge?.amount || order.serviceCharge || 0,
      total: order.pricing?.totalDue?.amount || order.total || order.grandTotal || 0,
      currency: order.pricing?.totalDue?.currency || 'LAK',
    };

    // Handle splits if present
    const splits: PaymentSplit[] | undefined = order.paymentInfo?.splitDetails?.isSplit
      ? order.paymentInfo.splitDetails.itemSplits?.map((split: any) => ({
          id: split.userId || split.id,
          userId: split.userId,
          name: split.name,
          amount: split.amount?.amount || split.amount || 0,
          status: split.status || 'pending',
          paymentMethod: split.paymentMethod,
          paidAt: split.paidAt ? new Date(split.paidAt) : undefined,
        }))
      : undefined;

    const payment: OrderPayment = {
      status: order.paymentInfo?.paymentStatus || order.paymentStatus || 'pending',
      method: order.paymentInfo?.paymentMethod || order.paymentMethod,
      totalDue: order.paymentInfo?.totalDue?.amount || pricing.total,
      paidAmount: order.paymentInfo?.amountPaid?.amount || order.amountPaid || 0,
      transactionIds: order.paymentInfo?.transactionIds,
      splits,
    };

    const timing: OrderTiming = {
      orderedAt: order.timing?.orderedAt ? new Date(order.timing.orderedAt) : new Date(order.createdAt),
      confirmedAt: order.timing?.confirmedAt ? new Date(order.timing.confirmedAt) : undefined,
      preparingAt: order.timing?.preparingAt ? new Date(order.timing.preparingAt) : undefined,
      readyAt: order.timing?.readyAt ? new Date(order.timing.readyAt) : undefined,
      servedAt: order.timing?.servedAt ? new Date(order.timing.servedAt) : undefined,
      completedAt: order.timing?.completedAt ? new Date(order.timing.completedAt) : undefined,
      pickupTime: order.timing?.scheduledFor ? new Date(order.timing.scheduledFor) : undefined,
      estimatedReadyTime: order.timing?.estimatedReadyTime ? new Date(order.timing.estimatedReadyTime) : undefined,
    };

    return {
      id: `v2_${order._id || order.orderId}`,
      posVersion: POS_VERSION.V2,
      originalId: order._id || order.orderId,
      orderCode: order.qNumber || order.orderNumber || (order._id || order.orderId).slice(-6).toUpperCase(),
      restaurantId: `v2_${order.restaurantId}`,
      restaurantName: order.restaurantName,
      branchId: order.branchId ? `v2_${order.branchId}` : undefined,
      orderType: order.fulfillment?.type || order.orderType || 'dine_in',
      status: V2_ORDER_STATUS_MAP[order.orderStatus || order.status] || 'pending',
      customer: order.customer
        ? {
            id: order.customer.customerId,
            name: order.customer.name,
            phone: order.customer.phone,
            email: order.customer.email,
          }
        : undefined,
      table: order.fulfillment?.tableInfo
        ? {
            id: `v2_${order.fulfillment.tableInfo.tableId}`,
            name: order.fulfillment.tableInfo.tableName || '',
            zone: order.fulfillment.tableInfo.zone,
          }
        : undefined,
      items,
      pricing,
      payment,
      timing,
      note: order.note || order.customerNote,
      kitchenNote: order.kitchenNote,
      source: order.source?.type || 'app',
      createdAt: new Date(order.createdAt),
      updatedAt: new Date(order.updatedAt),
      _posData: order,
    };
  }

  private transformTable(table: any, restaurantId: string): UnifiedTable {
    return {
      id: `v2_${table._id}`,
      posVersion: POS_VERSION.V2,
      originalId: table._id,
      restaurantId: `v2_${restaurantId}`,
      name: table.name,
      zone: table.zoneId,
      zoneName: table.zoneName,
      capacity: table.capacity || table.maxCapacity || 4,
      minCapacity: table.minCapacity,
      maxCapacity: table.maxCapacity,
      status: table.status || 'available',
      currentSessionId: table.currentSessionId,
      currentReservationId: table.currentReservationId,
      position: table.position,
      shape: table.shape,
      isActive: table.isActive !== false,
      _posData: table,
    };
  }

  private transformReservation(
    posReservation: any,
    input: CreateReservationInput,
    restaurantId: string
  ): UnifiedReservation {
    const now = new Date();

    return {
      id: `v2_${posReservation.reservationId}`,
      posVersion: POS_VERSION.V2,
      originalId: posReservation.reservationId,
      reservationCode: posReservation.reservationCode,
      restaurantId: `v2_${restaurantId}`,
      date: input.date,
      time: input.time,
      duration: input.duration,
      guestCount: input.guestCount,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      status: V2_RESERVATION_STATUS_MAP[posReservation.status] || 'pending' as UnifiedReservationStatus,
      specialRequests: input.specialRequests,
      source: 'app',
      createdAt: posReservation.createdAt ? new Date(posReservation.createdAt) : now,
      _posData: posReservation,
    };
  }

  private transformReservationData(reservation: any): UnifiedReservation {
    return {
      id: `v2_${reservation._id || reservation.reservationId}`,
      posVersion: POS_VERSION.V2,
      originalId: reservation._id || reservation.reservationId,
      reservationCode: reservation.reservationCode,
      restaurantId: `v2_${reservation.restaurantId}`,
      restaurantName: reservation.restaurantName,
      branchId: reservation.branchId ? `v2_${reservation.branchId}` : undefined,
      tableId: reservation.tableId ? `v2_${reservation.tableId}` : undefined,
      tableIds: reservation.tableIds?.map((id: string) => `v2_${id}`),
      tableName: reservation.tableName,
      zone: reservation.zone,
      date: reservation.reservationDate || reservation.date,
      time: reservation.reservationTime || reservation.time,
      endTime: reservation.endTime,
      duration: reservation.duration,
      guestCount: reservation.guestCount || reservation.guests,
      customerId: reservation.customerId,
      customerName: reservation.customerName,
      customerPhone: reservation.customerPhone,
      customerEmail: reservation.customerEmail,
      status: V2_RESERVATION_STATUS_MAP[reservation.status] || 'pending' as UnifiedReservationStatus,
      deposit: reservation.deposit
        ? {
            required: reservation.deposit.required,
            amount: reservation.deposit.amount,
            paid: reservation.deposit.paid,
            paymentId: reservation.deposit.paymentId,
          }
        : undefined,
      note: reservation.note,
      specialRequests: reservation.specialRequests,
      source: reservation.source,
      createdAt: new Date(reservation.createdAt),
      updatedAt: reservation.updatedAt ? new Date(reservation.updatedAt) : undefined,
      confirmedAt: reservation.confirmedAt ? new Date(reservation.confirmedAt) : undefined,
      cancelledAt: reservation.cancelledAt ? new Date(reservation.cancelledAt) : undefined,
      _posData: reservation,
    };
  }

  private transformBill(bill: any): UnifiedBill {
    const splits: PaymentSplit[] | undefined = bill.splitDetails?.isSplit
      ? bill.splitDetails.itemSplits?.map((split: any) => ({
          id: split.id || split.userId,
          userId: split.userId,
          name: split.name,
          amount: split.amount?.amount || split.amount || 0,
          status: split.status || 'pending',
          paymentMethod: split.paymentMethod,
          paidAt: split.paidAt ? new Date(split.paidAt) : undefined,
        }))
      : undefined;

    return {
      id: `v2_${bill._id || bill.transactionId}`,
      posVersion: POS_VERSION.V2,
      originalId: bill._id || bill.transactionId,
      restaurantId: `v2_${bill.restaurantId}`,
      tableId: bill.tableId ? `v2_${bill.tableId}` : undefined,
      tableName: bill.tableName,
      orders: (bill.orderReferences || []).map((ref: any) => `v2_${ref.orderId || ref}`),
      pricing: {
        subtotal: bill.consolidatedTotals?.lineItems?.amount || 0,
        discount: bill.consolidatedTotals?.discounts?.amount || 0,
        tax: bill.consolidatedTotals?.taxes?.amount || 0,
        serviceCharge: bill.consolidatedTotals?.fees?.amount || 0,
        total: bill.consolidatedTotals?.grandTotal?.amount || bill.totalAmount || 0,
        currency: bill.consolidatedTotals?.grandTotal?.currency || 'LAK',
      },
      payment: {
        status: bill.paymentSummary?.paymentStatus || bill.transactionStatus || 'pending',
        method: bill.paymentSummary?.paymentMethodBreakdown?.[0]?.method,
        methods: bill.paymentSummary?.paymentMethodBreakdown?.map((p: any) => p.method),
        totalDue: bill.paymentSummary?.totalDue?.amount || 0,
        paidAmount: bill.paymentSummary?.totalPaid?.amount || 0,
        splits,
      },
      status: bill.transactionStatus === 'completed' ? 'paid' : 'open',
      customer: bill.customer
        ? {
            id: bill.customer.customerId,
            name: bill.customer.name,
            phone: bill.customer.phone,
          }
        : undefined,
      createdAt: new Date(bill.createdAt),
      updatedAt: new Date(bill.updatedAt),
      paidAt: bill.timing?.completedAt ? new Date(bill.timing.completedAt) : undefined,
      _posData: bill,
    };
  }
}

// ============================================================================
// EXPORT
// ============================================================================

// Factory function
export const createPOSV2Adapter = (config?: POSAdapterConfig): IPOSAdapter => {
  return new POSV2Adapter(config);
};

// Default instance
export const posV2Adapter = new POSV2Adapter();

export default posV2Adapter;
