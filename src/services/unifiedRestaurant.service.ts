// @ts-nocheck
/**
 * Unified Restaurant Service
 * Combines POS V1 and POS V2 restaurants into a single interface
 * 
 * This service:
 * - Fetches restaurants from both POS V1 (250+) and POS V2 (50+)
 * - Provides a unified data model for the mobile app
 * - Routes requests to the correct POS system based on posVersion
 * - Handles menu, order, and reservation operations
 */

import { posV1Service, PosV1Store, PosV1Menu, PosV1Bill, CreateBillPayload } from './posV1Api.service';
import * as posV2Service from './posV2Api.service';
import RestaurantRegistry from '../models/RestaurantRegistry';
import logger from '../utils/logger';

// ============================================================================
// UNIFIED TYPES
// ============================================================================

export type PosVersion = 'v1' | 'v2';

export interface UnifiedRestaurant {
  _id: string;
  posVersion: PosVersion;
  posRestaurantId: string;  // Original ID in POS system

  // Basic info
  name: string;
  nameEn?: string;
  description?: string;
  phone?: string;
  email?: string;

  // Location
  address?: {
    street?: string;
    village?: string;
    district?: string;
    province?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };

  // Media
  image?: string;
  coverImage?: string;
  gallery?: string[];

  // Status
  isOpen?: boolean;
  isActive: boolean;
  isReservable?: boolean;

  // Ratings & pricing
  rating?: number;
  reviewCount?: number;
  averageCost?: number;
  priceRange?: 'budget' | 'moderate' | 'expensive' | 'luxury';

  // Categories & tags
  cuisine?: string[];
  categories?: string[];
  tags?: string[];

  // Hours
  openTime?: string;
  closeTime?: string;
  businessHours?: {
    day: string;
    open: string;
    close: string;
    isOpen: boolean;
  }[];

  // Features
  features?: string[];
  paymentMethods?: string[];

  // Timestamps
  createdAt?: string;
  updatedAt?: string;
}

export interface UnifiedMenuItem {
  _id: string;
  posVersion: PosVersion;
  posMenuId: string;
  restaurantId: string;

  name: string;
  nameEn?: string;
  description?: string;
  price: number;
  image?: string;

  categoryId?: string;
  categoryName?: string;

  isActive: boolean;
  isAvailable: boolean;

  options?: {
    _id: string;
    name: string;
    price: number;
  }[];

  toppings?: {
    _id: string;
    name: string;
    price: number;
  }[];

  // Health/dietary info
  calories?: number;
  allergens?: string[];
  dietaryTags?: string[];
  spiceLevel?: number;

  createdAt?: string;
  updatedAt?: string;
}

export interface UnifiedCategory {
  _id: string;
  posVersion: PosVersion;
  restaurantId: string;
  name: string;
  nameEn?: string;
  image?: string;
  sort?: number;
}

export interface UnifiedOrder {
  _id: string;
  posVersion: PosVersion;
  posOrderId: string;
  restaurantId: string;
  restaurantName: string;

  consumerId?: string;
  customerPhone?: string;

  status: string;
  orderType: 'dine_in' | 'takeaway' | 'delivery';

  items: {
    menuId: string;
    menuName: string;
    quantity: number;
    price: number;
    totalPrice: number;
    options?: { name: string; price: number }[];
    toppings?: { name: string; price: number }[];
    note?: string;
  }[];

  subtotal: number;
  discount?: number;
  deliveryFee?: number;
  tax?: number;
  total: number;

  paymentMethod?: string;
  isPaid: boolean;

  tableId?: string;
  tableName?: string;

  createdAt?: string;
  updatedAt?: string;
}

export interface CreateOrderPayload {
  restaurantId: string;
  posVersion: PosVersion;
  consumerId?: string;
  customerPhone?: string;
  tableId?: string;
  orderType?: 'dine_in' | 'takeaway' | 'delivery';
  items: {
    menuId: string;
    quantity: number;
    options?: string[];
    toppings?: string[];
    note?: string;
  }[];
  deliveryAddress?: {
    address: string;
    latitude?: number;
    longitude?: number;
  };
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

class UnifiedRestaurantService {

  // ==========================================================================
  // RESTAURANT OPERATIONS
  // ==========================================================================

