// @ts-nocheck
import { Request, Response } from 'express';
import * as deepLinkService from '../services/deepLink.service';
import * as spinToWinService from '../services/spinToWin.service';
import * as pushNotificationService from '../services/pushNotification.service';
import DeepLink from '../models/DeepLink';
import Order from '../models/Order';
import MarketOrder from '../models/MarketOrder';
import logger from '../utils/logger';
import { ValidationError, NotFoundError } from '../utils/errors';

// ============================================================================
// DEEP LINK CREATION
// ============================================================================

/**
 * Create Deep Link
 * POST /api/v1/deep-links
 */
export const createDeepLink = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { targetType, targetId, campaignId, campaignName, source, medium, metadata, expiresInDays } = req.body;

    if (!targetType || !targetId) {
      throw new ValidationError('targetType and targetId are required');
    }

    const deepLink = await deepLinkService.createDeepLink({
      targetType,
      targetId,
      userId: req.user._id.toString(),
      campaignId,
      campaignName,
      source,
      medium,
      metadata,
      expiresInDays,
    });

    res.json({
      success: true,
      deepLink,
    });
  } catch (error: any) {
    logger.error('Failed to create deep link', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'CREATE_DEEP_LINK_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

// ============================================================================
// DEEP LINK REDIRECT (Web Handler)
// ============================================================================

/**
 * Handle Deep Link Click (Web)
 * GET /links/:shortCode
 */
export const handleDeepLinkRedirect = async (req: Request, res: Response): Promise<void> => {
  try {
    const { shortCode } = req.params;

    const deepLink = await DeepLink.findOne({ shortCode, isActive: true });

    if (!deepLink) {
      throw new NotFoundError('Deep link', shortCode);
    }

    if (deepLink.isExpired()) {
      return res.status(410).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Link Expired</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>😔 Link Expired</h1>
          <p>This link has expired. Please request a new one.</p>
        </body>
        </html>
      `);
    }

    // Track click
    await deepLinkService.trackClick(shortCode, true);

    // Generate app download page with spin-to-win incentive
    const htmlContent = generateAppDownloadPage(deepLink);

    res.send(htmlContent);
  } catch (error: any) {
    logger.error('Deep link redirect failed', { error: error.message });
    res.status(error.statusCode || 500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body style="font-family: Arial; text-align: center; padding: 50px;">
        <h1>❌ Error</h1>
        <p>${error.message}</p>
      </body>
      </html>
    `);
  }
};

/**
 * Generate App Download Page
 */
const generateAppDownloadPage = (deepLink: any): string => {
  const orderType = deepLink.targetType;
  const targetId = deepLink.targetId;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Download AppZap & Spin to Win! 🎰</title>
      <meta property="og:title" content="🎉 Your Order is Ready! Spin to Win FREE Rewards!">
      <meta property="og:description" content="Download the AppZap app and spin the wheel to win FREE beer, discounts & more! 🍺🎁">
      <meta property="og:image" content="${process.env.CDN_URL || 'https://appzap.la'}/assets/spin-to-win.gif">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 20px;
          padding: 40px 30px;
          max-width: 500px;
          width: 100%;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .spin-icon {
          font-size: 80px;
          animation: spin 3s linear infinite;
          display: inline-block;
          margin-bottom: 20px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        h1 {
          color: #667eea;
          font-size: 28px;
          margin-bottom: 10px;
        }
        .subtitle {
          color: #666;
          font-size: 16px;
          margin-bottom: 30px;
        }
        .prize-list {
          background: #f8f9fa;
          border-radius: 15px;
          padding: 20px;
          margin: 30px 0;
          text-align: left;
        }
        .prize-item {
          padding: 12px 0;
          border-bottom: 1px solid #e0e0e0;
          font-size: 14px;
          color: #333;
        }
        .prize-item:last-child {
          border-bottom: none;
        }
        .prize-icon {
          margin-right: 10px;
          font-size: 20px;
        }
        .download-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 18px 40px;
          border-radius: 50px;
          text-decoration: none;
          display: inline-block;
          font-size: 18px;
          font-weight: bold;
          margin: 20px 0;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
        }
        .download-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 15px 40px rgba(102, 126, 234, 0.6);
        }
        .order-info {
          background: #e8f5e9;
          padding: 15px;
          border-radius: 10px;
          margin-bottom: 20px;
          color: #2e7d32;
          font-size: 14px;
        }
        .footer {
          margin-top: 30px;
          color: #999;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="spin-icon">🎰</div>
        <h1>Spin to Win FREE Rewards!</h1>
        <p class="subtitle">Download AppZap and win amazing prizes!</p>
        
        <div class="order-info">
          ✅ Your ${orderType} order is confirmed!
        </div>

        <div class="prize-list">
          <div class="prize-item">
            <span class="prize-icon">🍺</span>
            <strong>FREE Beer</strong> on your next order
          </div>
          <div class="prize-item">
            <span class="prize-icon">💰</span>
            <strong>Up to 20,000 LAK</strong> discount
          </div>
          <div class="prize-item">
            <span class="prize-icon">🎁</span>
            <strong>Bonus Loyalty Points</strong> (200-500)
          </div>
          <div class="prize-item">
            <span class="prize-icon">🎉</span>
            <strong>Exclusive Vouchers</strong> & more!
          </div>
        </div>

        <a href="${deepLink.firebaseDynamicLink || deepLink.androidLink}" class="download-btn">
          📱 Download App & Spin Now!
        </a>

        <p class="footer">
          Your spin expires in 30 days. Don't miss out!<br>
          Order ID: ${targetId}
        </p>
      </div>

      <script>
        // Auto-redirect to app if installed
        setTimeout(() => {
          window.location.href = '${deepLink.longUrl}';
        }, 2000);

        // Fallback to store if app not installed
        setTimeout(() => {
          const isAndroid = /Android/i.test(navigator.userAgent);
          const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
          
          if (isAndroid) {
            window.location.href = 'https://play.google.com/store/apps/details?id=la.appzap.consumer';
          } else if (isIOS) {
            window.location.href = 'https://apps.apple.com/app/appzap/id1234567890';
          }
        }, 3000);
      </script>
    </body>
    </html>
  `;
};

// ============================================================================
// DEEP LINK TRACKING
// ============================================================================

/**
 * Track Deep Link Open
 * POST /api/v1/deep-links/:shortCode/track-open
 */
export const trackDeepLinkOpen = async (req: Request, res: Response): Promise<void> => {
  try {
    const { shortCode } = req.params;
    const { deviceInfo } = req.body;

    const deepLink = await deepLinkService.trackOpen(shortCode, deviceInfo);

    res.json({
      success: true,
      deepLink: {
        shortCode: deepLink.shortCode,
        targetType: deepLink.targetType,
        targetId: deepLink.targetId,
        metadata: deepLink.metadata,
      },
    });
  } catch (error: any) {
    logger.error('Failed to track deep link open', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'TRACK_OPEN_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Track Deep Link Conversion
 * POST /api/v1/deep-links/:shortCode/track-conversion
 */
export const trackDeepLinkConversion = async (req: Request, res: Response): Promise<void> => {
  try {
    const { shortCode } = req.params;
    const { value } = req.body;

    const deepLink = await deepLinkService.trackConversion(shortCode, value);

    res.json({
      success: true,
      conversion: {
        completed: true,
        value: deepLink.attribution.conversionValue,
      },
    });
  } catch (error: any) {
    logger.error('Failed to track conversion', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'TRACK_CONVERSION_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * Get Deep Link Analytics
 * GET /api/v1/deep-links/analytics
 */
export const getDeepLinkAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { campaignId, startDate, endDate } = req.query;

    const analytics = await deepLinkService.getDeepLinkAnalytics({
      userId: req.user._id.toString(),
      campaignId: campaignId as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json(analytics);
  } catch (error: any) {
    logger.error('Failed to get analytics', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_ANALYTICS_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

export default {
  createDeepLink,
  handleDeepLinkRedirect,
  trackDeepLinkOpen,
  trackDeepLinkConversion,
  getDeepLinkAnalytics,
};

