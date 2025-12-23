import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/env';
import { InvalidTokenError } from './errors';

export interface AccessTokenPayload {
  userId: string;
  phone: string;
  roles: string[];
  activeProfile: 'personal' | 'merchant';
  type: 'access';
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
  type: 'refresh';
}

/**
 * Generate Access Token (24h expiry)
 */
export const generateAccessToken = (user: {
  _id: string;
  phone: string;
  roles: string[];
  activeProfile: 'personal' | 'merchant';
}): string => {
  const payload: AccessTokenPayload = {
    userId: user._id.toString(),
    phone: user.phone,
    roles: user.roles,
    activeProfile: user.activeProfile,
    type: 'access',
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiry,
    issuer: 'appzap-consumer-api',
    audience: 'appzap-mobile-app',
  });
};

/**
 * Generate Refresh Token (30d expiry)
 */
export const generateRefreshToken = (userId: string): string => {
  const payload: RefreshTokenPayload = {
    userId,
    tokenId: uuidv4(), // Unique token ID for rotation
    type: 'refresh',
  };

  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiry,
    issuer: 'appzap-consumer-api',
    audience: 'appzap-mobile-app',
  });
};

/**
 * Verify Access Token
 */
export const verifyAccessToken = (token: string): AccessTokenPayload => {
  try {
    const decoded = jwt.verify(token, config.jwt.secret, {
      issuer: 'appzap-consumer-api',
      audience: 'appzap-mobile-app',
    }) as AccessTokenPayload;

    if (decoded.type !== 'access') {
      throw new InvalidTokenError('Invalid token type');
    }

    return decoded;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new InvalidTokenError('Token has expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new InvalidTokenError('Invalid token');
    }
    throw error;
  }
};

/**
 * Verify Refresh Token
 */
export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  try {
    const decoded = jwt.verify(token, config.jwt.refreshSecret, {
      issuer: 'appzap-consumer-api',
      audience: 'appzap-mobile-app',
    }) as RefreshTokenPayload;

    if (decoded.type !== 'refresh') {
      throw new InvalidTokenError('Invalid token type');
    }

    return decoded;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new InvalidTokenError('Refresh token has expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new InvalidTokenError('Invalid refresh token');
    }
    throw error;
  }
};

/**
 * Decode token without verification (for debugging)
 */
export const decodeToken = (token: string): any => {
  return jwt.decode(token);
};

export default {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
};

