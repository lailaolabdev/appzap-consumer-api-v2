// @ts-nocheck
import axios, { AxiosInstance, AxiosError } from 'axios';
import config from '../config/env';
import logger from '../utils/logger';
import { POSSyncError } from '../utils/errors';
import { retryWithBackoff } from '../utils/helpers';
import { redisHelpers } from '../config/redis';

/**
 * POS V2 API Service
 * Handles all communication with POS V2 API for restaurants, menus, and orders
 */

// Check if API key is properly configured
const hasApiKey = !!(config.posV2Api.apiKey && config.posV2Api.apiKey.startsWith('appzap_pos_'));

// Log configuration status on initialization
logger.info('[POS V2] Initializing service:', {
  baseUrl: config.posV2Api.url,
  hasApiKey,
});

if (!hasApiKey) {
  logger.warn('[POS V2] ⚠️  No API key configured! Consumer API routes on POS V2 will require authentication.');
  logger.warn('[POS V2] To generate a key, use: POST /api/v1/api-keys with preset: consumer_app');
}

// Create axios instance
const posV2Client: AxiosInstance = axios.create({
  baseURL: config.posV2Api.url,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    ...(hasApiKey && { 'X-API-Key': config.posV2Api.apiKey }),
  },
});

// Request interceptor for logging
posV2Client.interceptors.request.use(
  (reqConfig) => {
    logger.debug('[POS V2] API request', {
      method: reqConfig.method?.toUpperCase(),
      url: reqConfig.url,
      hasApiKey,
    });
    return reqConfig;
  },
  (error) => {
    logger.error('[POS V2] API request error', { error: error.message });
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
posV2Client.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Provide better error messages for common issues
    if (error.response?.status === 401) {
      logger.error('[POS V2] Authentication failed. Check if POS_V2_API_KEY is configured correctly.');
    }
    logger.error('[POS V2] API response error', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message,
    });
    throw new POSSyncError(
      error.response?.data?.message || error.message,
      { status: error.response?.status }
    );
  }
);

// ============================================================================
// RESTAURANTS
// ============================================================================

export interface POSRestaurant {
  _id: string;
  name: string;
  nameEn?: string;
  description?: string;
  coverImage?: string;
  categoryId?: string;
  location?: {
    address: string;
    latitude: number;
    longitude: number;
  };
  phone?: string;
  isActive: boolean;
  operatingHours?: any;
}

/**
 * Get all restaurants
 */
export const getRestaurants = async (params?: {
  page?: number;
  limit?: number;
}): Promise<{ data: POSRestaurant[]; total: number }> => {
  try {
    const cacheKey = `pos:restaurants:page:${params?.page || 1}:limit:${params?.limit || 20}`;
    
    // Try cache first
    const cached = await redisHelpers.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const response = await posV2Client.get('/api/v1/restaurants', { params });
    
    // Handle nested response structure: response.data.data.results
    // Response format: { success: true, data: { results: [...], totalCount: N }, message: "..." }
    const responseData = response.data.data || response.data;
    const result = {
      data: responseData.results || responseData.data || responseData,
      total: responseData.totalCount || responseData.total || (Array.isArray(responseData) ? responseData.length : 0),
    };

    // Cache for 5 minutes
    await redisHelpers.setWithTTL(cacheKey, JSON.stringify(result), 300);

    return result;
  } catch (error) {
    logger.error('Failed to get restaurants from POS V2', { error });
    throw error;
  }
};

/**
 * Get restaurant by ID with menu
 */
export const getRestaurantById = async (
  restaurantId: string
): Promise<POSRestaurant & { menu?: any }> => {
  try {
    const cacheKey = `pos:restaurant:${restaurantId}`;
    
    // Try cache first
    const cached = await redisHelpers.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const response = await posV2Client.get(`/api/v1/restaurants/${restaurantId}`);
    const restaurant = response.data.data || response.data;

    // Get menu data using the correct endpoints
    // Note: There is NO /api/menu/:restaurantId endpoint - use menu-categories + menu-items instead
    try {
      // Fetch menu categories
      const categoriesResponse = await posV2Client.get('/api/v1/menu-categories', {
        params: { restaurantId, isActive: true },
      });
      const categories = categoriesResponse.data.data || categoriesResponse.data || [];

      // Fetch menu items
      const itemsResponse = await posV2Client.get('/api/v1/menu-items', {
        params: { restaurantId, isActive: true },
      });
      const items = itemsResponse.data.data || itemsResponse.data || [];

      // Combine into menu structure
      restaurant.menu = {
        categories,
        items,
      };
      
      logger.debug('Menu fetched successfully', { 
        restaurantId, 
        categoriesCount: categories.length, 
        itemsCount: items.length 
      });
    } catch (menuError) {
      logger.warn('Failed to get menu for restaurant', { restaurantId, error: menuError });
      restaurant.menu = null;
    }

    // Cache for 5 minutes
    await redisHelpers.setWithTTL(cacheKey, JSON.stringify(restaurant), 300);

    return restaurant;
  } catch (error) {
    logger.error('Failed to get restaurant from POS V2', { restaurantId, error });
    throw error;
  }
};

