import { Router } from 'express';
import * as eatsController from '../controllers/eats.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { paymentRateLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// ============================================================================
// RESTAURANT DISCOVERY
// ============================================================================

/**
 * @route   GET /api/v1/eats/restaurants
 * @desc    Get restaurants (with mode toggle: eats/live)
 * @access  Public (optional auth for personalization)
 * @query   mode, page, limit, categoryId, healthTags, latitude, longitude, radius, search
 */
router.get('/restaurants', optionalAuthenticate, eatsController.getRestaurants);

/**
 * @route   GET /api/v1/eats/restaurants/:restaurantId
 * @desc    Get restaurant details with menu
 * @access  Public (optional auth)
 */
router.get('/restaurants/:restaurantId', optionalAuthenticate, eatsController.getRestaurantById);

// ============================================================================
// CART MANAGEMENT
// ============================================================================

/**
 * @route   POST /api/v1/eats/cart
 * @desc    Create new cart session
 * @access  Private
 * @body    restaurantId, orderType, tableId?, deepLinkData?
 */
router.post('/cart', authenticate, eatsController.createCart);

/**
 * @route   POST /api/v1/eats/cart/:cartId/items
 * @desc    Add item to cart
 * @access  Private
 * @body    menuItemId, name, price, quantity, modifiers?, specialInstructions?
 */
router.post('/cart/:cartId/items', authenticate, eatsController.addItemToCart);

/**
 * @route   PUT /api/v1/eats/cart/:cartId/items/:itemId
 * @desc    Update cart item quantity
 * @access  Private
 * @body    quantity
 */
router.put('/cart/:cartId/items/:itemId', authenticate, eatsController.updateCartItem);

/**
 * @route   DELETE /api/v1/eats/cart/:cartId/items/:itemId
 * @desc    Remove item from cart
 * @access  Private
 */
router.delete('/cart/:cartId/items/:itemId', authenticate, eatsController.removeCartItem);

// ============================================================================
// CHECKOUT
// ============================================================================

/**
 * @route   POST /api/v1/eats/cart/:cartId/checkout
 * @desc    Checkout cart and create order
 * @access  Private
 * @body    paymentMethod, tipAmount?, pointsToRedeem?, customerInfo?
 */
router.post(
  '/cart/:cartId/checkout',
  authenticate,
  paymentRateLimiter,
  eatsController.checkoutCart
);

// ============================================================================
// ORDERS
// ============================================================================

/**
 * @route   GET /api/v1/eats/orders
 * @desc    Get user's orders
 * @access  Private
 * @query   status?, limit?, skip?
 */
router.get('/orders', authenticate, eatsController.getUserOrders);

/**
 * @route   GET /api/v1/eats/orders/:orderId
 * @desc    Get order details
 * @access  Private
 */
router.get('/orders/:orderId', authenticate, eatsController.getOrderById);

export default router;


