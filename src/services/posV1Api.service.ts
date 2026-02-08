// @ts-nocheck
/**
 * POS V1 API Service
 * Integrates with the existing AppZap POS V1 system (appzap-app-api)
 * 
 * POS V1 Base URL: http://localhost:7070 (configurable via POS_V1_API_URL)
 * Documentation: appzap-app-api/api/docs/
 * 
 * This service provides methods to:
 * - Get stores/restaurants
 * - Get menus
 * - Create/get orders (bills)
 * - Get/export users (for migration)
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface PosV1Store {
  _id: string;
  name: string;
  nameEn?: string;
  phone?: string;
  email?: string;
  address?: {
    village?: string;
    district?: string;
    province?: string;
    latitude?: string;
    longitude?: string;
  };
  image?: string;
  coverImage?: string;
  isOpen?: boolean;
  isActive?: boolean;
  isReservable?: boolean;
  rating?: number;
  averageCost?: number;
  categories?: string[];
  openTime?: string;
  closeTime?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PosV1Menu {
  _id: string;
  name: string;
  nameEn?: string;
  price: number;
  description?: string;
  image?: string;
  categoryId?: string;
  categoryName?: string;
  storeId: string;
  isActive?: boolean;
  isAvailable?: boolean;
  options?: PosV1MenuOption[];
  toppings?: PosV1MenuTopping[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PosV1MenuOption {
  _id: string;
  name: string;
  price: number;
}

export interface PosV1MenuTopping {
  _id: string;
  name: string;
  price: number;
}

export interface PosV1Category {
  _id: string;
  name: string;
  nameEn?: string;
  image?: string;
  storeId: string;
  sort?: number;
}

export interface PosV1Table {
  _id: string;
  name: string;
  storeId: string;
  zoneId?: string;
  zoneName?: string;
  status?: 'available' | 'occupied' | 'reserved';
  capacity?: number;
}

export interface PosV1Bill {
  _id: string;
  billNo?: string;
  storeId: string;
  tableId?: string;
  tableName?: string;
  status: 'pending' | 'confirmed' | 'cooking' | 'served' | 'checkout' | 'cancelled';
  orders?: PosV1Order[];
  totalAmount: number;
  discountAmount?: number;
  finalAmount: number;
  paymentMethod?: string;
  isPaid?: boolean;
  customerPhone?: string;
  consumerId?: string;  // Reference to Consumer API user
  createdAt?: string;
  updatedAt?: string;
}

export interface PosV1Order {
  _id: string;
  menuId: string;
  menuName: string;
  quantity: number;
  price: number;
  totalPrice: number;
  options?: { name: string; price: number }[];
  toppings?: { name: string; price: number }[];
  note?: string;
  status?: string;
}

export interface PosV1User {
  _id: string;
  phone: string;
  fullName?: string;
  email?: string;
  image?: string;
  gender?: string;
  yearOfBirth?: string;
  role?: string;
  storeId?: string;
  address?: {
    village?: string;
    district?: string;
    province?: string;
    latitude?: string;
    longitude?: string;
  };
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string;
}

export interface CreateBillPayload {
  storeId: string;
  tableId?: string;
  orders: {
    menuId: string;
    quantity: number;
    options?: string[];
    toppings?: string[];
    note?: string;
  }[];
  customerPhone?: string;
  consumerId?: string;
  orderType?: 'dine_in' | 'takeaway' | 'delivery';
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

class PosV1ApiService {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = env.external.posV1ApiUrl || 'http://localhost:7070';
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        // POS V1 uses API key in header for some endpoints
        ...(env.external.posV1ApiKey && { 'x-api-key': env.external.posV1ApiKey }),
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`[POS V1] ${config.method?.toUpperCase()} ${config.url}`, {
          params: config.params,
        });
        return config;
      },
      (error) => {
        logger.error('[POS V1] Request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`[POS V1] Response: ${response.status}`, {
          url: response.config.url,
        });
        return response;
      },
      (error: AxiosError) => {
        logger.error('[POS V1] Response error:', {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }

  // ==========================================================================
  // STORE/RESTAURANT ENDPOINTS
  // ==========================================================================

  /**
   * Get list of stores
   * POS V1 Endpoint: GET /v3/stores
   */
  async getStores(params: {
    skip?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  } = {}): Promise<{ data: PosV1Store[]; total: number }> {
    try {
      const response = await this.client.get('/v3/stores', { params });
      
      // POS V1 returns different formats, handle both
      const stores = Array.isArray(response.data) 
        ? response.data 
        : response.data?.data || response.data?.stores || [];
      
      return {
        data: stores.map(this.transformStore),
        total: response.data?.total || response.data?.count || stores.length,
      };
    } catch (error) {
      logger.error('[POS V1] Failed to get stores:', error);
      throw error;
    }
  }

  /**
   * Get single store by ID
   * POS V1 Endpoint: GET /v3/store?_id=xxx
   */
  async getStoreById(storeId: string): Promise<PosV1Store | null> {
    try {
      const response = await this.client.get('/v3/store', {
        params: { _id: storeId },
      });
      
      const store = response.data?.data || response.data;
      return store ? this.transformStore(store) : null;
    } catch (error) {
      logger.error(`[POS V1] Failed to get store ${storeId}:`, error);
      throw error;
    }
  }

  /**
   * Get reservable stores (for booking feature)
   * POS V1 Endpoint: GET /v5/reservable-store
   */
  async getReservableStores(params: {
    skip?: number;
    limit?: number;
  } = {}): Promise<{ data: PosV1Store[]; total: number }> {
    try {
      const response = await this.client.get('/v5/reservable-store', { params });
      
      const stores = Array.isArray(response.data) 
        ? response.data 
        : response.data?.data || [];
      
      return {
        data: stores.map(this.transformStore),
        total: response.data?.total || stores.length,
      };
    } catch (error) {
      logger.error('[POS V1] Failed to get reservable stores:', error);
      throw error;
    }
  }

  // ==========================================================================
  // MENU ENDPOINTS
  // ==========================================================================

  /**
   * Get menus for a store
   * POS V1 Endpoint: GET /v3/menus?storeId=xxx
   */
  async getMenus(storeId: string, params: {
    skip?: number;
    limit?: number;
    categoryId?: string;
  } = {}): Promise<{ data: PosV1Menu[]; total: number }> {
    try {
      const response = await this.client.get('/v3/menus', {
        params: { storeId, ...params },
      });
      
      const menus = Array.isArray(response.data) 
        ? response.data 
        : response.data?.data || response.data?.menus || [];
      
      return {
        data: menus.map(this.transformMenu),
        total: response.data?.total || menus.length,
      };
    } catch (error) {
      logger.error(`[POS V1] Failed to get menus for store ${storeId}:`, error);
      throw error;
    }
  }

  /**
   * Get single menu item by ID
   * POS V1 Endpoint: GET /v3/menu/:id
   */
  async getMenuById(menuId: string): Promise<PosV1Menu | null> {
    try {
      const response = await this.client.get(`/v3/menu/${menuId}`);
      const menu = response.data?.data || response.data;
      return menu ? this.transformMenu(menu) : null;
    } catch (error) {
      logger.error(`[POS V1] Failed to get menu ${menuId}:`, error);
      throw error;
    }
  }

  /**
   * Get categories for a store
   * POS V1 Endpoint: GET /v3/categories?storeId=xxx
   */
  async getCategories(storeId: string): Promise<PosV1Category[]> {
    try {
      const response = await this.client.get('/v3/categories', {
        params: { storeId },
      });
      
      const categories = Array.isArray(response.data) 
        ? response.data 
        : response.data?.data || [];
      
      return categories;
    } catch (error) {
      logger.error(`[POS V1] Failed to get categories for store ${storeId}:`, error);
      throw error;
    }
  }

  // ==========================================================================
  // TABLE ENDPOINTS
  // ==========================================================================

  /**
   * Get tables for a store
   * POS V1 Endpoint: GET /v3/tables?storeId=xxx
   */
  async getTables(storeId: string): Promise<PosV1Table[]> {
    try {
      const response = await this.client.get('/v3/tables', {
        params: { storeId },
      });
      
      const tables = Array.isArray(response.data) 
        ? response.data 
        : response.data?.data || [];
      
      return tables;
    } catch (error) {
      logger.error(`[POS V1] Failed to get tables for store ${storeId}:`, error);
      throw error;
    }
  }

  // ==========================================================================
  // BILL/ORDER ENDPOINTS
  // ==========================================================================

  /**
   * Create a bill (order) - User placing order
   * POS V1 Endpoint: POST /v3/user/bill/create
   */
  async createBill(payload: CreateBillPayload): Promise<PosV1Bill> {
    try {
      const response = await this.client.post('/v3/user/bill/create', {
        storeId: payload.storeId,
        tableId: payload.tableId,
        orders: payload.orders,
        customerPhone: payload.customerPhone,
        consumerId: payload.consumerId,  // Link to Consumer API user
        orderType: payload.orderType || 'dine_in',
      });
      
      return response.data?.data || response.data;
    } catch (error) {
      logger.error('[POS V1] Failed to create bill:', error);
      throw error;
    }
  }

  /**
   * Get bill by ID
   * POS V1 Endpoint: GET /v3/bill/:id
   */
  async getBillById(billId: string): Promise<PosV1Bill | null> {
    try {
      const response = await this.client.get(`/v3/bill/${billId}`);
      return response.data?.data || response.data;
    } catch (error) {
      logger.error(`[POS V1] Failed to get bill ${billId}:`, error);
      throw error;
    }
  }

  /**
   * Get bills for a store
   * POS V1 Endpoint: GET /v3/bills?storeId=xxx
   */
  async getBills(params: {
    storeId?: string;
    status?: string;
    skip?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    customerPhone?: string;
    consumerId?: string;
  }): Promise<{ data: PosV1Bill[]; total: number }> {
    try {
      const response = await this.client.get('/v3/bills', { params });
      
      const bills = Array.isArray(response.data) 
        ? response.data 
        : response.data?.data || [];
      
      return {
        data: bills,
        total: response.data?.total || bills.length,
      };
    } catch (error) {
      logger.error('[POS V1] Failed to get bills:', error);
      throw error;
    }
  }

  /**
   * Get user's order history by phone
   * Consumer API needs to filter by consumerId or customerPhone
   */
  async getUserOrders(params: {
    customerPhone?: string;
    consumerId?: string;
    skip?: number;
    limit?: number;
  }): Promise<{ data: PosV1Bill[]; total: number }> {
    try {
      // POS V1 may not have direct user order lookup
      // This requires POS V1 team to add endpoint
      const response = await this.client.get('/v3/bills', {
        params: {
          customerPhone: params.customerPhone,
          consumerId: params.consumerId,
          skip: params.skip || 0,
          limit: params.limit || 20,
        },
      });
      
      const bills = Array.isArray(response.data) 
        ? response.data 
        : response.data?.data || [];
      
      return {
        data: bills,
        total: response.data?.total || bills.length,
      };
    } catch (error) {
      logger.error('[POS V1] Failed to get user orders:', error);
      throw error;
    }
  }

  // ==========================================================================
  // USER ENDPOINTS (For Migration)
  // ==========================================================================

  /**
   * Get all users (for migration)
   * POS V1 Endpoint: GET /v5/user-apps
   */
  async getUsers(params: {
    skip?: number;
    limit?: number;
    role?: string;
  } = {}): Promise<{ data: PosV1User[]; total: number }> {
    try {
      const response = await this.client.get('/v5/user-apps', {
        params: {
          ...params,
          role: params.role || 'APPZAP_USER',  // Only consumer users
        },
      });
      
      const users = Array.isArray(response.data) 
        ? response.data 
        : response.data?.data || [];
      
      return {
        data: users,
        total: response.data?.total || response.data?.count || users.length,
      };
    } catch (error) {
      logger.error('[POS V1] Failed to get users:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   * POS V1 Endpoint: GET /v6/user-app/:id
   */
  async getUserById(userId: string): Promise<PosV1User | null> {
    try {
      const response = await this.client.get(`/v6/user-app/${userId}`);
      return response.data || null;
    } catch (error) {
      logger.error(`[POS V1] Failed to get user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get user by phone number
   * POS V1 Endpoint: GET /v5/user-apps?phone=xxx
   */
  async getUserByPhone(phone: string): Promise<PosV1User | null> {
    try {
      const response = await this.client.get('/v5/user-apps', {
        params: { phone },
      });
      
      const users = Array.isArray(response.data) 
        ? response.data 
        : response.data?.data || [];
      
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      logger.error(`[POS V1] Failed to get user by phone ${phone}:`, error);
      throw error;
    }
  }

  /**
   * Export all users for migration (paginated)
   * This iterates through all users for full export
   */
  async exportAllUsers(batchSize = 100): Promise<PosV1User[]> {
    const allUsers: PosV1User[] = [];
    let skip = 0;
    let hasMore = true;

    logger.info('[POS V1] Starting user export...');

    while (hasMore) {
      const { data, total } = await this.getUsers({
        skip,
        limit: batchSize,
        role: 'APPZAP_USER',
      });

      allUsers.push(...data);
      skip += batchSize;
      hasMore = allUsers.length < total;

      logger.info(`[POS V1] Exported ${allUsers.length}/${total} users`);
    }

    logger.info(`[POS V1] User export complete. Total: ${allUsers.length}`);
    return allUsers;
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Transform POS V1 store to standardized format
   */
  private transformStore(store: any): PosV1Store {
    return {
      _id: store._id,
      name: store.name || store.storeName,
      nameEn: store.nameEn,
      phone: store.phone,
      email: store.email,
      address: store.address,
      image: store.image || store.logo,
      coverImage: store.coverImage,
      isOpen: store.isOpen,
      isActive: store.isActive !== false,
      isReservable: store.isReservable,
      rating: store.averageStars || store.rating,
      averageCost: store.averageCost,
      categories: store.categories,
      openTime: store.openTime,
      closeTime: store.closeTime,
      createdAt: store.createdAt,
      updatedAt: store.updatedAt,
    };
  }

  /**
   * Transform POS V1 menu to standardized format
   */
  private transformMenu(menu: any): PosV1Menu {
    return {
      _id: menu._id,
      name: menu.name || menu.menuName,
      nameEn: menu.nameEn,
      price: menu.price || 0,
      description: menu.description || menu.detail,
      image: menu.image,
      categoryId: menu.categoryId?._id || menu.categoryId,
      categoryName: menu.categoryId?.name || menu.categoryName,
      storeId: menu.storeId?._id || menu.storeId,
      isActive: menu.isActive !== false,
      isAvailable: menu.isAvailable !== false,
      options: menu.options || [],
      toppings: menu.toppings || [],
      createdAt: menu.createdAt,
      updatedAt: menu.updatedAt,
    };
  }

  /**
   * Health check for POS V1 API
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to get a simple endpoint
      await this.client.get('/v3/stores', { params: { limit: 1 } });
      return true;
    } catch (error) {
      logger.error('[POS V1] Health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const posV1Service = new PosV1ApiService();
export default posV1Service;

