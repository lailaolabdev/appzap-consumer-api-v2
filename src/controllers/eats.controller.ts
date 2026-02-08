// @ts-nocheck
import { Request, Response } from 'express';
import Cart from '../models/Cart';
import Order from '../models/Order';
import * as posV2Service from '../services/posV2Api.service';
import { unifiedRestaurantService, PosVersion } from '../services/unifiedRestaurant.service';
import * as phapayService from '../services/phapay.service';
import * as loyaltyService from '../services/loyalty.service';
import * as deepLinkService from '../services/deepLink.service';
import * as spinToWinService from '../services/spinToWin.service';
import * as pushNotificationService from '../services/pushNotification.service';
import logger from '../utils/logger';
import { ValidationError, NotFoundError, CartEmptyError, CartExpiredError } from '../utils/errors';
import { codeGenerators, calculateDistance } from '../utils/helpers';
import config from '../config/env';

// ============================================================================
// RESTAURANT DISCOVERY
// ============================================================================

/**
 * Get Restaurants (with mode toggle: eats/live)
 * GET /api/v1/eats/restaurants
 * 
 * Now uses UnifiedRestaurantService to fetch from both POS V1 and V2
 */
export const getRestaurants = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      mode = 'eats',
      page = 1,
      limit = 20,
      categoryId,
      healthTags,
      latitude,
      longitude,
      radius = 5,
      search,
      cuisine,
      isReservable,
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Get restaurants from BOTH POS V1 and POS V2 using unified service
    const result = await unifiedRestaurantService.getAllRestaurants({
      skip,
      limit: limitNum,
      search: search as string,
      cuisine: cuisine as string,
      isReservable: isReservable === 'true',
    });

    let restaurants = result.data;

    // Apply mode-based filtering
    if (mode === 'live' && healthTags) {
      // TODO: Add health tags filtering when restaurant metadata is implemented
      // For now, return all restaurants
    }

    // Calculate distance if coordinates provided
    if (latitude && longitude) {
      restaurants = restaurants.map((restaurant) => ({
        ...restaurant,
        distanceKm: restaurant.address?.latitude && restaurant.address?.longitude
          ? calculateDistance(
              parseFloat(latitude as string),
              parseFloat(longitude as string),
              restaurant.address.latitude,
              restaurant.address.longitude
            )
          : null,
      }));

      // Sort by distance if location provided
      restaurants.sort((a: any, b: any) => {
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    }

    res.json({
      data: restaurants,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: result.total,
        totalPages: Math.ceil(result.total / limitNum),
      },
      mode,
      sources: {
        posV1: restaurants.filter((r: any) => r.posVersion === 'v1').length,
        posV2: restaurants.filter((r: any) => r.posVersion === 'v2').length,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get restaurants', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_RESTAURANTS_FAILED',
        message: error.message || 'Failed to get restaurants',
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Get Restaurant Details
 * GET /api/v1/eats/restaurants/:restaurantId
 * 
 * Auto-routes to correct POS system based on restaurant ID format:
 * - v1_xxx -> POS V1
 * - v2_xxx -> POS V2
 * - xxx (no prefix) -> Try V2 first, then V1
 */
export const getRestaurantById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const { posVersion } = req.query;

    // Use unified service to auto-route to correct POS
    const restaurant = await unifiedRestaurantService.getRestaurantById(
      restaurantId,
      posVersion as PosVersion | undefined
    );

    if (!restaurant) {
      throw new NotFoundError('Restaurant', restaurantId);
    }

    // Get menu for this restaurant
    const menu = await unifiedRestaurantService.getMenu(
      restaurant.posRestaurantId,
      restaurant.posVersion
    );

    res.json({
      ...restaurant,
      menu,
    });
  } catch (error: any) {
    logger.error('Failed to get restaurant details', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_RESTAURANT_FAILED',
        message: error.message || 'Failed to get restaurant details',
        statusCode: error.statusCode || 500,
      },
    });
  }
};

// ============================================================================
// CART MANAGEMENT
// ============================================================================

/**
 * Create Cart
 * POST /api/v1/eats/cart
 */
