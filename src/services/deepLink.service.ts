import DeepLink from '../models/DeepLink';
import { codeGenerators } from '../utils/helpers';
import logger from '../utils/logger';
import config from '../config/env';
import axios from 'axios';

/**
 * Deep Link Service
 * Creates and manages Firebase Dynamic Links for app downloads and deep linking
 */

// ============================================================================
// DEEP LINK CREATION
// ============================================================================

export interface CreateDeepLinkParams {
  targetType: 'order' | 'restaurant' | 'product' | 'subscription' | 'promotion';
  targetId: string;
  userId?: string;
  campaignId?: string;
  campaignName?: string;
  source?: string;
  medium?: string;
  metadata?: Record<string, any>;
  expiresInDays?: number;
}

/**
 * Create a deep link for any target
 */
export const createDeepLink = async (params: CreateDeepLinkParams) => {
  try {
    // Generate short code
    const shortCode = codeGenerators.orderCode('DL').toLowerCase();

    // Build the deep link URL
    const appScheme = 'appzap://';
    let deepLinkPath = '';

    switch (params.targetType) {
      case 'order':
        deepLinkPath = `orders/${params.targetId}`;
        break;
      case 'restaurant':
        deepLinkPath = `restaurants/${params.targetId}`;
        break;
      case 'product':
        deepLinkPath = `products/${params.targetId}`;
        break;
      case 'subscription':
        deepLinkPath = `subscriptions/${params.targetId}`;
        break;
      case 'promotion':
        deepLinkPath = `promotions/${params.targetId}`;
        break;
    }

    const deepLinkUrl = `${appScheme}${deepLinkPath}`;
    const webFallbackUrl = `${config.apiUrl}/links/${shortCode}`;

    // Create Firebase Dynamic Link
    let firebaseDynamicLink = null;
    try {
      firebaseDynamicLink = await createFirebaseDynamicLink({
        shortCode,
        deepLinkUrl,
        fallbackUrl: webFallbackUrl,
        socialTitle: getSocialTitle(params.targetType),
        socialDescription: getSocialDescription(params.targetType, params.targetId),
        campaignName: params.campaignName,
      });
    } catch (error) {
      logger.warn('Failed to create Firebase Dynamic Link, using fallback', { error });
    }

    // Calculate expiration
    const expiresAt = params.expiresInDays
      ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    // Create deep link record
    const deepLink = await DeepLink.create({
      shortCode,
      longUrl: deepLinkUrl,
      targetType: params.targetType,
      targetId: params.targetId,
      userId: params.userId,
      createdBy: params.userId,
      campaignId: params.campaignId,
      campaignName: params.campaignName,
      source: params.source || 'web',
      medium: params.medium,
      firebaseDynamicLink: firebaseDynamicLink?.shortLink,
      androidLink: deepLinkUrl,
      iosLink: deepLinkUrl,
      fallbackUrl: webFallbackUrl,
      metadata: params.metadata,
      expiresAt,
      isActive: true,
    });

    logger.info('Deep link created', {
      shortCode,
      targetType: params.targetType,
      targetId: params.targetId,
      userId: params.userId,
    });

    return {
      shortCode,
      shortLink: `${config.apiUrl}/links/${shortCode}`,
      firebaseDynamicLink: firebaseDynamicLink?.shortLink,
      deepLinkUrl,
      fallbackUrl: webFallbackUrl,
      qrCodeUrl: `${config.apiUrl}/links/${shortCode}/qr`,
      expiresAt,
    };
  } catch (error: any) {
    logger.error('Failed to create deep link', { error: error.message, params });
    throw error;
  }
};

/**
 * Create Firebase Dynamic Link
 */
const createFirebaseDynamicLink = async (params: {
  shortCode: string;
  deepLinkUrl: string;
  fallbackUrl: string;
  socialTitle?: string;
  socialDescription?: string;
  campaignName?: string;
}) => {
  // This is a mock implementation
  // In production, you would use Firebase Dynamic Links API
  // https://firebase.google.com/docs/dynamic-links/rest

  const firebaseApiKey = config.firebase.apiKey;
  const dynamicLinkDomain = config.firebase.dynamicLinkDomain;

  if (!firebaseApiKey || !dynamicLinkDomain) {
    logger.warn('Firebase Dynamic Links not configured');
    return null;
  }

  try {
    const requestBody = {
      dynamicLinkInfo: {
        domainUriPrefix: dynamicLinkDomain,
        link: params.fallbackUrl,
        androidInfo: {
          androidPackageName: 'la.appzap.consumer',
          androidFallbackLink: params.fallbackUrl,
        },
        iosInfo: {
          iosBundleId: 'la.appzap.consumer',
          iosFallbackLink: params.fallbackUrl,
          iosAppStoreId: '1234567890', // Replace with actual App Store ID
        },
        socialMetaTagInfo: {
          socialTitle: params.socialTitle || 'AppZap - Food & Market Delivery',
          socialDescription: params.socialDescription || 'Order now and spin to win!',
          socialImageLink: `${config.apiUrl}/assets/og-image.png`,
        },
        analyticsInfo: {
          googlePlayAnalytics: {
            utmSource: 'appzap',
            utmMedium: 'deeplink',
            utmCampaign: params.campaignName || 'order_download',
          },
        },
      },
      suffix: {
        option: 'SHORT',
      },
    };

    const response = await axios.post(
      `https://firebasedynamiclinks.googleapis.com/v1/shortLinks?key=${firebaseApiKey}`,
      requestBody
    );

    return {
      shortLink: response.data.shortLink,
      previewLink: response.data.previewLink,
    };
  } catch (error: any) {
    logger.error('Firebase Dynamic Link creation failed', {
      error: error.message,
      response: error.response?.data,
    });
    return null;
  }
};

