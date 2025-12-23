import { Request, Response } from 'express';
import MarketOrder from '../models/MarketOrder';
import * as supplierApi from '../services/supplierApi.service';
import * as identityLinking from '../services/identityLinking.service';
import * as loyaltyService from '../services/loyalty.service';
import { addSupplierSyncJob } from '../config/queue';
import { codeGenerators } from '../utils/helpers';
import logger from '../utils/logger';
import { ValidationError, NotFoundError } from '../utils/errors';

// ============================================================================
// PRODUCT CATALOG
// ============================================================================

/**
 * Get Products
 * GET /api/v1/market/products
 */
export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      search,
    } = req.query;

    // Get user profile context for pricing
    let priceType: 'retail' | 'wholesale' = 'retail';
    if (req.user) {
      const profileContext = await identityLinking.getUserProfileContext(req.user._id.toString());
      priceType = profileContext.priceType;
    }

    // Get products from Supplier API
    const products = await supplierApi.getProducts({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      category: category as string,
      search: search as string,
      priceType,
    });

    res.json({
      data: products.data,
      pagination: products.pagination,
      priceType,
      profileType: req.user?.activeProfile || 'personal',
    });
  } catch (error: any) {
    logger.error('Failed to get products', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_PRODUCTS_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Get Product Details
 * GET /api/v1/market/products/:productId
 */
export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;

    // Get user profile context for pricing
    let priceType: 'retail' | 'wholesale' = 'retail';
    if (req.user) {
      const profileContext = await identityLinking.getUserProfileContext(req.user._id.toString());
      priceType = profileContext.priceType;
    }

    const product = await supplierApi.getProductById(productId, priceType);

    if (!product) {
      throw new NotFoundError('Product', productId);
    }

    res.json({
      ...product,
      priceType,
      profileType: req.user?.activeProfile || 'personal',
    });
  } catch (error: any) {
    logger.error('Failed to get product details', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_PRODUCT_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Get Product Categories
 * GET /api/v1/market/categories
 */
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await supplierApi.getProductCategories();
    res.json(categories);
  } catch (error: any) {
    logger.error('Failed to get categories', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_CATEGORIES_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

// ============================================================================
// CART & CHECKOUT
// ============================================================================

/**
 * Calculate Cart Total
 * POST /api/v1/market/cart/calculate
 */
export const calculateCart = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { items, deliveryAddressId } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ValidationError('Items array is required');
    }

    // Get user profile context
    const profileContext = await identityLinking.getUserProfileContext(req.user._id.toString());

    // Get delivery address if provided
    let deliveryAddress;
    if (deliveryAddressId) {
      const DeliveryAddress = (await import('../models/DeliveryAddress')).default;
      const address = await DeliveryAddress.findById(deliveryAddressId);
      if (address) {
        deliveryAddress = {
          province: address.province,
          city: address.city,
          district: address.district,
        };
      }
    }

    // Calculate cart total
    const cartCalculation = await supplierApi.calculateCartTotal({
      items: items.map((item: any) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      priceType: profileContext.priceType,
      supplierId: profileContext.supplierId,
      deliveryAddress,
    });

    res.json({
      ...cartCalculation,
      priceType: profileContext.priceType,
      profileType: profileContext.profileType,
    });
  } catch (error: any) {
    logger.error('Failed to calculate cart', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'CALCULATE_CART_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Checkout Market Cart
 * POST /api/v1/market/checkout
 */
export const checkout = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const {
      items,
      deliveryAddressId,
      deliveryMethod,
      deliveryDate,
      deliveryTimeSlot,
      paymentMethod,
      pointsToRedeem,
      notes,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ValidationError('Items array is required');
    }

    if (!deliveryAddressId) {
      throw new ValidationError('Delivery address is required');
    }

    if (!paymentMethod) {
      throw new ValidationError('Payment method is required');
    }

    // Get delivery address
    const DeliveryAddress = (await import('../models/DeliveryAddress')).default;
    const deliveryAddress = await DeliveryAddress.findById(deliveryAddressId);
    if (!deliveryAddress) {
      throw new NotFoundError('DeliveryAddress', deliveryAddressId);
    }

    // Get user profile context
    const profileContext = await identityLinking.getUserProfileContext(req.user._id.toString());

    // Calculate cart total
    const cartCalculation = await supplierApi.calculateCartTotal({
      items: items.map((item: any) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      priceType: profileContext.priceType,
      supplierId: profileContext.supplierId,
      deliveryAddress: {
        province: deliveryAddress.province,
        city: deliveryAddress.city,
        district: deliveryAddress.district,
      },
    });

    // Handle loyalty points redemption (only for B2C)
    let loyaltyDiscount = 0;
    if (pointsToRedeem && pointsToRedeem > 0 && profileContext.profileType === 'personal') {
      const redemption = await loyaltyService.redeemPoints(
        req.user._id.toString(),
        pointsToRedeem,
        'pending',
        cartCalculation.total
      );
      loyaltyDiscount = redemption.discountAmount;
    }

    const total = cartCalculation.total - loyaltyDiscount;

    // Create market order
    const order = await MarketOrder.create({
      orderCode: codeGenerators.marketOrderCode(),
      userId: req.user._id,
      profileType: profileContext.profileType,
      merchantProfileId: profileContext.merchantProfile?.merchantId,
      orderType: 'one_time',
      items: cartCalculation.items.map((item: any) => ({
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        priceType: profileContext.priceType,
        unitPrice: item.unitPrice,
        itemTotal: item.itemTotal,
      })),
      subtotal: cartCalculation.subtotal,
      discount: loyaltyDiscount,
      discountType: loyaltyDiscount > 0 ? 'loyalty' : undefined,
      deliveryFee: cartCalculation.deliveryFee,
      total,
      pointsRedeemed: pointsToRedeem || 0,
      deliveryInfo: {
        address: {
          recipientName: deliveryAddress.recipientName,
          phone: deliveryAddress.phone,
          addressLine1: deliveryAddress.addressLine1,
          addressLine2: deliveryAddress.addressLine2,
          district: deliveryAddress.district,
          city: deliveryAddress.city,
          province: deliveryAddress.province,
          postalCode: deliveryAddress.postalCode,
          latitude: deliveryAddress.latitude,
          longitude: deliveryAddress.longitude,
          notes: deliveryAddress.notes,
        },
        deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
        deliveryTimeSlot,
        deliveryMethod: deliveryMethod || 'standard',
        deliveryFee: cartCalculation.deliveryFee,
      },
      paymentMethod,
      paymentStatus: 'pending',
      status: 'pending',
      supplierSyncStatus: 'pending',
      source: 'app',
    });

    logger.info('Market order created', {
      orderId: order._id.toString(),
      orderCode: order.orderCode,
      userId: req.user._id.toString(),
      total,
      priceType: profileContext.priceType,
    });

    // Sync to supplier (async)
    await addSupplierSyncJob(order._id.toString(), {
      consumerUserId: req.user._id.toString(),
      consumerOrderId: order._id.toString(),
      supplierId: profileContext.supplierId,
      priceType: profileContext.priceType,
      items: order.items,
      deliveryAddress: order.deliveryInfo.address,
      deliveryMethod: order.deliveryInfo.deliveryMethod,
      deliveryDate: order.deliveryInfo.deliveryDate,
      paymentMethod: order.paymentMethod,
      notes,
    });

    res.json({
      orderId: order._id,
      orderCode: order.orderCode,
      totalAmount: total,
      breakdown: {
        subtotal: cartCalculation.subtotal,
        discount: loyaltyDiscount,
        deliveryFee: cartCalculation.deliveryFee,
      },
      estimatedDelivery: cartCalculation.estimatedDelivery,
      priceType: profileContext.priceType,
    });
  } catch (error: any) {
    logger.error('Checkout failed', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'CHECKOUT_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

// ============================================================================
// ORDERS
// ============================================================================

/**
 * Get User Market Orders
 * GET /api/v1/market/orders
 */
export const getUserOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { status, orderType, limit = 20, skip = 0 } = req.query;

    const query: any = {
      userId: req.user._id,
    };

    if (status) {
      query.status = status;
    }

    if (orderType) {
      query.orderType = orderType;
    }

    const orders = await MarketOrder.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .skip(parseInt(skip as string))
      .lean();

    const total = await MarketOrder.countDocuments(query);

    res.json({
      data: orders,
      pagination: {
        limit: parseInt(limit as string),
        skip: parseInt(skip as string),
        total,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get user orders', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_ORDERS_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Get Order Details
 * GET /api/v1/market/orders/:orderId
 */
export const getOrderById = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { orderId } = req.params;

    const order = await MarketOrder.findById(orderId);

    if (!order) {
      throw new NotFoundError('Order', orderId);
    }

    if (order.userId.toString() !== req.user._id.toString()) {
      throw new ValidationError('Order does not belong to user');
    }

    res.json(order);
  } catch (error: any) {
    logger.error('Failed to get order details', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_ORDER_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Cancel Market Order
 * POST /api/v1/market/orders/:orderId/cancel
 */
export const cancelOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await MarketOrder.findById(orderId);

    if (!order) {
      throw new NotFoundError('Order', orderId);
    }

    if (order.userId.toString() !== req.user._id.toString()) {
      throw new ValidationError('Order does not belong to user');
    }

    if (order.status === 'completed' || order.status === 'cancelled') {
      throw new ValidationError(`Cannot cancel order with status: ${order.status}`);
    }

    // Update order status
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    await order.save();

    // Cancel in supplier system if synced
    if (order.supplierOrderId) {
      try {
        await supplierApi.cancelSupplierOrder(order.supplierOrderId, reason || 'Cancelled by user');
      } catch (error) {
        logger.error('Failed to cancel order in supplier system', {
          orderId: order._id,
          supplierOrderId: order.supplierOrderId,
          error,
        });
      }
    }

    logger.info('Order cancelled', {
      orderId: order._id.toString(),
      userId: req.user._id.toString(),
      reason,
    });

    res.json({
      message: 'Order cancelled successfully',
      orderId: order._id,
      orderCode: order.orderCode,
    });
  } catch (error: any) {
    logger.error('Failed to cancel order', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'CANCEL_ORDER_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

