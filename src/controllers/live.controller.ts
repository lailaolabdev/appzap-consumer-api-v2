import { Request, Response } from 'express';
import HealthProfile from '../models/HealthProfile';
import MealPlan from '../models/MealPlan';
import Supplement from '../models/Supplement';
import MealSubscription from '../models/MealSubscription';
import logger from '../utils/logger';
import { ValidationError, NotFoundError } from '../utils/errors';
import { codeGenerators } from '../utils/helpers';

// ============================================================================
// HEALTH PROFILE
// ============================================================================

/**
 * Get or Create Health Profile
 * GET /api/v1/live/health-profile
 */
export const getHealthProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    let profile = await HealthProfile.findOne({ userId: req.user._id });

    if (!profile) {
      // Create default profile
      profile = await HealthProfile.create({
        userId: req.user._id,
        dietaryRestrictions: [],
        allergies: [],
        healthGoals: [],
      });
    }

    res.json(profile);
  } catch (error: any) {
    logger.error('Failed to get health profile', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_HEALTH_PROFILE_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Update Health Profile
 * PUT /api/v1/live/health-profile
 */
export const updateHealthProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const updateData = req.body;

    let profile = await HealthProfile.findOne({ userId: req.user._id });

    if (!profile) {
      profile = await HealthProfile.create({
        userId: req.user._id,
        ...updateData,
      });
    } else {
      Object.assign(profile, updateData);
      await profile.save();
    }

    logger.info('Health profile updated', {
      userId: req.user._id.toString(),
      profileId: profile._id.toString(),
    });

    res.json({
      success: true,
      profile,
    });
  } catch (error: any) {
    logger.error('Failed to update health profile', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'UPDATE_HEALTH_PROFILE_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

// ============================================================================
// MEAL PLANS
// ============================================================================

/**
 * Get Meal Plans
 * GET /api/v1/live/meal-plans
 */
export const getMealPlans = async (req: Request, res: Response): Promise<void> => {
  try {
    const { dietaryTags, healthGoals, minPrice, maxPrice, duration, page = 1, limit = 20 } = req.query;

    const query: any = { isActive: true };

    if (dietaryTags) {
      query.dietaryTags = { $in: (dietaryTags as string).split(',') };
    }

    if (healthGoals) {
      query.healthGoals = { $in: (healthGoals as string).split(',') };
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice as string);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice as string);
    }

    if (duration) {
      query.duration = parseInt(duration as string);
    }

    const mealPlans = await MealPlan.find(query)
      .sort({ publishedAt: -1, rating: -1 })
      .limit(parseInt(limit as string))
      .skip((parseInt(page as string) - 1) * parseInt(limit as string))
      .lean();

    const total = await MealPlan.countDocuments(query);

    res.json({
      data: mealPlans,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error: any) {
    logger.error('Failed to get meal plans', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_MEAL_PLANS_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Get Meal Plan by ID
 * GET /api/v1/live/meal-plans/:planId
 */
export const getMealPlanById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { planId } = req.params;

    const mealPlan = await MealPlan.findById(planId);

    if (!mealPlan) {
      throw new NotFoundError('Meal plan', planId);
    }

    // Check compatibility with user's health profile (if authenticated)
    let isCompatible = true;
    if (req.user) {
      const healthProfile = await HealthProfile.findOne({ userId: req.user._id });
      if (healthProfile) {
        isCompatible = await mealPlan.isCompatibleWithHealthProfile(healthProfile._id.toString());
      }
    }

    res.json({
      ...mealPlan.toObject(),
      isCompatible,
    });
  } catch (error: any) {
    logger.error('Failed to get meal plan', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_MEAL_PLAN_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

// ============================================================================
// SUPPLEMENTS
// ============================================================================

/**
 * Get Supplements
 * GET /api/v1/live/supplements
 */
export const getSupplements = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      category,
      tags,
      healthGoals,
      brand,
      minPrice,
      maxPrice,
      inStockOnly = 'true',
      page = 1,
      limit = 20,
    } = req.query;

    const query: any = { isActive: true };

    if (inStockOnly === 'true') {
      query.isInStock = true;
    }

    if (category) {
      query.category = category;
    }

    if (tags) {
      query.tags = { $in: (tags as string).split(',') };
    }

    if (healthGoals) {
      query.healthGoals = { $in: (healthGoals as string).split(',') };
    }

    if (brand) {
      query.brand = brand;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice as string);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice as string);
    }

    const supplements = await Supplement.find(query)
      .sort({ rating: -1, reviewCount: -1 })
      .limit(parseInt(limit as string))
      .skip((parseInt(page as string) - 1) * parseInt(limit as string))
      .lean();

    const total = await Supplement.countDocuments(query);

    res.json({
      data: supplements,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error: any) {
    logger.error('Failed to get supplements', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_SUPPLEMENTS_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Get Supplement by ID
 * GET /api/v1/live/supplements/:supplementId
 */
export const getSupplementById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { supplementId } = req.params;

    const supplement = await Supplement.findById(supplementId);

    if (!supplement) {
      throw new NotFoundError('Supplement', supplementId);
    }

    res.json(supplement);
  } catch (error: any) {
    logger.error('Failed to get supplement', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_SUPPLEMENT_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

// ============================================================================
// MEAL SUBSCRIPTIONS
// ============================================================================

/**
 * Create Meal Subscription
 * POST /api/v1/live/subscriptions
 */
export const createMealSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const {
      mealPlanId,
      deliveryAddressId,
      deliverySchedule,
      paymentMethod,
      supplements,
      specialInstructions,
    } = req.body;

    if (!mealPlanId || !deliveryAddressId || !deliverySchedule || !paymentMethod) {
      throw new ValidationError('Required fields: mealPlanId, deliveryAddressId, deliverySchedule, paymentMethod');
    }

    // Get meal plan
    const mealPlan = await MealPlan.findById(mealPlanId);
    if (!mealPlan) {
      throw new NotFoundError('Meal plan', mealPlanId);
    }

    // Get delivery address
    const DeliveryAddress = (await import('../models/DeliveryAddress')).default;
    const deliveryAddress = await DeliveryAddress.findById(deliveryAddressId);
    if (!deliveryAddress) {
      throw new NotFoundError('Delivery address', deliveryAddressId);
    }

    // Check compatibility
    const healthProfile = await HealthProfile.findOne({ userId: req.user._id });
    if (healthProfile) {
      const isCompatible = await mealPlan.isCompatibleWithHealthProfile(healthProfile._id.toString());
      if (!isCompatible) {
        throw new ValidationError('This meal plan is not compatible with your health profile');
      }
    }

    // Create subscription
    const subscription = await MealSubscription.create({
      subscriptionCode: codeGenerators.orderCode('MSUB'),
      userId: req.user._id,
      healthProfileId: healthProfile?._id,
      mealPlanId: mealPlan._id,
      mealPlanCode: mealPlan.planCode,
      mealPlanName: mealPlan.name,
      duration: mealPlan.duration,
      mealsPerDay: mealPlan.mealsPerDay,
      totalMeals: mealPlan.totalMeals,
      deliveryInfo: {
        fullAddress: deliveryAddress.fullAddress,
        latitude: deliveryAddress.latitude,
        longitude: deliveryAddress.longitude,
        contactName: deliveryAddress.contactName,
        contactPhone: deliveryAddress.contactPhone,
        deliveryFee: 0, // Calculate based on location
      },
      deliverySchedule,
      nextDeliveryDate: new Date(),
      paymentPlan: {
        frequency: 'weekly',
        amount: mealPlan.price,
        nextPaymentDate: new Date(),
        paymentMethod,
      },
      planPrice: mealPlan.price,
      pricePerMeal: mealPlan.pricePerMeal,
      discount: 0,
      total: mealPlan.price,
      supplements: supplements || [],
      specialInstructions,
      status: 'active',
      startDate: new Date(),
      source: 'app',
    });

    // Increment subscriber count
    await mealPlan.incrementSubscribers();

    logger.info('Meal subscription created', {
      subscriptionId: subscription._id.toString(),
      userId: req.user._id.toString(),
      mealPlanId: mealPlan._id.toString(),
    });

    res.json({
      subscriptionId: subscription._id,
      subscriptionCode: subscription.subscriptionCode,
      status: subscription.status,
      nextDelivery: subscription.nextDeliveryDate,
      total: subscription.total,
    });
  } catch (error: any) {
    logger.error('Failed to create meal subscription', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'CREATE_SUBSCRIPTION_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Get User Meal Subscriptions
 * GET /api/v1/live/subscriptions
 */
export const getUserMealSubscriptions = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { status, limit = 20, skip = 0 } = req.query;

    const query: any = { userId: req.user._id };

    if (status) {
      query.status = status;
    }

    const subscriptions = await MealSubscription.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .skip(parseInt(skip as string))
      .lean();

    const total = await MealSubscription.countDocuments(query);

    res.json({
      data: subscriptions,
      pagination: {
        limit: parseInt(limit as string),
        skip: parseInt(skip as string),
        total,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get meal subscriptions', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_SUBSCRIPTIONS_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Get Meal Subscription by ID
 * GET /api/v1/live/subscriptions/:subscriptionId
 */
export const getMealSubscriptionById = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { subscriptionId } = req.params;

    const subscription = await MealSubscription.findById(subscriptionId);

    if (!subscription) {
      throw new NotFoundError('Subscription', subscriptionId);
    }

    if (subscription.userId.toString() !== req.user._id.toString()) {
      throw new ValidationError('Subscription does not belong to user');
    }

    res.json(subscription);
  } catch (error: any) {
    logger.error('Failed to get meal subscription', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_SUBSCRIPTION_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Pause Meal Subscription
 * POST /api/v1/live/subscriptions/:subscriptionId/pause
 */
export const pauseMealSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { subscriptionId } = req.params;
    const { reason } = req.body;

    const subscription = await MealSubscription.findById(subscriptionId);

    if (!subscription) {
      throw new NotFoundError('Subscription', subscriptionId);
    }

    if (subscription.userId.toString() !== req.user._id.toString()) {
      throw new ValidationError('Subscription does not belong to user');
    }

    await subscription.pause(reason);

    logger.info('Meal subscription paused', {
      subscriptionId,
      userId: req.user._id.toString(),
    });

    res.json({
      success: true,
      message: 'Subscription paused successfully',
      subscriptionId,
      status: 'paused',
    });
  } catch (error: any) {
    logger.error('Failed to pause meal subscription', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'PAUSE_SUBSCRIPTION_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Resume Meal Subscription
 * POST /api/v1/live/subscriptions/:subscriptionId/resume
 */
export const resumeMealSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { subscriptionId } = req.params;

    const subscription = await MealSubscription.findById(subscriptionId);

    if (!subscription) {
      throw new NotFoundError('Subscription', subscriptionId);
    }

    if (subscription.userId.toString() !== req.user._id.toString()) {
      throw new ValidationError('Subscription does not belong to user');
    }

    await subscription.resume();

    logger.info('Meal subscription resumed', {
      subscriptionId,
      userId: req.user._id.toString(),
    });

    res.json({
      success: true,
      message: 'Subscription resumed successfully',
      subscriptionId,
      status: 'active',
      nextDelivery: subscription.nextDeliveryDate,
    });
  } catch (error: any) {
    logger.error('Failed to resume meal subscription', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'RESUME_SUBSCRIPTION_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Cancel Meal Subscription
 * POST /api/v1/live/subscriptions/:subscriptionId/cancel
 */
export const cancelMealSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { subscriptionId } = req.params;
    const { reason } = req.body;

    const subscription = await MealSubscription.findById(subscriptionId);

    if (!subscription) {
      throw new NotFoundError('Subscription', subscriptionId);
    }

    if (subscription.userId.toString() !== req.user._id.toString()) {
      throw new ValidationError('Subscription does not belong to user');
    }

    await subscription.cancel(reason);

    logger.info('Meal subscription cancelled', {
      subscriptionId,
      userId: req.user._id.toString(),
      reason,
    });

    res.json({
      success: true,
      message: 'Subscription cancelled successfully',
      subscriptionId,
      status: 'cancelled',
    });
  } catch (error: any) {
    logger.error('Failed to cancel meal subscription', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'CANCEL_SUBSCRIPTION_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

export default {
  // Health Profile
  getHealthProfile,
  updateHealthProfile,
  
  // Meal Plans
  getMealPlans,
  getMealPlanById,
  
  // Supplements
  getSupplements,
  getSupplementById,
  
  // Meal Subscriptions
  createMealSubscription,
  getUserMealSubscriptions,
  getMealSubscriptionById,
  pauseMealSubscription,
  resumeMealSubscription,
  cancelMealSubscription,
};