// ============================================================================
// ORDER DEEP LINKS (Special for web-to-app conversion)
// ============================================================================

/**
 * Create deep link for order (with spin-to-win incentive)
 */
export const createOrderDeepLink = async (params: {
  orderId: string;
  userId: string;
  orderType: 'eats' | 'market';
  orderTotal: number;
}) => {
  const deepLink = await createDeepLink({
    targetType: 'order',
    targetId: params.orderId,
    userId: params.userId,
    campaignId: 'web_to_app_order',
    campaignName: 'Web Order Download Incentive',
    source: 'web',
    medium: 'order_confirmation',
    metadata: {
      orderType: params.orderType,
      orderTotal: params.orderTotal,
      hasSpinReward: true,
    },
    expiresInDays: 30,
  });

  logger.info('Order deep link created with spin-to-win', {
    orderId: params.orderId,
    userId: params.userId,
    shortLink: deepLink.shortLink,
  });

  return deepLink;
};

// ============================================================================
// DEEP LINK TRACKING
// ============================================================================

/**
 * Track deep link click
 */
export const trackClick = async (shortCode: string, isUnique: boolean = false) => {
  const deepLink = await DeepLink.findOne({ shortCode, isActive: true });
  if (!deepLink) {
    throw new Error('Deep link not found');
  }

  await deepLink.trackClick(isUnique);

  logger.info('Deep link clicked', {
    shortCode,
    clicks: deepLink.clicks,
    uniqueClicks: deepLink.uniqueClicks,
  });

  return deepLink;
};

/**
 * Track deep link open in app
 */
export const trackOpen = async (shortCode: string, deviceInfo?: any) => {
  const deepLink = await DeepLink.findOne({ shortCode, isActive: true });
  if (!deepLink) {
    throw new Error('Deep link not found');
  }

  await deepLink.trackOpen(deviceInfo);

  logger.info('Deep link opened in app', {
    shortCode,
    deviceInfo,
  });

  return deepLink;
};

/**
 * Track conversion (e.g., first order after app download)
 */
export const trackConversion = async (shortCode: string, value?: number) => {
  const deepLink = await DeepLink.findOne({ shortCode, isActive: true });
  if (!deepLink) {
    throw new Error('Deep link not found');
  }

  await deepLink.trackConversion(value);

  logger.info('Deep link conversion tracked', {
    shortCode,
    value,
  });

  return deepLink;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getSocialTitle = (targetType: string): string => {
  const titles: Record<string, string> = {
    order: '🎉 Your Order is Ready! Download AppZap & Spin to Win!',
    restaurant: '🍽️ Discover Amazing Food on AppZap',
    product: '🛒 Great Deals on AppZap Market',
    subscription: '📅 Manage Your Subscription on AppZap',
    promotion: '🎁 Special Promotion Just for You!',
  };
  return titles[targetType] || 'AppZap - Food & Market Delivery';
};

const getSocialDescription = (targetType: string, targetId: string): string => {
  const descriptions: Record<string, string> = {
    order: 'Track your order and spin the wheel to win FREE beer, discounts, and more! Download the app now.',
    restaurant: 'Order from your favorite restaurants and earn rewards. Download AppZap today!',
    product: 'Shop quality products with exclusive app-only deals. Download now!',
    subscription: 'Never run out! Manage your recurring orders easily on the AppZap app.',
    promotion: 'Claim your special offer in the AppZap app. Limited time only!',
  };
  return descriptions[targetType] || 'Order food and shop products with AppZap!';
};

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * Get deep link analytics
 */
export const getDeepLinkAnalytics = async (params: {
  userId?: string;
  campaignId?: string;
  startDate?: Date;
  endDate?: Date;
}) => {
  const query: any = { isActive: true };

  if (params.userId) query.userId = params.userId;
  if (params.campaignId) query.campaignId = params.campaignId;
  if (params.startDate || params.endDate) {
    query.createdAt = {};
    if (params.startDate) query.createdAt.$gte = params.startDate;
    if (params.endDate) query.createdAt.$lte = params.endDate;
  }

  const deepLinks = await DeepLink.find(query);

  const analytics = {
    totalLinks: deepLinks.length,
    totalClicks: deepLinks.reduce((sum, dl) => sum + dl.clicks, 0),
    totalUniqueClicks: deepLinks.reduce((sum, dl) => sum + dl.uniqueClicks, 0),
    totalOpens: deepLinks.filter((dl) => dl.attribution.opened).length,
    totalConversions: deepLinks.filter((dl) => dl.attribution.conversionCompleted).length,
    conversionValue: deepLinks.reduce((sum, dl) => sum + (dl.attribution.conversionValue || 0), 0),
    byTargetType: {} as Record<string, number>,
    byCampaign: {} as Record<string, number>,
  };

  // Group by target type
  deepLinks.forEach((dl) => {
    analytics.byTargetType[dl.targetType] = (analytics.byTargetType[dl.targetType] || 0) + 1;
  });

  // Group by campaign
  deepLinks.forEach((dl) => {
    if (dl.campaignId) {
      analytics.byCampaign[dl.campaignId] = (analytics.byCampaign[dl.campaignId] || 0) + 1;
    }
  });

  return analytics;
};

// ============================================================================
// EXPORT
// ============================================================================

export default {
  createDeepLink,
  createOrderDeepLink,
  trackClick,
  trackOpen,
  trackConversion,
  getDeepLinkAnalytics,
};

