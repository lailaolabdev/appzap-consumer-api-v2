import { Request, Response } from 'express';
import User from '../models/User';
import LoyaltyTransaction from '../models/LoyaltyTransaction';
import * as authApiService from '../services/authApi.service';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { redisHelpers } from '../config/redis';
import logger, { maskPhone } from '../utils/logger';
import { InvalidOTPError, InvalidTokenError, ValidationError } from '../utils/errors';
import config from '../config/env';
import { phoneUtils } from '../utils/helpers';
import axios from 'axios';
import DeviceToken from '../models/DeviceToken';

/**
 * Request OTP
 * POST /v1/auth/request-otp
 */
export const requestOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, platform, header } = req.body;

    // Validate phone format
    if (!phone || !phoneUtils.isValidLaoPhone(phone)) {
      throw new ValidationError('Invalid Lao phone number format', { field: 'phone' });
    }

    const normalizedPhone = phoneUtils.normalize(phone);

    // Forward to Auth API
    const result = await authApiService.requestOTP({
      phone: normalizedPhone,
      platform: platform || 'APPZAP',
      header: header || 'AppZap',
    });

    if (!result.success) {
      throw new Error(result.message);
    }

    // Log for security monitoring
    logger.info('OTP requested', {
      phone: maskPhone(normalizedPhone),
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({
      success: true,
      message: result.message,
      referenceId: result.referenceId,
      expiresIn: result.expiresIn,
    });
  } catch (error: any) {
    logger.error('OTP request failed', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'OTP_REQUEST_FAILED',
        message: error.message || 'Failed to send OTP',
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Verify OTP & Login
 * POST /v1/auth/verify-otp
 */
export const verifyOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, otp } = req.body;

    // Validate inputs
    if (!phone || !otp) {
      throw new ValidationError('Phone and OTP are required', {
        fields: ['phone', 'otp'],
      });
    }

    if (!phoneUtils.isValidLaoPhone(phone)) {
      throw new ValidationError('Invalid phone number format', { field: 'phone' });
    }

    const normalizedPhone = phoneUtils.normalize(phone);

    // Verify with Auth API
    const authResult = await authApiService.verifyOTP({
      phone: normalizedPhone,
      otp,
    });

    if (!authResult.success) {
      throw new InvalidOTPError(authResult.message);
    }

    // Find or create user in Consumer DB
    let user = await User.findOne({ phone: normalizedPhone });

    if (!user) {
      // Create new user
      user = await User.create({
        phone: normalizedPhone,
        authProviderId: authResult.user?.id,
        fullName: authResult.user?.nickName || undefined,
        email: undefined, // Email not provided by Auth API
        roles: ['consumer'],
        activeProfile: 'personal',
        points: { balance: 0, tier: 'bronze', totalEarned: 0, totalRedeemed: 0 },
        firstLogin: true,
        hasCompletedOnboarding: false,
      });

      // Create initial loyalty transaction
      await LoyaltyTransaction.create({
        userId: user._id,
        type: 'bonus',
        amount: 0,
        source: 'welcome_bonus',
        description: 'Account created',
        balanceBefore: 0,
        balanceAfter: 0,
      });

      logger.info('New user created', {
        userId: user._id.toString(),
        phone: maskPhone(normalizedPhone),
      });
    } else {
      // Update existing user
      user.lastLogin = new Date();
      user.firstLogin = false;
      await user.save();
    }

    // Generate JWT tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user._id.toString());

    // Store refresh token in Redis (token rotation)
    await redisHelpers.setWithTTL(
      `refresh:${user._id}`,
      refreshToken,
      30 * 24 * 60 * 60 // 30 days
    );

    // Log successful login
    logger.info('User logged in', {
      userId: user._id.toString(),
      phone: maskPhone(normalizedPhone),
      ip: req.ip,
      firstLogin: user.firstLogin,
    });

    // Feature 15: Cross-Cluster SSO (AppZap Market Integration)
    let marketAccessToken = null;
    try {
      // 1. Fire the internal Server-to-Server webhook
      const marketSsoResponse = await axios.post(
        `${process.env.SUPPLIER_API_URL || 'http://localhost:5004'}/api/internal/sso/hydrate`,
        {
          phone: normalizedPhone,
          nickname: user.nickname || 'AppZap User',
        },
        {
          headers: {
            'X-Cluster-Auth': process.env.INTERNAL_CLUSTER_SECRET || 'appzap_eat_market_sso_secret',
            'Content-Type': 'application/json',
          },
          timeout: 2500, // 2.5 second hard limit to prevent Eat login from hanging
        }
      );

      // 2. Extract the Market JWT
      if (marketSsoResponse.data && marketSsoResponse.data.token) {
        marketAccessToken = marketSsoResponse.data.token;
      }
    } catch (ssoError: any) {
      // Graceful degradation: If Market API is down, Eat login still succeeds.
      logger.error('Market SSO Bridge Failed', {
        userId: user._id.toString(),
        error: ssoError.message
      });
    }

    res.json({
      accessToken,
      refreshToken,
      marketAccessToken, // Returned flawlessly to the Flutter app
      user: user.toJSON(),
    });
  } catch (error: any) {
    logger.error('OTP verification error', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'VERIFICATION_FAILED',
        message: error.message || 'Failed to verify OTP',
        statusCode: error.statusCode || 500,
        details: error.details,
      },
    });
  }
};

