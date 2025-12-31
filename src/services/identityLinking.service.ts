// @ts-nocheck
import User, { IUser } from '../models/User';
import * as supplierApi from './supplierApi.service';
import logger from '../utils/logger';
import { BusinessLogicError, ValidationError } from '../utils/errors';

/**
 * Identity Linking Service
 * Manages the linkage between Consumer App users and Supplier System
 * 
 * Key Concepts:
 * - Personal Profile (B2C): Regular consumer, gets retail pricing
 * - Merchant Profile (B2B): Linked to supplier as merchant, gets wholesale pricing
 * - A user can have both profiles and switch between them
 */

// ============================================================================
// IDENTITY LINKING
// ============================================================================

/**
 * Link user to Supplier system
 * Creates a supplier_id and enables merchant profile
 */
export const linkToSupplier = async (
  userId: string,
  params: {
    linkCode?: string;
    businessInfo?: {
      businessName?: string;
      businessType?: string;
      taxId?: string;
    };
  }
): Promise<{
  supplierId: string;
  profileType: 'personal' | 'merchant';
  merchantProfile?: any;
}> => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new BusinessLogicError('User not found', 'USER_NOT_FOUND');
    }

    // Check if already linked
    if (user.supplierId) {
      logger.info('User already linked to supplier', {
        userId: user._id.toString(),
        supplierId: user.supplierId,
      });
      
      return {
        supplierId: user.supplierId,
        profileType: user.activeProfile,
        merchantProfile: user.merchantProfiles?.[0],
      };
    }

    // Link to supplier
    const linkResult = await supplierApi.linkConsumerToSupplier({
      consumerUserId: user._id.toString(),
      consumerPhone: user.phone,
      linkCode: params.linkCode,
      businessInfo: params.businessInfo,
    });

    // Update user with supplier_id
    user.supplierId = linkResult.supplierId;
    
    // If link code was used (B2B), add merchant profile and switch to it
    if (params.linkCode && linkResult.merchantId) {
      user.roles.push('merchant');
      user.merchantProfiles.push({
        merchantId: linkResult.merchantId,
        businessName: params.businessInfo?.businessName || 'My Business',
        businessType: params.businessInfo?.businessType,
        taxId: params.businessInfo?.taxId,
        isVerified: false,
        linkedAt: new Date(),
      });
      user.activeProfile = 'merchant';
    }

    await user.save();

    logger.info('User linked to supplier successfully', {
      userId: user._id.toString(),
      supplierId: linkResult.supplierId,
      profileType: user.activeProfile,
    });

    return {
      supplierId: linkResult.supplierId,
      profileType: user.activeProfile,
      merchantProfile: user.merchantProfiles?.[0],
    };
  } catch (error) {
    logger.error('Failed to link user to supplier', { userId, error });
    throw error;
  }
};

/**
 * Verify and apply merchant link code
 * This links a consumer to an existing merchant in the supplier system
 */
export const verifyAndApplyLinkCode = async (
  userId: string,
  linkCode: string
): Promise<{
  success: boolean;
  merchantInfo: any;
  supplierId: string;
}> => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new BusinessLogicError('User not found', 'USER_NOT_FOUND');
    }

    // Verify link code with supplier
    const verifyResult = await supplierApi.verifyMerchantLinkCode({
      linkCode,
      consumerUserId: user._id.toString(),
      consumerPhone: user.phone,
    });

    if (!verifyResult.valid) {
      throw new ValidationError('Invalid or expired link code');
    }

    // Update user
    user.supplierId = verifyResult.supplierId;
    
    // Add merchant profile if not already present
    const existingProfile = user.merchantProfiles.find(
      (p) => p.merchantId === verifyResult.merchantId
    );

    if (!existingProfile) {
      user.roles.push('merchant');
      user.merchantProfiles.push({
        merchantId: verifyResult.merchantId,
        businessName: verifyResult.businessName,
        businessType: verifyResult.businessType,
        isVerified: true, // Link code verification means it's verified
        linkedAt: new Date(),
      });
    }

    // Switch to merchant profile
    user.activeProfile = 'merchant';
    await user.save();

    logger.info('Link code applied successfully', {
      userId: user._id.toString(),
      merchantId: verifyResult.merchantId,
      supplierId: verifyResult.supplierId,
    });

    return {
      success: true,
      merchantInfo: verifyResult,
      supplierId: verifyResult.supplierId,
    };
  } catch (error) {
    logger.error('Failed to verify and apply link code', { userId, linkCode, error });
    throw error;
  }
};

// ============================================================================
// PROFILE MANAGEMENT
// ============================================================================

/**
 * Get current user profile type and determine pricing tier
 */
