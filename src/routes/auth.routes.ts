import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import {
  otpRequestRateLimiter,
  otpVerifyRateLimiter,
  strictRateLimiter,
} from '../middleware/rateLimit.middleware';

const router = Router();

/**
 * @route   POST /v1/auth/request-otp
 * @desc    Request OTP for login
 * @access  Public
 */
router.post('/request-otp', otpRequestRateLimiter, authController.requestOTP);

/**
 * @route   POST /v1/auth/verify-otp
 * @desc    Verify OTP and login
 * @access  Public
 */
router.post('/verify-otp', otpVerifyRateLimiter, authController.verifyOTP);

/**
 * @route   POST /v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', strictRateLimiter, authController.refreshToken);

/**
 * @route   GET /v1/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, authController.getCurrentUser);

/**
 * @route   POST /v1/auth/switch-profile
 * @desc    Switch between personal and merchant profile
 * @access  Private
 */
router.post('/switch-profile', authenticate, authController.switchProfile);

/**
 * @route   PATCH /v1/auth/demographics
 * @desc    Update Nickname, Year of Birth, and Sex (Feature 04)
 * @access  Private
 */
router.patch('/demographics', authenticate, authController.updateDemographics);

/**
 * @route   POST /v1/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @route   DELETE /v1/auth/account
 * @desc    Permanently delete and anonymize user account (Feature 14)
 * @access  Private
 */
router.delete('/account', authenticate, authController.deleteAccount);

export default router;


