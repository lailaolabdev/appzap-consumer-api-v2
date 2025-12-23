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
 * @route   POST /v1/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticate, authController.logout);

export default router;

