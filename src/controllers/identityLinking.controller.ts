// @ts-nocheck
import { Request, Response } from 'express';
import * as identityLinking from '../services/identityLinking.service';
import * as posV2Api from '../services/posV2Api.service';
import logger from '../utils/logger';
import { ValidationError } from '../utils/errors';

// ============================================================================
// IDENTITY LINKING (B2C <-> B2B)
// ============================================================================

/**
 * Link to Supplier (Create supplier_id)
 * POST /api/v1/identity/link-supplier
 */
export const linkToSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { linkCode, businessInfo } = req.body;

    const result = await identityLinking.linkToSupplier(req.user._id.toString(), {
      linkCode,
      businessInfo,
    });

    logger.info('User linked to supplier', {
      userId: req.user._id.toString(),
      supplierId: result.supplierId,
      profileType: result.profileType,
    });

    res.json({
      success: true,
      supplierId: result.supplierId,
      profileType: result.profileType,
      merchantProfile: result.merchantProfile,
      message: linkCode
        ? 'Successfully linked as merchant'
        : 'Successfully linked to supplier system',
    });
  } catch (error: any) {
    logger.error('Failed to link to supplier', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'LINK_SUPPLIER_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Verify Merchant Link Code
 * POST /api/v1/identity/verify-link-code
 */
export const verifyLinkCode = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { linkCode } = req.body;

    if (!linkCode) {
      throw new ValidationError('Link code is required');
    }

    const result = await identityLinking.verifyAndApplyLinkCode(
      req.user._id.toString(),
      linkCode
    );

    logger.info('Link code verified', {
      userId: req.user._id.toString(),
      supplierId: result.supplierId,
    });

    res.json({
      success: true,
      merchantInfo: result.merchantInfo,
      supplierId: result.supplierId,
      message: 'Link code verified successfully. You now have merchant access.',
    });
  } catch (error: any) {
    logger.error('Failed to verify link code', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'VERIFY_LINK_CODE_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Verify Restaurant Link Code (from POS V2)
 * POST /api/v1/identity/verify-restaurant-code
 */
export const verifyRestaurantLinkCode = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { linkCode } = req.body;

    if (!linkCode) {
      throw new ValidationError('Link code is required');
    }

    // Verify with POS V2
    const result = await posV2Api.verifyRestaurantLinkCode(
      linkCode,
      req.user._id.toString(),
      req.user.phone
    );

    logger.info('Restaurant link code verified', {
      userId: req.user._id.toString(),
      restaurantId: result.restaurantId,
    });

    res.json({
      success: true,
      restaurantInfo: result,
      message: 'Restaurant link code verified successfully.',
    });
  } catch (error: any) {
    logger.error('Failed to verify restaurant link code', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'VERIFY_RESTAURANT_CODE_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Get Profile Context
 * GET /api/v1/identity/profile-context
 */
export const getProfileContext = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const context = await identityLinking.getUserProfileContext(req.user._id.toString());

    res.json(context);
  } catch (error: any) {
    logger.error('Failed to get profile context', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_PROFILE_CONTEXT_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Switch Profile (Personal <-> Merchant)
 * POST /api/v1/identity/switch-profile
 */
export const switchProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { targetProfile } = req.body;

    if (!targetProfile || !['personal', 'merchant'].includes(targetProfile)) {
      throw new ValidationError('Valid targetProfile is required (personal or merchant)');
    }

    const result = await identityLinking.switchProfile(
      req.user._id.toString(),
      targetProfile
    );

    logger.info('Profile switched', {
      userId: req.user._id.toString(),
      activeProfile: result.activeProfile,
      priceType: result.priceType,
    });

    res.json({
      success: true,
      activeProfile: result.activeProfile,
      priceType: result.priceType,
      message: `Switched to ${result.activeProfile} profile. You will now see ${result.priceType} prices.`,
    });
  } catch (error: any) {
    logger.error('Failed to switch profile', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'SWITCH_PROFILE_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Update Merchant Profile
 * PUT /api/v1/identity/merchant-profile
 */
export const updateMerchantProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { businessName, businessType, taxId } = req.body;

    const updatedUser = await identityLinking.updateMerchantProfile(
      req.user._id.toString(),
      {
        businessName,
        businessType,
        taxId,
      }
    );

    logger.info('Merchant profile updated', {
      userId: req.user._id.toString(),
    });

    res.json({
      success: true,
      merchantProfile: updatedUser.merchantProfiles[0],
      message: 'Merchant profile updated successfully',
    });
  } catch (error: any) {
    logger.error('Failed to update merchant profile', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'UPDATE_MERCHANT_PROFILE_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Get Merchant Profile Details
 * GET /api/v1/identity/merchant-profile
 */
export const getMerchantProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const profile = await identityLinking.getMerchantProfileDetails(req.user._id.toString());

    res.json(profile);
  } catch (error: any) {
    logger.error('Failed to get merchant profile', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_MERCHANT_PROFILE_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