export const createCart = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { restaurantId, orderType, tableId, deepLinkData } = req.body;

    if (!restaurantId || !orderType) {
      throw new ValidationError('restaurantId and orderType are required');
    }

    if (!['dine_in', 'takeaway'].includes(orderType)) {
      throw new ValidationError('orderType must be dine_in or takeaway');
    }

    // Get restaurant details
    const restaurant = await posV2Service.getRestaurantById(restaurantId);

    // Create cart
    const cart = await Cart.create({
      userId: req.user._id,
      restaurantId,
      restaurantName: restaurant.name,
      orderType,
      tableId,
      deepLinkData,
      items: [],
      subtotal: 0,
      total: 0,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 60 minutes
    });

    logger.info('Cart created', {
      cartId: cart._id.toString(),
      userId: req.user._id.toString(),
      restaurantId,
    });

    res.json({
      cartId: cart._id,
      restaurantId: cart.restaurantId,
      restaurantName: cart.restaurantName,
      orderType: cart.orderType,
      tableId: cart.tableId,
      items: cart.items,
      subtotal: cart.subtotal,
      discount: cart.discount,
      total: cart.total,
      expiresAt: cart.expiresAt,
      createdAt: cart.createdAt,
    });
  } catch (error: any) {
    logger.error('Failed to create cart', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'CREATE_CART_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Add Item to Cart
 * POST /api/v1/eats/cart/:cartId/items
 */
export const addItemToCart = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { cartId } = req.params;
    const { menuItemId, name, price, quantity, modifiers, specialInstructions } = req.body;

    if (!menuItemId || !name || !price || !quantity) {
      throw new ValidationError('menuItemId, name, price, and quantity are required');
    }

    const cart = await Cart.findById(cartId);

    if (!cart) {
      throw new NotFoundError('Cart', cartId);
    }

    if (cart.userId.toString() !== req.user._id.toString()) {
      throw new ValidationError('Cart does not belong to user');
    }

    if (new Date() > cart.expiresAt) {
      throw new CartExpiredError();
    }

    // Add item to cart
    await cart.addItem({
      menuItemId,
      name,
      price,
      quantity,
      modifiers: modifiers || [],
      specialInstructions,
    });

    res.json({
      cartId: cart._id,
      items: cart.items,
      subtotal: cart.subtotal,
      discount: cart.discount,
      total: cart.total,
    });
  } catch (error: any) {
    logger.error('Failed to add item to cart', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'ADD_ITEM_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Update Cart Item
 * PUT /api/v1/eats/cart/:cartId/items/:itemId
 */
export const updateCartItem = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { cartId, itemId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 0) {
      throw new ValidationError('Valid quantity is required');
    }

    const cart = await Cart.findById(cartId);

    if (!cart) {
      throw new NotFoundError('Cart', cartId);
    }

    if (cart.userId.toString() !== req.user._id.toString()) {
      throw new ValidationError('Cart does not belong to user');
    }

    await cart.updateItem(itemId, quantity);

    res.json({
      cartId: cart._id,
      items: cart.items,
      subtotal: cart.subtotal,
      discount: cart.discount,
      total: cart.total,
    });
  } catch (error: any) {
    logger.error('Failed to update cart item', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'UPDATE_ITEM_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Remove Cart Item
 * DELETE /api/v1/eats/cart/:cartId/items/:itemId
 */
export const removeCartItem = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { cartId, itemId } = req.params;

    const cart = await Cart.findById(cartId);

    if (!cart) {
      throw new NotFoundError('Cart', cartId);
    }

    if (cart.userId.toString() !== req.user._id.toString()) {
      throw new ValidationError('Cart does not belong to user');
    }

    await cart.removeItem(itemId);

    res.json({
      cartId: cart._id,
      items: cart.items,
      subtotal: cart.subtotal,
      discount: cart.discount,
      total: cart.total,
    });
  } catch (error: any) {
    logger.error('Failed to remove cart item', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'REMOVE_ITEM_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

// ============================================================================
// CHECKOUT
// ============================================================================

/**
 * Checkout Cart
 * POST /api/v1/eats/cart/:cartId/checkout
 */
export const checkoutCart = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { cartId } = req.params;
    const { paymentMethod, tipAmount, pointsToRedeem, customerInfo } = req.body;

    if (!paymentMethod) {
      throw new ValidationError('paymentMethod is required');
    }

    // Get cart
    const cart = await Cart.findById(cartId);

    if (!cart) {
      throw new NotFoundError('Cart', cartId);
    }

    if (cart.userId.toString() !== req.user._id.toString()) {
      throw new ValidationError('Cart does not belong to user');
    }

    if (cart.items.length === 0) {
      throw new CartEmptyError();
    }

    if (new Date() > cart.expiresAt) {
      throw new CartExpiredError();
    }

    // Calculate totals
    let subtotal = cart.subtotal;
    let discount = cart.discount;
    let loyaltyDiscount = 0;

    // Handle loyalty points redemption
    if (pointsToRedeem && pointsToRedeem > 0) {
      const redemption = await loyaltyService.redeemPoints(
        req.user._id.toString(),
        pointsToRedeem,
        'pending', // Will update with actual order ID
        subtotal
      );
      loyaltyDiscount = redemption.discountAmount;
    }

    const tip = tipAmount || 0;
    const total = subtotal - discount - loyaltyDiscount + tip;

    // Create order
    const order = await Order.create({
      orderCode: codeGenerators.orderCode('ORD'),
      userId: req.user._id,
      orderType: cart.orderType,
      productType: 'eats',
      restaurantId: cart.restaurantId,
      restaurantName: cart.restaurantName,
      tableId: cart.tableId,
      items: cart.items,
      subtotal,
      discount: discount + loyaltyDiscount,
      discountType: pointsToRedeem ? 'loyalty' : cart.appliedVoucher ? 'voucher' : undefined,
      tip,
      total,
      pointsRedeemed: pointsToRedeem || 0,
      paymentMethod,
      paymentStatus: 'pending',
      status: 'pending',
      posSyncStatus: 'pending',
      source: cart.deepLinkData?.source || 'app',
      referralCode: cart.deepLinkData?.referralCode,
    });

    logger.info('Order created', {
      orderId: order._id.toString(),
      orderCode: order.orderCode,
      userId: req.user._id.toString(),
      total,
    });

    // Send order to POS V2 (async, non-blocking)
    posV2Service
      .createOrder({
        restaurantId: cart.restaurantId,
        tableId: cart.tableId,
        items: cart.items.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          modifiers: item.modifiers,
          specialInstructions: item.specialInstructions,
        })),
        orderSource: 'consumer_app',
        externalOrderId: order._id.toString(),
        customerInfo,
      })
      .then((posOrder) => {
        order.posOrderId = posOrder.orderId;
        order.posSyncStatus = 'synced';
        order.posSyncedAt = new Date();
        return order.save();
      })
      .catch((error) => {
        logger.error('POS sync failed', { orderId: order._id, error: error.message });
        order.posSyncStatus = 'failed';
        order.posSyncError = error.message;
        return order.save();
      });

    // Initialize payment
    let paymentUrl = null;
    let qrCode = null;

    if (paymentMethod === 'phapay') {
      const paymentSession = await phapayService.createPaymentSession({
        orderId: order._id.toString(),
        amount: total,
        returnUrl: `${config.apiUrl}/payment/callback`,
        webhookUrl: `${config.apiUrl}/api/v1/payments/webhook/phapay`,
        customerInfo: {
          name: req.user.fullName || customerInfo?.name,
          phone: req.user.phone,
        },
        metadata: {
          orderCode: order.orderCode,
          restaurantId: cart.restaurantId,
        },
      });

      paymentUrl = paymentSession.paymentUrl;
      qrCode = paymentSession.qrCode;
      order.paymentId = paymentSession.sessionId;
      await order.save();
    }

    // Delete cart after successful checkout
    await Cart.findByIdAndDelete(cartId);

    // ============================================================================
    // 🎰 MAGIC: Create Deep Link + Spin-to-Win Reward
    // ============================================================================
    let deepLinkInfo = null;
    let spinRewardInfo = null;

    try {
      // Create deep link for order
      const deepLink = await deepLinkService.createOrderDeepLink({
        orderId: order._id.toString(),
        userId: req.user._id.toString(),
        orderType: 'eats',
        orderTotal: total,
      });

      deepLinkInfo = {
        shortLink: deepLink.shortLink,
        qrCodeUrl: deepLink.qrCodeUrl,
      };

      // Create spin-to-win reward
      const spinReward = await spinToWinService.createSpinRewardForOrder({
        userId: req.user._id.toString(),
        orderId: order._id.toString(),
        source: cart.deepLinkData?.source === 'web' ? 'web_order' : 'first_app_order',
        deepLinkId: deepLink.shortCode,
      });

      spinRewardInfo = {
        rewardId: spinReward.rewardId,
        spinCount: spinReward.spinCount,
        expiresAt: spinReward.expiresAt,
      };

      // Send push notification with spin-to-win incentive
      if (cart.deepLinkData?.source === 'web') {
        await pushNotificationService.sendSpinToWinNotification({
          userId: req.user._id.toString(),
          orderCode: order.orderCode,
          deepLink: deepLink.shortLink,
        });
      } else {
        await pushNotificationService.sendOrderConfirmationNotification({
          userId: req.user._id.toString(),
          orderCode: order.orderCode,
          restaurantName: cart.restaurantName,
          total,
          deepLink: deepLink.shortLink,
        });
      }

      logger.info('Deep link and spin reward created', {
        orderId: order._id.toString(),
        deepLink: deepLink.shortLink,
        rewardId: spinReward.rewardId,
      });
    } catch (error: any) {
      logger.error('Failed to create deep link or spin reward', {
        orderId: order._id.toString(),
        error: error.message,
      });
      // Don't fail the order if deep link/spin creation fails
    }

    res.json({
      orderId: order._id,
      orderCode: order.orderCode,
      paymentUrl,
      qrCode,
      totalAmount: total,
      breakdown: {
        subtotal,
        discount,
        loyaltyDiscount,
        tip,
      },
      estimatedPrepTime: 15,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      // 🎁 Spin-to-Win Magic!
      deepLink: deepLinkInfo,
      spinToWin: spinRewardInfo,
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
 * Get User Orders
 * GET /api/v1/eats/orders
 */
export const getUserOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { status, limit = 20, skip = 0 } = req.query;

    const query: any = {
      userId: req.user._id,
      productType: 'eats',
    };

    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .skip(parseInt(skip as string))
      .lean();

    const total = await Order.countDocuments(query);

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
 * GET /api/v1/eats/orders/:orderId
 */
export const getOrderById = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { orderId } = req.params;

    const order = await Order.findById(orderId);

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