  /**
   * Get all restaurants from both POS V1 and V2
   */
  async getAllRestaurants(params: {
    skip?: number;
    limit?: number;
    search?: string;
    cuisine?: string;
    isReservable?: boolean;
  } = {}): Promise<{ data: UnifiedRestaurant[]; total: number }> {
    try {
      const { skip = 0, limit = 20 } = params;

      // Fetch from both POS systems in parallel using Consumer API endpoints
      // These use API key authentication
      logger.info('[UnifiedRestaurant] Fetching from POS V1 and V2...');

      const [v1Result, v2Result] = await Promise.allSettled([
        posV1Service.getStoresViaConsumerApi({
          limit: 500,  // Get all from V1
          search: params.search,
        }),
        posV2Service.getRestaurantsViaConsumerApi({
          limit: 500,  // Get all from V2
          search: params.search,
        }),
      ]);

      logger.info('[UnifiedRestaurant] V1 Result:', {
        status: v1Result.status,
        dataCount: v1Result.status === 'fulfilled' ? v1Result.value?.data?.length : 0,
        error: v1Result.status === 'rejected' ? String((v1Result.reason as any)?.message) : undefined
      });
      logger.info('[UnifiedRestaurant] V2 Result:', {
        status: v2Result.status,
        dataCount: v2Result.status === 'fulfilled' ? v2Result.value?.data?.length : 0
      });

      // Extract data, handle failures gracefully
      const v1Restaurants: UnifiedRestaurant[] = v1Result.status === 'fulfilled'
        ? v1Result.value.data.map(r => this.transformV1Restaurant(r))
        : [];

      const v2Restaurants: UnifiedRestaurant[] = v2Result.status === 'fulfilled'
        ? v2Result.value.data.map(r => this.transformV2Restaurant(r))
        : [];

      // Log any failures
      if (v1Result.status === 'rejected') {
        logger.warn('[UnifiedRestaurant] Failed to fetch POS V1 restaurants:', v1Result.reason);
      }
      if (v2Result.status === 'rejected') {
        logger.warn('[UnifiedRestaurant] Failed to fetch POS V2 restaurants:', v2Result.reason);
      }

      // Combine and sort (V2 first as they're newer/premium)
      let allRestaurants = [...v2Restaurants, ...v1Restaurants];

      // Apply filters
      if (params.cuisine) {
        allRestaurants = allRestaurants.filter(r =>
          r.cuisine?.some(c => c.toLowerCase().includes(params.cuisine!.toLowerCase()))
        );
      }

      if (params.isReservable !== undefined) {
        allRestaurants = allRestaurants.filter(r => r.isReservable === params.isReservable);
      }

      if (params.search) {
        const searchLower = params.search.toLowerCase();

        // Semantic AI Text Resolution Mapping (Feature 06)
        // If a query exists, ping the new MongoDB semantic text index resolving weighting natively
        const semanticResults = await RestaurantRegistry.find(
          { $text: { $search: searchLower }, isActive: true },
          { score: { $meta: "textScore" } }
        ).sort({ score: { $meta: "textScore" } }).lean();

        if (semanticResults.length > 0) {
          // Re-order the allRestaurants array based directly upon the textScore weights mapping
          const semanticIdsSet = new Set(semanticResults.map(r => r.unifiedId));

          // Partition matches vs non-matches
          const exactSemanticMatches = allRestaurants.filter(r => semanticIdsSet.has(r._id));

          // Secondary standard exact string fallback for partial indexing
          const fallbackMatches = allRestaurants.filter(r =>
            !semanticIdsSet.has(r._id) && (
              r.name.toLowerCase().includes(searchLower) ||
              r.nameEn?.toLowerCase().includes(searchLower) ||
              r.cuisine?.some(c => c.toLowerCase().includes(searchLower))
            )
          );

          // Sort exact semantic matches by the MongoDB weighting order structurally
          exactSemanticMatches.sort((a, b) => {
            const aIndex = semanticResults.findIndex(sr => sr.unifiedId === a._id);
            const bIndex = semanticResults.findIndex(sr => sr.unifiedId === b._id);
            return aIndex - bIndex;
          });

          allRestaurants = [...exactSemanticMatches, ...fallbackMatches];
        } else {
          // Null Fallback Algorithm gracefully handling standard filters naturally
          allRestaurants = allRestaurants.filter(r =>
            r.name.toLowerCase().includes(searchLower) ||
            r.nameEn?.toLowerCase().includes(searchLower) ||
            r.cuisine?.some(c => c.toLowerCase().includes(searchLower))
          );
        }
      }

      // Calculate total before pagination
      const total = allRestaurants.length;

      // Apply pagination
      const paginatedData = allRestaurants.slice(skip, skip + limit);

      return {
        data: paginatedData,
        total,
      };
    } catch (error) {
      logger.error('[UnifiedRestaurant] Failed to get all restaurants:', error);
      throw error;
    }
  }