// ============================================================================
// RESERVATIONS / BOOKINGS
// ============================================================================

/**
 * Get reservation/booking by ID
 */
export const getReservationById = async (reservationId: string): Promise<any> => {
  try {
    logger.info('Fetching reservation from POS V2', { reservationId });
    
    const response = await posV2Client.get(`/api/v1/table-reservations/${reservationId}`);
    
    return response.data.data || response.data;
  } catch (error) {
    logger.error('Failed to get reservation from POS V2', { reservationId, error });
    throw error;
  }
};

/**
 * Get user's reservations/bookings
 */
export const getUserReservations = async (params: {
  customerId: string;
  status?: string;
  limit?: number;
  skip?: number;
}): Promise<any> => {
  try {
    logger.info('Fetching user reservations from POS V2', { customerId: params.customerId });
    
    // Calculate page number from skip/limit (API uses page-based pagination)
    const page = params.skip ? Math.floor(params.skip / (params.limit || 20)) + 1 : 1;
    
    // Note: POS V2 API doesn't support filtering by customerId directly
    // We get all reservations and will need to filter client-side if needed
    const response = await posV2Client.get('/api/v1/table-reservations', {
      params: {
        status: params.status,
        limit: params.limit || 20,
        page: page,
      },
    });
    
    // Handle nested response structure
    const responseData = response.data.data || response.data;
    const reservations = Array.isArray(responseData) ? responseData : responseData.results || [];
    
    // Filter by customerId if we have reservations with customer info
    // This is a workaround since the API doesn't support customerId filtering
    const filteredReservations = reservations.filter((reservation: any) => {
      return reservation.customerId === params.customerId || 
             reservation.customerPhone === params.customerId ||
             reservation.userId === params.customerId;
    });
    
    return {
      data: filteredReservations,
      total: filteredReservations.length,
    };
  } catch (error) {
    logger.error('Failed to get user reservations from POS V2', { params, error });
    throw error;
  }
};


// ============================================================================
// ORDERS
// ============================================================================

export interface CreatePOSOrderInput {
  restaurantId: string;
  tableId?: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
    modifiers?: Array<{
      id: string;
      name: string;
      price: number;
    }>;
    specialInstructions?: string;
  }>;
  orderSource: 'consumer_app' | 'mobile_app';
  externalOrderId: string;
  customerInfo?: {
    name?: string;
    phone?: string;
  };
}

export interface POSOrderResponse {
  orderId: string;
  orderNumber: string;
  status: string;
  createdAt: string;
}

/**
 * Create order in POS V2
 */
export const createOrder = async (
  orderData: CreatePOSOrderInput
): Promise<POSOrderResponse> => {
  try {
    logger.info('Creating order in POS V2', {
      restaurantId: orderData.restaurantId,
      externalOrderId: orderData.externalOrderId,
    });

    const response = await retryWithBackoff(
      async () => {
        return await posV2Client.post('/api/orders/create', orderData);
      },
      3,
      1000
    );

    logger.info('Order created successfully in POS V2', {
      posOrderId: response.data.orderId,
      externalOrderId: orderData.externalOrderId,
    });

    return response.data.data || response.data;
  } catch (error) {
    logger.error('Failed to create order in POS V2', {
      externalOrderId: orderData.externalOrderId,
      error,
    });
    throw error;
  }
};

/**
 * Update order status in POS V2
 */
export const updateOrderStatus = async (
  posOrderId: string,
  status: string
): Promise<void> => {
  try {
    await posV2Client.put(`/api/orders/${posOrderId}/status`, { status });
    logger.info('Order status updated in POS V2', { posOrderId, status });
  } catch (error) {
    logger.error('Failed to update order status in POS V2', { posOrderId, error });
    throw error;
  }
};

// ============================================================================
// RESERVATIONS/BOOKINGS
// ============================================================================

export interface CheckAvailabilityInput {
  restaurantId: string;
  date: string;
  guests: number;
}

