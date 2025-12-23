import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessTokenPayload } from '../utils/jwt';
import User, { IUser } from '../models/User';
import { InvalidTokenError, AuthenticationError } from '../utils/errors';
import logger from '../utils/logger';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      tokenPayload?: AccessTokenPayload;
    }
  }
}

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new InvalidTokenError('No token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const payload = verifyAccessToken(token);

    // Get user from database
    const user = await User.findById(payload.userId);

    if (!user || user.isDeleted) {
      throw new AuthenticationError(
        'User not found or account deactivated',
        'USER_NOT_FOUND'
      );
    }

    // Attach user and payload to request
    req.user = user;
    req.tokenPayload = payload;

    next();
  } catch (error) {
    if (error instanceof InvalidTokenError || error instanceof AuthenticationError) {
      res.status(401).json({
        error: {
          code: error.code || 'AUTHENTICATION_FAILED',
          message: error.message,
          statusCode: 401,
        },
      });
    } else {
      logger.error('Authentication middleware error', { error });
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Authentication failed',
          statusCode: 500,
        },
      });
    }
  }
};

/**
 * Optional Authentication
 * Attaches user if token is valid, but doesn't fail if missing
 */
export const optionalAuthenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.userId);

      if (user && !user.isDeleted) {
        req.user = user;
        req.tokenPayload = payload;
      }
    }

    next();
  } catch (error) {
    // Silently fail for optional auth
    next();
  }
};

/**
 * Require specific roles
 */
export const requireRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
          statusCode: 401,
        },
      });
      return;
    }

    const hasRole = roles.some((role) => req.user!.roles.includes(role));

    if (!hasRole) {
      res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions',
          statusCode: 403,
          details: {
            requiredRoles: roles,
            userRoles: req.user.roles,
          },
        },
      });
      return;
    }

    next();
  };
};

/**
 * Require merchant profile access
 */
export const requireMerchantProfile = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
        statusCode: 401,
      },
    });
    return;
  }

  if (!req.user.canAccessMerchantProfile()) {
    res.status(403).json({
      error: {
        code: 'MERCHANT_PROFILE_REQUIRED',
        message: 'Merchant profile access required',
        statusCode: 403,
      },
    });
    return;
  }

  next();
};