  /**
   * Get restaurant by ID (auto-routes to correct POS)
   */
  async getRestaurantById(
    restaurantId: string,
    posVersion?: PosVersion
  ): Promise<UnifiedRestaurant | null> {
    try {
      // If posVersion is provided, go directly to that POS
      if (posVersion === 'v1') {
        const store = await posV1Service.getStoreById(restaurantId);
        return store ? this.transformV1Restaurant(store) : null;
      }

      if (posVersion === 'v2') {
        const restaurant = await posV2Service.getRestaurantById(restaurantId);
        return restaurant ? this.transformV2Restaurant(restaurant) : null;
      }

      // If no posVersion, try both (V2 first)
      try {
        const v2Restaurant = await posV2Service.getRestaurantById(restaurantId);
        if (v2Restaurant) {
          return this.transformV2Restaurant(v2Restaurant);
        }
      } catch (error) {
        // V2 not found, try V1
      }

      try {
        const v1Store = await posV1Service.getStoreById(restaurantId);
        if (v1Store) {
          return this.transformV1Restaurant(v1Store);
        }
      } catch (error) {
        // V1 not found
      }

      return null;
    } catch (error) {
      logger.error(`[UnifiedRestaurant] Failed to get restaurant ${restaurantId}:`, error);
      throw error;
    }
  }

  // ==========================================================================
  // MENU OPERATIONS
  // ==========================================================================

  /**
   * Get menu for a restaurant
   */
  async getMenu(
    restaurantId: string,
    posVersion: PosVersion,
    params: {
      categoryId?: string;
      skip?: number;
      limit?: number;
    } = {}
  ): Promise<{ categories: UnifiedCategory[]; items: UnifiedMenuItem[] }> {
    try {
      if (posVersion === 'v1') {
        const [menusResult, categoriesResult] = await Promise.allSettled([
          posV1Service.getMenus(restaurantId, params),
          posV1Service.getCategories(restaurantId),
        ]);

        const menus = menusResult.status === 'fulfilled' ? menusResult.value.data : [];
        const categories = categoriesResult.status === 'fulfilled' ? categoriesResult.value : [];

        return {
          categories: categories.map(c => this.transformV1Category(c, restaurantId)),
          items: menus.map(m => this.transformV1MenuItem(m)),
        };
      }

      if (posVersion === 'v2') {
        const restaurant = await posV2Service.getRestaurantById(restaurantId);

        if (!restaurant) {
          return { categories: [], items: [] };
        }

        return {
          categories: (restaurant.menu?.categories || []).map(c =>
            this.transformV2Category(c, restaurantId)
          ),
          items: (restaurant.menu?.items || []).map(m =>
            this.transformV2MenuItem(m, restaurantId)
          ),
        };
      }

      return { categories: [], items: [] };
    } catch (error) {
      logger.error(`[UnifiedRestaurant] Failed to get menu for ${restaurantId}:`, error);
      throw error;
    }
  }

  /**
   * Get single menu item by ID
   */
  async getMenuItemById(
    menuId: string,
    posVersion: PosVersion,
    restaurantId?: string
  ): Promise<UnifiedMenuItem | null> {
    try {
      if (posVersion === 'v1') {
        const menu = await posV1Service.getMenuById(menuId);
        return menu ? this.transformV1MenuItem(menu) : null;
      }

      // For V2, we need to fetch the restaurant and find the item
      if (posVersion === 'v2' && restaurantId) {
        const restaurant = await posV2Service.getRestaurantById(restaurantId);
        const item = restaurant?.menu?.items?.find(i => i._id === menuId);
        return item ? this.transformV2MenuItem(item, restaurantId) : null;
      }

      return null;
    } catch (error) {
      logger.error(`[UnifiedRestaurant] Failed to get menu item ${menuId}:`, error);
      throw error;
    }
  }

