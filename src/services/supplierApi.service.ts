import axios, { AxiosInstance } from 'axios';
import config from '../config/env';
import logger from '../utils/logger';
import { ExternalAPIError, SupplierSyncError } from '../utils/errors';

/**
 * Supplier API Service
 * Handles all communication with the AppZap Supplier API
 */

// Create Supplier API client
const supplierApiClient: AxiosInstance = axios.create({
  baseURL: config.supplierApi.url,
  headers: {
    'Content-Type': 'application/json',
    'X-Exchange-Key': config.supplierApi.exchangeKey,
  },
  timeout: 15000, // 15 seconds
});

// Response interceptor for error handling
supplierApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    logger.error('Supplier API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      data: error.response?.data,
      status: error.response?.status,
      message: error.message,
    });
    throw new SupplierSyncError(
      error.response?.data?.message || error.message,
      {
        url: error.config?.url,
        status: error.response?.status,
      }
    );
  }
);

// ============================================================================
// PRODUCT CATALOG
// ============================================================================

export interface ProductListParams {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  priceType?: 'retail' | 'wholesale';
}

export const getProducts = async (params: ProductListParams = {}) => {
  logger.info('Fetching products from Supplier API', { params });
  
  // Calculate skip from page and limit
  const page = params.page || 1;
  const limit = params.limit || 24;
  const skip = (page - 1) * limit;
  
  // Build query params based on Ingredients API documentation
  const queryParams: any = {
    createdBy: '6683700875395b0f0741b48d', // Default seller ID from docs
  };
  
  if (params.category) {
    queryParams.categoryId = params.category;
  }
  
  const response = await supplierApiClient.get(`/mobile/product/get/skip/${skip}/limit/${limit}`, {
    params: queryParams,
  });
  return response.data;
};

export const getProductById = async (productId: string, priceType: 'retail' | 'wholesale' = 'retail') => {
  logger.info('Fetching product details from Supplier API', { productId, priceType });
  // Note: Supplier API doesn't support priceType parameter - it returns all pricing info
  const response = await supplierApiClient.get(`/product/get/${productId}`);
  return response.data;
};

export const getProductCategories = async () => {
  logger.info('Fetching product categories from Supplier API');
  // Note: No /v6/ prefix - Supplier API doesn't use version prefixes
  const response = await supplierApiClient.get('/supplier-categories');
  return response.data;
};

// ============================================================================
// IDENTITY LINKING
// ============================================================================

/**
 * Link consumer user to supplier system (creates supplier_id)
 * This allows the user to access B2B pricing as a merchant
 */
export const linkConsumerToSupplier = async (params: {
  consumerUserId: string;
  consumerPhone: string;
  linkCode?: string; // Optional: merchant link code
  businessInfo?: {
    businessName?: string;
    businessType?: string;
    taxId?: string;
  };
}) => {
  logger.info('Linking consumer to Supplier system', {
    consumerUserId: params.consumerUserId,
    hasLinkCode: !!params.linkCode,
  });
  
  const response = await supplierApiClient.post('/api/identity/link', {
    consumerUserId: params.consumerUserId,
    consumerPhone: params.consumerPhone,
    linkCode: params.linkCode,
    businessInfo: params.businessInfo,
    source: 'consumer_app',
  });
  
  return response.data; // Should return { supplierId, merchantId, profileType }
};

/**
 * Verify merchant link code
 * Used when a consumer wants to link their account to an existing merchant
 */
export const verifyMerchantLinkCode = async (params: {
  linkCode: string;
  consumerUserId: string;
  consumerPhone: string;
}) => {
  logger.info('Verifying merchant link code', {
    linkCode: params.linkCode,
    consumerUserId: params.consumerUserId,
  });
  
  const response = await supplierApiClient.post('/api/identity/verify-link-code', {
    linkCode: params.linkCode,
    consumerUserId: params.consumerUserId,
    consumerPhone: params.consumerPhone,
  });
  
  return response.data; // Should return merchant info and supplierId
};

/**
 * Get supplier profile for a consumer user
 */
export const getSupplierProfile = async (supplierId: string) => {
  logger.info('Fetching supplier profile', { supplierId });
  const response = await supplierApiClient.get(`/api/identity/profile/${supplierId}`);
  return response.data;
};

// ============================================================================
// PRICING
// ============================================================================

/**
 * Get pricing for products based on user profile
 * Returns retail or wholesale prices
 */
export const getProductPricing = async (params: {
  productIds: string[];
  priceType: 'retail' | 'wholesale';
  supplierId?: string;
}) => {
  logger.info('Fetching product pricing', {
    productCount: params.productIds.length,
    priceType: params.priceType,
  });
  
  const response = await supplierApiClient.post('/api/products/pricing', {
    productIds: params.productIds,
    priceType: params.priceType,
    supplierId: params.supplierId,
  });
  
  return response.data;
};

/**
 * Calculate cart total with appropriate pricing
 */
export const calculateCartTotal = async (params: {
  items: Array<{ productId: string; quantity: number }>;
  priceType: 'retail' | 'wholesale';
  supplierId?: string;
  deliveryAddress?: {
    province: string;
    city: string;
    district: string;
  };
}) => {
  logger.info('Calculating cart total', {
    itemCount: params.items.length,
    priceType: params.priceType,
  });
  
  const response = await supplierApiClient.post('/api/cart/calculate', {
    items: params.items,
    priceType: params.priceType,
    supplierId: params.supplierId,
    deliveryAddress: params.deliveryAddress,
  });
  
  return response.data; // Returns { subtotal, deliveryFee, total, items }
};