export interface AvailabilitySlot {
  time: string;
  available: boolean;
  tablesAvailable: number;
}

/**
 * Check table availability
 */
export const checkAvailability = async (
  input: CheckAvailabilityInput
): Promise<AvailabilitySlot[]> => {
  try {
    const response = await posV2Client.get(`/api/tables/availability`, {
      params: {
        restaurantId: input.restaurantId,
        date: input.date,
        guests: input.guests,
      },
    });

    return response.data.data || response.data;
  } catch (error) {
    logger.error('Failed to check availability', { input, error });
    throw error;
  }
};

export interface CreateReservationInput {
  restaurantId: string;
  date: string;
  time: string;
  guests: number;
  customerInfo: {
    name: string;
    phone: string;
  };
  specialRequests?: string;
  externalBookingId: string;
}

export interface POSReservationResponse {
  reservationId: string;
  status: string;
  createdAt: string;
}

/**
 * Create reservation in POS V2
 */
export const createReservation = async (
  reservationData: CreateReservationInput
): Promise<POSReservationResponse> => {
  try {
    const response = await posV2Client.post('/api/reservations', reservationData);
    return response.data.data || response.data;
  } catch (error) {
    logger.error('Failed to create reservation in POS V2', { reservationData, error });
    throw error;
  }
};

/**
 * Cancel reservation in POS V2
 */
export const cancelReservation = async (posReservationId: string): Promise<void> => {
  try {
    await posV2Client.delete(`/api/reservations/${posReservationId}`);
    logger.info('Reservation cancelled in POS V2', { posReservationId });
  } catch (error) {
    logger.error('Failed to cancel reservation in POS V2', { posReservationId, error });
    throw error;
  }
};

// ============================================================================
// RESTAURANT LINKING (Merchant Verification)
// ============================================================================

export interface VerifyLinkCodeInput {
  code: string;
  consumerUserId: string;
  consumerPhone: string;
}

export interface VerifyLinkCodeResponse {
  valid: boolean;
  restaurant: {
    id: string;
    name: string;
    address: string;
  };
  role: 'owner' | 'manager';
  permissions: string[];
}

/**
 * Verify restaurant link code
 */
export const verifyRestaurantLinkCode = async (
  input: VerifyLinkCodeInput
): Promise<VerifyLinkCodeResponse> => {
  try {
    const response = await posV2Client.post('/api/restaurant-link-codes/verify', input);
    return response.data.data || response.data;
  } catch (error) {
    logger.error('Failed to verify restaurant link code', { code: input.code, error });
    throw error;
  }
};

// ============================================================================
// CONSUMER API ENDPOINTS (New endpoints with API key auth)
// ============================================================================

/**
 * Get restaurants via Consumer API
 * POS V2 Endpoint: GET /api/v1/consumer/restaurants
 */
export const getRestaurantsViaConsumerApi = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  cuisineType?: string;
}): Promise<{ data: POSRestaurant[]; total: number }> => {
  try {
    const response = await posV2Client.get('/api/v1/consumer/restaurants', { params });
    return {
      data: response.data?.data || [],
      total: response.data?.pagination?.total || 0,
    };
  } catch (error) {
    logger.error('Consumer API: Failed to get restaurants', { error });
    throw error;
  }
};

/**
 * Get restaurant details via Consumer API
 * POS V2 Endpoint: GET /api/v1/consumer/restaurants/:id
 */
export const getRestaurantViaConsumerApi = async (restaurantId: string): Promise<POSRestaurant | null> => {
  try {
    const response = await posV2Client.get(`/api/v1/consumer/restaurants/${restaurantId}`);
    return response.data?.data || null;
  } catch (error) {
    logger.error('Consumer API: Failed to get restaurant', { restaurantId, error });
    throw error;
  }
};

/**
 * Get menu via Consumer API
 * POS V2 Endpoint: GET /api/v1/consumer/restaurants/:id/menu
 */
export const getMenuViaConsumerApi = async (restaurantId: string, branchId?: string): Promise<any> => {
  try {
    const response = await posV2Client.get(`/api/v1/consumer/restaurants/${restaurantId}/menu`, {
      params: branchId ? { branchId } : undefined,
    });
    return response.data?.data || null;
  } catch (error) {
    logger.error('Consumer API: Failed to get menu', { restaurantId, error });
    throw error;
  }
};

/**
 * Get table availability via Consumer API
 * POS V2 Endpoint: GET /api/v1/consumer/tables/availability/:restaurantId
 */