  // ==========================================================================
  // ORDER OPERATIONS
  // ==========================================================================

  /**
   * Create an order at a restaurant
   */
  async createOrder(payload: CreateOrderPayload): Promise<UnifiedOrder> {
    try {
      const { posVersion, restaurantId } = payload;

      if (posVersion === 'v1') {
        const v1Payload: CreateBillPayload = {
          storeId: restaurantId,
          tableId: payload.tableId,
          orders: payload.items.map(item => ({
            menuId: item.menuId,
            quantity: item.quantity,
            options: item.options,
            toppings: item.toppings,
            note: item.note,
          })),
          customerPhone: payload.customerPhone,
          consumerId: payload.consumerId,
          orderType: payload.orderType,
        };

        const bill = await posV1Service.createBill(v1Payload);
        return this.transformV1Order(bill);
      }

      if (posVersion === 'v2') {
        const v2Payload = {
          restaurantId,
          tableId: payload.tableId,
          orderType: payload.orderType || 'dine_in',
          items: payload.items.map(item => ({
            menuItemId: item.menuId,
            quantity: item.quantity,
            selectedOptions: item.options,
            selectedAddons: item.toppings,
            specialInstructions: item.note,
          })),
          customerId: payload.consumerId,
          customerPhone: payload.customerPhone,
          deliveryAddress: payload.deliveryAddress,
        };

        const order = await posV2Service.createOrder(v2Payload);
        return this.transformV2Order(order);
      }

      throw new Error(`Invalid POS version: ${posVersion}`);
    } catch (error) {
      logger.error('[UnifiedRestaurant] Failed to create order:', error);
      throw error;
    }
  }

