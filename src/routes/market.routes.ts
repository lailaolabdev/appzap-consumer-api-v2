import { Router } from 'express';
import * as marketController from '../controllers/market.controller';
import * as subscriptionController from '../controllers/subscription.controller';
import * as deliveryAddressController from '../controllers/deliveryAddress.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { paymentRateLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// ============================================================================
// PRODUCT CATALOG
// ============================================================================

/**
 * @route   GET /api/v1/market/products
 * @desc    Get products with B2C/B2B pricing
 * @access  Public (optional auth for personalized pricing)
 * @query   page, limit, category, search
 */
router.get('/products', optionalAuthenticate, marketController.getProducts);

/**
 * @route   GET /api/v1/market/products/:productId
 * @desc    Get product details with appropriate pricing
 * @access  Public (optional auth)
 */
router.get('/products/:productId', optionalAuthenticate, marketController.getProductById);

/**
 * @route   GET /api/v1/market/categories
 * @desc    Get product categories
 * @access  Public
 */
router.get('/categories', marketController.getCategories);

// ============================================================================
// CART & CHECKOUT
// ============================================================================

/**
 * @route   POST /api/v1/market/cart/calculate
 * @desc    Calculate cart total with dynamic pricing
 * @access  Private
 * @body    items[], deliveryAddressId?
 */
router.post('/cart/calculate', authenticate, marketController.calculateCart);

/**
 * @route   POST /api/v1/market/checkout
 * @desc    Checkout market cart and create order
 * @access  Private
 * @body    items[], deliveryAddressId, deliveryMethod, paymentMethod, pointsToRedeem?, notes?
 */
router.post('/checkout', authenticate, paymentRateLimiter, marketController.checkout);

// ============================================================================
// ORDERS
// ============================================================================

/**
 * @route   GET /api/v1/market/orders
 * @desc    Get user's market orders
 * @access  Private
 * @query   status?, orderType?, limit?, skip?
 */
router.get('/orders', authenticate, marketController.getUserOrders);

/**
 * @route   GET /api/v1/market/orders/:orderId
 * @desc    Get order details
 * @access  Private
 */
router.get('/orders/:orderId', authenticate, marketController.getOrderById);

/**
 * @route   POST /api/v1/market/orders/:orderId/cancel
 * @desc    Cancel order
 * @access  Private
 * @body    reason?
 */
router.post('/orders/:orderId/cancel', authenticate, marketController.cancelOrder);

// ============================================================================
// SUBSCRIPTIONS
// ============================================================================

/**
 * @route   POST /api/v1/market/subscriptions
 * @desc    Create subscription
 * @access  Private
 * @body    items[], deliveryAddressId, deliverySchedule, paymentMethod, autoPayment?, startDate?
 */
router.post('/subscriptions', authenticate, subscriptionController.createSubscription);

/**
 * @route   GET /api/v1/market/subscriptions
 * @desc    Get user's subscriptions
 * @access  Private
 * @query   status?, limit?, skip?
 */
router.get('/subscriptions', authenticate, subscriptionController.getUserSubscriptions);

/**
 * @route   GET /api/v1/market/subscriptions/:subscriptionId
 * @desc    Get subscription details
 * @access  Private
 */
router.get('/subscriptions/:subscriptionId', authenticate, subscriptionController.getSubscriptionById);

/**
 * @route   POST /api/v1/market/subscriptions/:subscriptionId/pause
 * @desc    Pause subscription
 * @access  Private
 */
router.post('/subscriptions/:subscriptionId/pause', authenticate, subscriptionController.pauseSubscription);

/**
 * @route   POST /api/v1/market/subscriptions/:subscriptionId/resume
 * @desc    Resume subscription
 * @access  Private
 */
router.post('/subscriptions/:subscriptionId/resume', authenticate, subscriptionController.resumeSubscription);

/**
 * @route   POST /api/v1/market/subscriptions/:subscriptionId/cancel
 * @desc    Cancel subscription
 * @access  Private
 * @body    reason?
 */
router.post('/subscriptions/:subscriptionId/cancel', authenticate, subscriptionController.cancelSubscription);

/**
 * @route   PUT /api/v1/market/subscriptions/:subscriptionId/schedule
 * @desc    Update subscription schedule
 * @access  Private
 * @body    frequency?, dayOfWeek?, dayOfMonth?, timeSlot?
 */
router.put('/subscriptions/:subscriptionId/schedule', authenticate, subscriptionController.updateSchedule);

// ============================================================================
// DELIVERY ADDRESSES
// ============================================================================

/**
 * @route   GET /api/v1/market/addresses
 * @desc    Get user's delivery addresses
 * @access  Private
 */
router.get('/addresses', authenticate, deliveryAddressController.getUserAddresses);

/**
 * @route   GET /api/v1/market/addresses/:addressId
 * @desc    Get address details
 * @access  Private
 */
router.get('/addresses/:addressId', authenticate, deliveryAddressController.getAddressById);

/**
 * @route   POST /api/v1/market/addresses
 * @desc    Create delivery address
 * @access  Private
 * @body    label, recipientName, phone, addressLine1, district, city, province, ...
 */
router.post('/addresses', authenticate, deliveryAddressController.createAddress);

/**
 * @route   PUT /api/v1/market/addresses/:addressId
 * @desc    Update delivery address
 * @access  Private
 */
router.put('/addresses/:addressId', authenticate, deliveryAddressController.updateAddress);

/**
 * @route   DELETE /api/v1/market/addresses/:addressId
 * @desc    Delete delivery address
 * @access  Private
 */
router.delete('/addresses/:addressId', authenticate, deliveryAddressController.deleteAddress);

/**
 * @route   POST /api/v1/market/addresses/:addressId/set-default
 * @desc    Set default address
 * @access  Private
 */
router.post('/addresses/:addressId/set-default', authenticate, deliveryAddressController.setDefaultAddress);

export default router;