export const getTableAvailabilityViaConsumerApi = async (
  restaurantId: string,
  params: {
    date: string;
    time?: string;
    guests: number;
    duration?: number;
    branchId?: string;
  }
): Promise<any> => {
  try {
    const response = await posV2Client.get(`/api/v1/consumer/tables/availability/${restaurantId}`, { params });
    return response.data?.data || null;
  } catch (error) {
    logger.error('Consumer API: Failed to get table availability', { restaurantId, error });
    throw error;
  }
};

/**
 * Create order via Consumer API
 * POS V2 Endpoint: POST /api/v1/consumer/orders
 */
export const createOrderViaConsumerApi = async (orderData: {
  restaurantId: string;
  branchId?: string;
  tableId?: string;
  items: any[];
  customerInfo?: { name?: string; phone?: string; email?: string };
  orderType?: string;
  notes?: string;
  scheduledTime?: string;
  externalOrderId?: string;
}): Promise<any> => {
  try {
    const response = await posV2Client.post('/api/v1/consumer/orders', orderData);
    return response.data?.data || null;
  } catch (error) {
    logger.error('Consumer API: Failed to create order', { error });
    throw error;
  }
};

/**
 * Create reservation via Consumer API
 * POS V2 Endpoint: POST /api/v1/consumer/reservations
 */
export const createReservationViaConsumerApi = async (reservationData: {
  restaurantId: string;
  branchId?: string;
  tableId?: string;
  date: string;
  time: string;
  guests: number;
  customerInfo?: { name?: string; phone?: string; email?: string };
  notes?: string;
  externalBookingId?: string;
}): Promise<any> => {
  try {
    const response = await posV2Client.post('/api/v1/consumer/reservations', reservationData);
    return response.data?.data || null;
  } catch (error) {
    logger.error('Consumer API: Failed to create reservation', { error });
    throw error;
  }
};

/**
 * Create bill split via Consumer API
 * POS V2 Endpoint: POST /api/v1/consumer/orders/:orderId/split
 */
export const createBillSplitViaConsumerApi = async (
  orderId: string,
  splitData: {
    splitType: 'equal' | 'by_items' | 'by_amount' | 'percentage';
    participants: { name: string; phone?: string; email?: string }[];
    itemAssignments?: any[];
    amounts?: number[];
    percentages?: number[];
    externalSplitId?: string;
  }
): Promise<any> => {
  try {
    const response = await posV2Client.post(`/api/v1/consumer/orders/${orderId}/split`, splitData);
    return response.data?.data || null;
  } catch (error) {
    logger.error('Consumer API: Failed to create bill split', { orderId, error });
    throw error;
  }
};

/**
 * Get bill split via Consumer API
 * POS V2 Endpoint: GET /api/v1/consumer/split/:sessionCode
 */
export const getBillSplitViaConsumerApi = async (sessionCode: string): Promise<any> => {
  try {
    const response = await posV2Client.get(`/api/v1/consumer/split/${sessionCode}`);
    return response.data?.data || null;
  } catch (error) {
    logger.error('Consumer API: Failed to get bill split', { sessionCode, error });
    throw error;
  }
};

/**
 * Join bill split via Consumer API
 * POS V2 Endpoint: POST /api/v1/consumer/split/:sessionCode/join
 */
export const joinBillSplitViaConsumerApi = async (
  sessionCode: string,
  participant: { name: string; phone?: string; email?: string; consumerId?: string }
): Promise<any> => {
  try {
    const response = await posV2Client.post(`/api/v1/consumer/split/${sessionCode}/join`, participant);
    return response.data?.data || null;
  } catch (error) {
    logger.error('Consumer API: Failed to join bill split', { sessionCode, error });
    throw error;
  }
};

// ============================================================================
// CONFIGURATION CHECK
// ============================================================================

/**
 * Check if POS V2 service is properly configured with API key
 */
const isConfigured = (): boolean => hasApiKey;

// ============================================================================
// EXPORT
// ============================================================================

export default {
  isConfigured,
  getRestaurants,
  getRestaurantById,
  createOrder,
  updateOrderStatus,
  checkAvailability,
  createReservation,
  cancelReservation,
  verifyRestaurantLinkCode,
  // Consumer API endpoints
  getRestaurantsViaConsumerApi,
  getRestaurantViaConsumerApi,
  getMenuViaConsumerApi,
  getTableAvailabilityViaConsumerApi,
  createOrderViaConsumerApi,
  createReservationViaConsumerApi,
  createBillSplitViaConsumerApi,
  getBillSplitViaConsumerApi,
  joinBillSplitViaConsumerApi,
};