  /**
   * Get order by ID
   */
  async getOrderById(
    orderId: string,
    posVersion: PosVersion
  ): Promise<UnifiedOrder | null> {
    try {
      if (posVersion === 'v1') {
        const bill = await posV1Service.getBillById(orderId);
        return bill ? this.transformV1Order(bill) : null;
      }

      if (posVersion === 'v2') {
        const order = await posV2Service.getOrderById(orderId);
        return order ? this.transformV2Order(order) : null;
      }

      return null;
    } catch (error) {
      logger.error(`[UnifiedRestaurant] Failed to get order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Get user's orders from both POS systems
   */
  async getUserOrders(params: {
    consumerId?: string;
    customerPhone?: string;
    skip?: number;
    limit?: number;
  }): Promise<{ data: UnifiedOrder[]; total: number }> {
    try {
      const { skip = 0, limit = 20 } = params;

      // Fetch from both POS systems
      const [v1Result, v2Result] = await Promise.allSettled([
        posV1Service.getUserOrders({
          consumerId: params.consumerId,
          customerPhone: params.customerPhone,
          skip: 0,
          limit: 100,
        }),
        // POS V2 may need different endpoint
        Promise.resolve({ data: [], total: 0 }),  // Placeholder
      ]);

      const v1Orders: UnifiedOrder[] = v1Result.status === 'fulfilled'
        ? v1Result.value.data.map(b => this.transformV1Order(b))
        : [];

      const v2Orders: UnifiedOrder[] = v2Result.status === 'fulfilled'
        ? v2Result.value.data.map(o => this.transformV2Order(o))
        : [];

      // Combine and sort by date (newest first)
      let allOrders = [...v1Orders, ...v2Orders].sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      const total = allOrders.length;
      const paginatedData = allOrders.slice(skip, skip + limit);

      return {
        data: paginatedData,
        total,
      };
    } catch (error) {
      logger.error('[UnifiedRestaurant] Failed to get user orders:', error);
      throw error;
    }
  }

  // ==========================================================================
  // TRANSFORM METHODS - POS V1
  // ==========================================================================

  private transformV1Restaurant(store: PosV1Store): UnifiedRestaurant {
    // Consumer API returns 'id', internal API returns '_id'
    const storeId = (store as any).id || store._id;
    return {
      _id: `v1_${storeId}`,
      posVersion: 'v1',
      posRestaurantId: storeId,

      name: store.name,
      nameEn: store.nameEn,
      phone: store.phone,
      email: store.email,

      address: store.address ? {
        village: store.address.village,
        district: store.address.district,
        province: store.address.province,
        latitude: store.address.latitude ? parseFloat(store.address.latitude) : undefined,
        longitude: store.address.longitude ? parseFloat(store.address.longitude) : undefined,
      } : undefined,

      image: store.image,
      coverImage: store.coverImage,

      isOpen: store.isOpen,
      isActive: store.isActive !== false,
      isReservable: store.isReservable,

      rating: store.rating,
      averageCost: store.averageCost,

      categories: store.categories,

      openTime: store.openTime,
      closeTime: store.closeTime,

      createdAt: store.createdAt,
      updatedAt: store.updatedAt,
    };
  }

  private transformV1MenuItem(menu: PosV1Menu): UnifiedMenuItem {
    return {
      _id: `v1_${menu._id}`,
      posVersion: 'v1',
      posMenuId: menu._id,
      restaurantId: menu.storeId,

      name: menu.name,
      nameEn: menu.nameEn,
      description: menu.description,
      price: menu.price,
      image: menu.image,

      categoryId: menu.categoryId,
      categoryName: menu.categoryName,

      isActive: menu.isActive !== false,
      isAvailable: menu.isAvailable !== false,

      options: menu.options,
      toppings: menu.toppings,

      createdAt: menu.createdAt,
      updatedAt: menu.updatedAt,
    };
  }

  private transformV1Category(category: any, restaurantId: string): UnifiedCategory {
    return {
      _id: `v1_${category._id}`,
      posVersion: 'v1',
      restaurantId,
      name: category.name,
      nameEn: category.nameEn,
      image: category.image,
      sort: category.sort,
    };
  }

  private transformV1Order(bill: PosV1Bill): UnifiedOrder {
    return {
      _id: `v1_${bill._id}`,
      posVersion: 'v1',
      posOrderId: bill._id,
      restaurantId: bill.storeId,
      restaurantName: '',  // Need to fetch separately if needed

      consumerId: bill.consumerId,
      customerPhone: bill.customerPhone,

      status: bill.status,
      orderType: 'dine_in',  // Default for V1

      items: (bill.orders || []).map(order => ({
        menuId: order.menuId,
        menuName: order.menuName,
        quantity: order.quantity,
        price: order.price,
        totalPrice: order.totalPrice,
        options: order.options,
        toppings: order.toppings,
        note: order.note,
      })),

      subtotal: bill.totalAmount,
      discount: bill.discountAmount,
      total: bill.finalAmount,

      paymentMethod: bill.paymentMethod,
      isPaid: bill.isPaid || false,

      tableId: bill.tableId,
      tableName: bill.tableName,

      createdAt: bill.createdAt,
      updatedAt: bill.updatedAt,
    };
  }

  // ==========================================================================
  // TRANSFORM METHODS - POS V2
  // ==========================================================================

  private transformV2Restaurant(restaurant: any): UnifiedRestaurant {
    // Consumer API returns 'id', internal API returns '_id'
    const restaurantId = restaurant.id || restaurant._id;
    return {
      _id: `v2_${restaurantId}`,
      posVersion: 'v2',
      posRestaurantId: restaurantId,

      name: restaurant.name,
      nameEn: restaurant.nameEn,
      description: restaurant.description,
      phone: restaurant.phone,
      email: restaurant.email,

      address: restaurant.address ? {
        street: restaurant.address.street,
        village: restaurant.address.village,
        district: restaurant.address.district,
        province: restaurant.address.province,
        country: restaurant.address.country,
        latitude: restaurant.address.location?.coordinates?.[1],
        longitude: restaurant.address.location?.coordinates?.[0],
      } : undefined,

      image: restaurant.logo || restaurant.image,
      coverImage: restaurant.coverImage,
      gallery: restaurant.galleryImages,

      isOpen: restaurant.isOpen,
      isActive: restaurant.isActive !== false,
      isReservable: restaurant.settings?.serviceOptions?.reservation?.enabled,

      rating: restaurant.rating?.average,
      reviewCount: restaurant.rating?.count,

      cuisine: restaurant.cuisine,
      tags: restaurant.tags,

      features: this.extractV2Features(restaurant),

      createdAt: restaurant.createdAt,
      updatedAt: restaurant.updatedAt,
    };
  }

  private transformV2MenuItem(item: any, restaurantId: string): UnifiedMenuItem {
    return {
      _id: `v2_${item._id}`,
      posVersion: 'v2',
      posMenuId: item._id,
      restaurantId,

      name: item.name,
      nameEn: item.nameEn,
      description: item.description,
      price: item.basePrice || item.price,
      image: item.image,

      categoryId: item.categoryId,
      categoryName: item.categoryName,

      isActive: item.isActive !== false,
      isAvailable: item.isAvailable !== false,

      options: item.options || item.variants,
      toppings: item.addons || item.toppings,

      calories: item.nutritionalInfo?.calories,
      allergens: item.allergens,
      dietaryTags: item.dietaryInfo,
      spiceLevel: item.spiceLevel,

      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private transformV2Category(category: any, restaurantId: string): UnifiedCategory {
    return {
      _id: `v2_${category._id}`,
      posVersion: 'v2',
      restaurantId,
      name: category.name,
      nameEn: category.nameEn,
      image: category.image,
      sort: category.sortOrder || category.sort,
    };
  }

  private transformV2Order(order: any): UnifiedOrder {
    return {
      _id: `v2_${order._id}`,
      posVersion: 'v2',
      posOrderId: order._id,
      restaurantId: order.restaurantId,
      restaurantName: order.restaurantName || '',

      consumerId: order.customerId,
      customerPhone: order.customerPhone,

      status: order.status,
      orderType: order.orderType || 'dine_in',

      items: (order.items || []).map((item: any) => ({
        menuId: item.menuItemId,
        menuName: item.name,
        quantity: item.quantity,
        price: item.unitPrice,
        totalPrice: item.totalPrice,
        options: item.selectedOptions,
        toppings: item.selectedAddons,
        note: item.specialInstructions,
      })),

      subtotal: order.subtotal,
      discount: order.discount,
      deliveryFee: order.deliveryFee,
      tax: order.tax,
      total: order.total,

      paymentMethod: order.paymentMethod,
      isPaid: order.paymentStatus === 'paid',

      tableId: order.tableId,
      tableName: order.tableName,

      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private extractV2Features(restaurant: any): string[] {
    const features: string[] = [];
    const settings = restaurant.settings;

    if (settings?.serviceOptions?.dineIn?.enabled) features.push('dine_in');
    if (settings?.serviceOptions?.pickup?.enabled) features.push('pickup');
    if (settings?.serviceOptions?.delivery?.enabled) features.push('delivery');
    if (settings?.serviceOptions?.reservation?.enabled) features.push('reservation');
    if (settings?.digitalServices?.qrMenu?.enabled) features.push('qr_menu');
    if (settings?.digitalServices?.mobileOrdering?.enabled) features.push('mobile_ordering');

    return features;
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Parse unified restaurant ID to get posVersion and posRestaurantId
   */
  parseRestaurantId(unifiedId: string): { posVersion: PosVersion; posRestaurantId: string } {
    if (unifiedId.startsWith('v1_')) {
      return { posVersion: 'v1', posRestaurantId: unifiedId.substring(3) };
    }
    if (unifiedId.startsWith('v2_')) {
      return { posVersion: 'v2', posRestaurantId: unifiedId.substring(3) };
    }
    // If no prefix, try to determine by format or default to v2
    return { posVersion: 'v2', posRestaurantId: unifiedId };
  }

  /**
   * Health check for both POS systems
   */
  async healthCheck(): Promise<{ v1: boolean; v2: boolean }> {
    const [v1Health, v2Health] = await Promise.allSettled([
      posV1Service.healthCheck(),
      Promise.resolve(true),  // V2 health check
    ]);

    return {
      v1: v1Health.status === 'fulfilled' && v1Health.value,
      v2: v2Health.status === 'fulfilled' && v2Health.value,
    };
  }
}

// Export singleton instance
export const unifiedRestaurantService = new UnifiedRestaurantService();
export default unifiedRestaurantService;