export const getUserProfileContext = async (
  userId: string
): Promise<{
  profileType: 'personal' | 'merchant';
  priceType: 'retail' | 'wholesale';
  supplierId?: string;
  merchantProfile?: any;
  canAccessWholesale: boolean;
}> => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new BusinessLogicError('User not found', 'USER_NOT_FOUND');
    }

    const profileType = user.activeProfile;
    const priceType = profileType === 'merchant' ? 'wholesale' : 'retail';
    const canAccessWholesale = user.canAccessMerchantProfile();

    return {
      profileType,
      priceType,
      supplierId: user.supplierId,
      merchantProfile:
        profileType === 'merchant'
          ? user.merchantProfiles?.[0]
          : undefined,
      canAccessWholesale,
    };
  } catch (error) {
    logger.error('Failed to get user profile context', { userId, error });
    throw error;
  }
};

/**
 * Switch user profile (personal <-> merchant)
 * This changes the pricing tier they see
 */
export const switchProfile = async (
  userId: string,
  targetProfile: 'personal' | 'merchant'
): Promise<{
  success: boolean;
  activeProfile: 'personal' | 'merchant';
  priceType: 'retail' | 'wholesale';
}> => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new BusinessLogicError('User not found', 'USER_NOT_FOUND');
    }

    // Validate profile switch
    if (targetProfile === 'merchant' && !user.canAccessMerchantProfile()) {
      throw new ValidationError(
        'User does not have merchant profile access. Please link a merchant account first.'
      );
    }

    // Switch profile
    user.activeProfile = targetProfile;
    await user.save();

    const priceType = targetProfile === 'merchant' ? 'wholesale' : 'retail';

    logger.info('User profile switched', {
      userId: user._id.toString(),
      activeProfile: targetProfile,
      priceType,
    });

    return {
      success: true,
      activeProfile: targetProfile,
      priceType,
    };
  } catch (error) {
    logger.error('Failed to switch profile', { userId, targetProfile, error });
    throw error;
  }
};

// ============================================================================
// MERCHANT PROFILE MANAGEMENT
// ============================================================================

/**
 * Update merchant profile information
 */
export const updateMerchantProfile = async (
  userId: string,
  updates: {
    businessName?: string;
    businessType?: string;
    taxId?: string;
  }
): Promise<IUser> => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new BusinessLogicError('User not found', 'USER_NOT_FOUND');
    }

    if (!user.canAccessMerchantProfile()) {
      throw new ValidationError('User does not have merchant profile');
    }

    // Update first merchant profile
    const merchantProfile = user.merchantProfiles[0];
    if (updates.businessName) merchantProfile.businessName = updates.businessName;
    if (updates.businessType) merchantProfile.businessType = updates.businessType;
    if (updates.taxId) merchantProfile.taxId = updates.taxId;

    await user.save();

    logger.info('Merchant profile updated', {
      userId: user._id.toString(),
      merchantId: merchantProfile.merchantId,
    });

    return user;
  } catch (error) {
    logger.error('Failed to update merchant profile', { userId, error });
    throw error;
  }
};

/**
 * Get merchant profile details from Supplier system
 */
export const getMerchantProfileDetails = async (
  userId: string
): Promise<any> => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new BusinessLogicError('User not found', 'USER_NOT_FOUND');
    }

    if (!user.supplierId) {
      throw new ValidationError('User is not linked to supplier system');
    }

    const supplierProfile = await supplierApi.getSupplierProfile(user.supplierId);

    return {
      ...supplierProfile,
      localProfile: user.merchantProfiles?.[0],
    };
  } catch (error) {
    logger.error('Failed to get merchant profile details', { userId, error });
    throw error;
  }
};

// ============================================================================
// PRICING HELPERS
// ============================================================================

/**
 * Determine what price type a user should see for products
 */
export const determineUserPriceType = (user: IUser): 'retail' | 'wholesale' => {
  return user.activeProfile === 'merchant' ? 'wholesale' : 'retail';
};

/**
 * Check if user can access wholesale prices
 */
export const canAccessWholesalePricing = (user: IUser): boolean => {
  return user.canAccessMerchantProfile() && user.activeProfile === 'merchant';
};

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that a user can place an order with the specified price type
 */
export const validateOrderPriceType = (
  user: IUser,
  priceType: 'retail' | 'wholesale'
): boolean => {
  if (priceType === 'retail') {
    return true; // Anyone can use retail prices
  }

  // Wholesale requires merchant profile
  return canAccessWholesalePricing(user);
};

// ============================================================================
// EXPORT
// ============================================================================

export default {
  linkToSupplier,
  verifyAndApplyLinkCode,
  getUserProfileContext,
  switchProfile,
  updateMerchantProfile,
  getMerchantProfileDetails,
  determineUserPriceType,
  canAccessWholesalePricing,
  validateOrderPriceType,
};

