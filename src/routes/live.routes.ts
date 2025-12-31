import { Router } from 'express';
import * as liveController from '../controllers/live.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';

const router = Router();

// ============================================================================
// HEALTH PROFILE
// ============================================================================

/**
 * @route   GET /api/v1/live/health-profile
 * @desc    Get or create health profile
 * @access  Private
 */
router.get('/health-profile', authenticate, liveController.getHealthProfile);

/**
 * @route   PUT /api/v1/live/health-profile
 * @desc    Update health profile
 * @access  Private
 * @body    age?, gender?, height?, weight?, targetWeight?, dietaryRestrictions?, allergies?, healthGoals?, activityLevel?, mealPreferences?, medicalConditions?
 */
router.put('/health-profile', authenticate, liveController.updateHealthProfile);

// ============================================================================
// MEAL PLANS
// ============================================================================

/**
 * @route   GET /api/v1/live/meal-plans
 * @desc    Get meal plans with filtering
 * @access  Public (optional auth for personalization)
 * @query   dietaryTags?, healthGoals?, minPrice?, maxPrice?, duration?, page?, limit?
 */
router.get('/meal-plans', optionalAuthenticate, liveController.getMealPlans);

/**
 * @route   GET /api/v1/live/meal-plans/:planId
 * @desc    Get meal plan details with compatibility check
 * @access  Public (optional auth for compatibility)
 */
router.get('/meal-plans/:planId', optionalAuthenticate, liveController.getMealPlanById);

// ============================================================================
// SUPPLEMENTS
// ============================================================================

/**
 * @route   GET /api/v1/live/supplements
 * @desc    Get supplements with filtering
 * @access  Public
 * @query   category?, tags?, healthGoals?, brand?, minPrice?, maxPrice?, inStockOnly?, page?, limit?
 */
router.get('/supplements', liveController.getSupplements);

/**
 * @route   GET /api/v1/live/supplements/:supplementId
 * @desc    Get supplement details
 * @access  Public
 */
router.get('/supplements/:supplementId', liveController.getSupplementById);

// ============================================================================
// MEAL SUBSCRIPTIONS
// ============================================================================

/**
 * @route   POST /api/v1/live/subscriptions
 * @desc    Create meal subscription
 * @access  Private
 * @body    mealPlanId, deliveryAddressId, deliverySchedule, paymentMethod, supplements?, specialInstructions?
 */
router.post('/subscriptions', authenticate, liveController.createMealSubscription);

/**
 * @route   GET /api/v1/live/subscriptions
 * @desc    Get user's meal subscriptions
 * @access  Private
 * @query   status?, limit?, skip?
 */
router.get('/subscriptions', authenticate, liveController.getUserMealSubscriptions);

/**
 * @route   GET /api/v1/live/subscriptions/:subscriptionId
 * @desc    Get meal subscription details
 * @access  Private
 */
router.get('/subscriptions/:subscriptionId', authenticate, liveController.getMealSubscriptionById);

/**
 * @route   POST /api/v1/live/subscriptions/:subscriptionId/pause
 * @desc    Pause meal subscription
 * @access  Private
 * @body    reason?
 */
router.post('/subscriptions/:subscriptionId/pause', authenticate, liveController.pauseMealSubscription);

/**
 * @route   POST /api/v1/live/subscriptions/:subscriptionId/resume
 * @desc    Resume meal subscription
 * @access  Private
 */
router.post('/subscriptions/:subscriptionId/resume', authenticate, liveController.resumeMealSubscription);

/**
 * @route   POST /api/v1/live/subscriptions/:subscriptionId/cancel
 * @desc    Cancel meal subscription
 * @access  Private
 * @body    reason?
 */
router.post('/subscriptions/:subscriptionId/cancel', authenticate, liveController.cancelMealSubscription);

export default router;