/**
 * Refresh Access Token
 * POST /v1/auth/refresh
 */
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      throw new ValidationError('Refresh token is required', { field: 'refreshToken' });
    }

    // Verify refresh token
    const payload = verifyRefreshToken(token);

    // Check if token exists in Redis
    const storedToken = await redisHelpers.get(`refresh:${payload.userId}`);

    if (!storedToken || storedToken !== token) {
      throw new InvalidTokenError('Invalid or expired refresh token');
    }

    // Get user
    const user = await User.findById(payload.userId);

    if (!user || user.isDeleted) {
      throw new InvalidTokenError('User not found');
    }

    // Generate new tokens (token rotation)
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user._id.toString());

    // Store new refresh token and delete old one
    await redisHelpers.setWithTTL(
      `refresh:${user._id}`,
      newRefreshToken,
      30 * 24 * 60 * 60 // 30 days
    );

    logger.info('Token refreshed', { userId: user._id.toString() });

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error: any) {
    logger.error('Token refresh error', { error: error.message });
    res.status(error.statusCode || 401).json({
      error: {
        code: error.code || 'TOKEN_REFRESH_FAILED',
        message: error.message || 'Failed to refresh token',
        statusCode: error.statusCode || 401,
      },
    });
  }
};

/**
 * Get Current User
 * GET /v1/auth/me
 */
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new InvalidTokenError('User not authenticated');
    }

    res.json(req.user.toJSON());
  } catch (error: any) {
    logger.error('Get current user error', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_USER_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Switch Profile (Personal/Merchant)
 * POST /v1/auth/switch-profile
 */
export const switchProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new InvalidTokenError('User not authenticated');
    }

    const { profileType, restaurantId } = req.body;

    if (!profileType || !['personal', 'merchant'].includes(profileType)) {
      throw new ValidationError('Invalid profile type. Must be "personal" or "merchant"', {
        field: 'profileType',
      });
    }

    if (profileType === 'merchant') {
      if (!req.user.canAccessMerchantProfile()) {
        res.status(403).json({
          error: {
            code: 'MERCHANT_PROFILE_REQUIRED',
            message: 'User does not have merchant profile access',
            statusCode: 403,
          },
        });
        return;
      }

      // If specific restaurant ID provided, validate it
      if (restaurantId) {
        const hasRestaurant = req.user.merchantProfiles.some(
          (p) => p.restaurantId === restaurantId
        );
        if (!hasRestaurant) {
          res.status(404).json({
            error: {
              code: 'RESTAURANT_NOT_FOUND',
              message: 'Restaurant not found in user profiles',
              statusCode: 404,
            },
          });
          return;
        }
      }
    }

    // Switch profile
    await req.user.switchProfile(profileType);

    const activeProfileDetails = req.user.getActiveProfileDetails();

    logger.info('Profile switched', {
      userId: req.user._id.toString(),
      profileType,
      restaurantId: activeProfileDetails?.restaurantId,
    });

    res.json({
      message: 'Profile switched successfully',
      activeProfile: {
        type: profileType,
        ...(activeProfileDetails && {
          restaurantId: activeProfileDetails.restaurantId,
          restaurantName: activeProfileDetails.restaurantName,
          role: activeProfileDetails.role,
        }),
      },
      marketContext: {
        viewMode: profileType === 'personal' ? 'retail' : 'wholesale',
        priceType: profileType === 'personal' ? 'b2c' : 'b2b',
        creditTermsAvailable: profileType === 'merchant',
      },
    });
  } catch (error: any) {
    logger.error('Switch profile error', { error: error.message });
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
 * Update User Demographics (Feature 04)
 * PATCH /v1/auth/demographics
 */
export const updateDemographics = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new InvalidTokenError('User not authenticated');
    }

    const { nickname, yearOfBirth, sex } = req.body;

    // Strict validation
    if (nickname) req.user.nickname = nickname;
    if (yearOfBirth) {
      const parsedYear = parseInt(yearOfBirth);
      if (parsedYear > 1900 && parsedYear <= new Date().getFullYear()) {
        req.user.yearOfBirth = parsedYear;
      } else {
        throw new ValidationError('Invalid year of birth', { field: 'yearOfBirth' });
      }
    }
    if (sex) {
      if (['M', 'F', 'O'].includes(sex)) {
        req.user.sex = sex as 'M' | 'F' | 'O';
      } else {
        throw new ValidationError('Invalid sex. Must be M, F, or O', { field: 'sex' });
      }
    }

    await req.user.save();

    logger.info('Demographics updated', { userId: req.user._id.toString() });

    res.json({
      success: true,
      message: 'Demographics updated successfully',
      user: req.user.toJSON(),
    });
  } catch (error: any) {
    logger.error('Update demographics error', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'UPDATE_DEMOGRAPHICS_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Logout
 * POST /v1/auth/logout
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new InvalidTokenError('User not authenticated');
    }

    // Feature 14: Blacklist access token JTI (JWTs can't be destroyed otherwise)
    const payload = (req as any).tokenPayload;
    if (payload?.jti && payload?.exp) {
      const ttlSeconds = Math.max(1, payload.exp - Math.floor(Date.now() / 1000));
      await redisHelpers.setWithTTL(`blacklist:jti:${payload.jti}`, '1', ttlSeconds);
    }

    // Delete refresh token from Redis
    await redisHelpers.del(`refresh:${req.user._id}`);

    logger.info('User logged out', { userId: req.user._id.toString() });

    res.json({
      message: 'Logged out successfully',
    });
  } catch (error: any) {
    logger.error('Logout error', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'LOGOUT_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Account Deletion & Anonymization (Feature 14)
 * DELETE /v1/auth/account
 */
export const deleteAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new InvalidTokenError('User not authenticated');
    }

    // 1. Blacklist the active access token JTI + refresh token instantly
    const payload = (req as any).tokenPayload;
    if (payload?.jti && payload?.exp) {
      const ttlSeconds = Math.max(1, payload.exp - Math.floor(Date.now() / 1000));
      await redisHelpers.setWithTTL(`blacklist:jti:${payload.jti}`, '1', ttlSeconds);
    }
    await redisHelpers.del(`refresh:${req.user._id}`);

    // 2. Execute the atomic anonymization script (preserve _id for historical integrity)
    const deletedPhone = `DELETED_${req.user._id}_${Date.now()}`;
    await User.updateOne(
      { _id: req.user._id },
      {
        $set: {
          phone: deletedPhone,
          nickname: 'AppZap User',
          fullName: undefined,
          yearOfBirth: undefined,
          sex: undefined,
          email: undefined,
          isDeleted: true,
          deletedAt: new Date(),
          'preferences.language': req.user.preferences?.language || 'en',
          pushTokens: [],
        },
      }
    );

    // 3. Prune push tokens (Admin must not message deleted users)
    await DeviceToken.deleteMany({ user: req.user._id });

    logger.warn('User Account Deleted & Anonymized', {
      userId: req.user._id.toString(),
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Account permanently deleted. Historical data has been anonymized.',
    });
  } catch (error: any) {
    logger.error('Account deletion error', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'ACCOUNT_DELETION_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};