// ============================================================================
// ORDER MANAGEMENT
// ============================================================================

/**
 * Create order in Supplier system
 */
export const createSupplierOrder = async (orderPayload: {
  consumerUserId: string;
  consumerOrderId: string;
  supplierId?: string;
  priceType: 'retail' | 'wholesale';
  items: Array<{
    productId: string;
    sku: string;
    quantity: number;
    unitPrice: number;
  }>;
  deliveryAddress: {
    recipientName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    district: string;
    city: string;
    province: string;
    latitude?: number;
    longitude?: number;
  };
  deliveryMethod: string;
  deliveryDate?: Date;
  paymentMethod: string;
  notes?: string;
}) => {
  logger.info('Creating order in Supplier API', {
    consumerOrderId: orderPayload.consumerOrderId,
    itemCount: orderPayload.items.length,
  });
  
  const response = await supplierApiClient.post('/api/orders/create', {
    ...orderPayload,
    source: 'consumer_app',
    createdAt: new Date(),
  });
  
  return response.data; // Should return { supplierOrderId, status, estimatedDelivery }
};

/**
 * Update order status in Supplier system
 */
export const updateSupplierOrderStatus = async (
  supplierOrderId: string,
  status: string,
  metadata?: any
) => {
  logger.info('Updating order status in Supplier API', {
    supplierOrderId,
    status,
  });
  
  const response = await supplierApiClient.put(
    `/api/orders/${supplierOrderId}/status`,
    { status, metadata }
  );
  
  return response.data;
};

/**
 * Get order details from Supplier system
 */
export const getSupplierOrder = async (supplierOrderId: string) => {
  logger.info('Fetching order from Supplier API', { supplierOrderId });
  const response = await supplierApiClient.get(`/api/orders/${supplierOrderId}`);
  return response.data;
};

/**
 * Cancel order in Supplier system
 */
export const cancelSupplierOrder = async (
  supplierOrderId: string,
  reason: string
) => {
  logger.info('Cancelling order in Supplier API', {
    supplierOrderId,
    reason,
  });
  
  const response = await supplierApiClient.post(
    `/api/orders/${supplierOrderId}/cancel`,
    { reason }
  );
  
  return response.data;
};

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

/**
 * Create subscription in Supplier system
 * This allows the supplier to prepare for recurring orders
 */
export const createSupplierSubscription = async (subscriptionPayload: {
  consumerUserId: string;
  consumerSubscriptionId: string;
  supplierId?: string;
  priceType: 'retail' | 'wholesale';
  items: Array<{
    productId: string;
    sku: string;
    quantity: number;
  }>;
  frequency: string;
  deliveryAddress: any;
  startDate: Date;
  endDate?: Date;
}) => {
  logger.info('Creating subscription in Supplier API', {
    consumerSubscriptionId: subscriptionPayload.consumerSubscriptionId,
  });
  
  const response = await supplierApiClient.post('/api/subscriptions/create', {
    ...subscriptionPayload,
    source: 'consumer_app',
  });
  
  return response.data; // Should return { supplierSubscriptionId }
};

/**
 * Update subscription in Supplier system
 */
export const updateSupplierSubscription = async (
  supplierSubscriptionId: string,
  updates: any
) => {
  logger.info('Updating subscription in Supplier API', {
    supplierSubscriptionId,
  });
  
  const response = await supplierApiClient.put(
    `/api/subscriptions/${supplierSubscriptionId}`,
    updates
  );
  
  return response.data;
};

/**
 * Cancel subscription in Supplier system
 */
export const cancelSupplierSubscription = async (
  supplierSubscriptionId: string,
  reason: string
) => {
  logger.info('Cancelling subscription in Supplier API', {
    supplierSubscriptionId,
    reason,
  });
  
  const response = await supplierApiClient.post(
    `/api/subscriptions/${supplierSubscriptionId}/cancel`,
    { reason }
  );
  
  return response.data;
};

// ============================================================================
// DELIVERY
// ============================================================================

/**
 * Calculate delivery fee
 */
export const calculateDeliveryFee = async (params: {
  province: string;
  city: string;
  district: string;
  deliveryMethod: string;
  orderTotal: number;
}) => {
  logger.info('Calculating delivery fee', {
    province: params.province,
    city: params.city,
    deliveryMethod: params.deliveryMethod,
  });
  
  const response = await supplierApiClient.post('/api/delivery/calculate-fee', params);
  return response.data; // Should return { deliveryFee, estimatedDays }
};

/**
 * Get available delivery time slots
 */
export const getDeliveryTimeSlots = async (params: {
  province: string;
  city: string;
  date: string; // YYYY-MM-DD
}) => {
  logger.info('Fetching delivery time slots', {
    province: params.province,
    city: params.city,
    date: params.date,
  });
  
  const response = await supplierApiClient.get('/api/delivery/time-slots', {
    params,
  });
  
  return response.data;
};

// ============================================================================
// EXPORT
// ============================================================================

export default {
  // Products
  getProducts,
  getProductById,
  getProductCategories,
  
  // Identity Linking
  linkConsumerToSupplier,
  verifyMerchantLinkCode,
  getSupplierProfile,
  
  // Pricing
  getProductPricing,
  calculateCartTotal,
  
  // Orders
  createSupplierOrder,
  updateSupplierOrderStatus,
  getSupplierOrder,
  cancelSupplierOrder,
  
  // Subscriptions
  createSupplierSubscription,
  updateSupplierSubscription,
  cancelSupplierSubscription,
  
  // Delivery
  calculateDeliveryFee,
  getDeliveryTimeSlots,
};


