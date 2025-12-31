import { Router } from 'express';
import * as identityLinkingController from '../controllers/identityLinking.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// ============================================================================
// IDENTITY LINKING (B2C <-> B2B)
// ============================================================================

/**
 * @route   POST /api/v1/identity/link-supplier
 * @desc    Link user to Supplier system (creates supplier_id)
 * @access  Private
 * @body    linkCode?, businessInfo?
 */
router.post('/link-supplier', authenticate, identityLinkingController.linkToSupplier);

/**
 * @route   POST /api/v1/identity/verify-link-code
 * @desc    Verify and apply merchant link code
 * @access  Private
 * @body    linkCode
 */
router.post('/verify-link-code', authenticate, identityLinkingController.verifyLinkCode);

/**
 * @route   POST /api/v1/identity/verify-restaurant-code
 * @desc    Verify restaurant link code from POS V2
 * @access  Private
 * @body    linkCode
 */
router.post('/verify-restaurant-code', authenticate, identityLinkingController.verifyRestaurantLinkCode);

/**
 * @route   GET /api/v1/identity/profile-context
 * @desc    Get current user profile context (B2C or B2B)
 * @access  Private
 */
router.get('/profile-context', authenticate, identityLinkingController.getProfileContext);

/**
 * @route   POST /api/v1/identity/switch-profile
 * @desc    Switch between personal and merchant profiles
 * @access  Private
 * @body    targetProfile ('personal' or 'merchant')
 */
router.post('/switch-profile', authenticate, identityLinkingController.switchProfile);

/**
 * @route   GET /api/v1/identity/merchant-profile
 * @desc    Get merchant profile details
 * @access  Private
 */
router.get('/merchant-profile', authenticate, identityLinkingController.getMerchantProfile);

/**
 * @route   PUT /api/v1/identity/merchant-profile
 * @desc    Update merchant profile information
 * @access  Private
 * @body    businessName?, businessType?, taxId?
 */
router.put('/merchant-profile', authenticate, identityLinkingController.updateMerchantProfile);

export default router;


