import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

/**
 * Feature 04: Demographic Enforcement Firewall
 * 
 * To ensure high-quality data for the Admin Dashboard and targeted AppZap Ads,
 * this middleware violently intercepts requests to any Phase 2 (Write-Heavy) endpoints
 * if the user has not yet populated their core demographic profile.
 */
export const enforceDemographics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required to access this resource.',
          statusCode: 401,
        },
      });
      return;
    }

    // Explicit check for the three mandatory fields
    const missingFields: string[] = [];
    
    // In MongoDB, empty strings or nulls count as missing
    if (!user.nickname || user.nickname.trim() === '') missingFields.push('nickname');
    if (!user.yearOfBirth) missingFields.push('yearOfBirth');
    if (!user.sex || !['M', 'F', 'O'].includes(user.sex)) missingFields.push('sex');

    if (missingFields.length > 0) {
      logger.warn('Demographic Firewall Triggered', { 
        userId: user._id.toString(), 
        missingFields 
      });

      res.status(403).json({
        error: {
          code: 'INCOMPLETE_DEMOGRAPHICS',
          message: 'You must complete your user profile before accessing this feature.',
          statusCode: 403,
          requiredFields: missingFields,
          actionRequired: 'PATCH /api/v1/user/demographics'
        },
      });
      return;
    }

    // User is fully compliant, allow them into Phase 2 endpoints
    next();
  } catch (error: any) {
    logger.error('Demographic Firewall Error', { error: error.message });
    res.status(500).json({
      error: {
        code: 'FIREWALL_ERROR',
        message: 'Internal server error during demographic validation.',
        statusCode: 500,
      },
    });
  }
};
