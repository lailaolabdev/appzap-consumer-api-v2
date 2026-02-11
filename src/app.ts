import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import config from './config/env';
import logger from './utils/logger';
import { formatErrorResponse, AppError } from './utils/errors';
import { globalRateLimiter } from './middleware/rateLimit.middleware';

// Import routes
import authRoutes from './routes/auth.routes';
import healthRoutes from './routes/health.routes';
import eatsRoutes from './routes/eats.routes';
import paymentRoutes from './routes/payment.routes';
import bookingRoutes from './routes/booking.routes';
import marketRoutes from './routes/market.routes';
import identityRoutes from './routes/identity.routes';
import deepLinkRoutes from './routes/deepLink.routes';
import notificationRoutes from './routes/notification.routes';
import liveRoutes from './routes/live.routes';
import reviewRoutes from './routes/review.routes';
import loyaltyRoutes from './routes/loyalty.routes';
import giftRoutes from './routes/gift.routes';
import billSplitRoutes from './routes/billSplit.routes';
import promotionRoutes from './routes/promotion.routes';
import couponRoutes from './routes/coupon.routes';
import analyticsRoutes from './routes/analytics.routes';
import restaurantRoutes from './routes/restaurant.routes';
// New foreigner-focused routes (Phase A-E)
import landmarkRoutes from './routes/landmark.routes';
import hotelRoutes from './routes/hotel.routes';
import activityRoutes from './routes/activity.routes';
import advertisementRoutes from './routes/advertisement.routes';
import * as deepLinkController from './controllers/deepLink.controller';
import * as giftController from './controllers/gift.controller';

/**
 * Create Express Application
 */
const createApp = (): Application => {
  const app = express();

  // ============================================================================
  // SECURITY MIDDLEWARE
  // ============================================================================

  // Helmet - Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable for API
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS
  const corsOptions = {
    origin:
      config.nodeEnv === 'production'
        ? [
            'https://appzap.la',
            'https://www.appzap.la',
            'https://app.appzap.la',
            // Add your Flutter app origins
          ]
        : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400, // 24 hours
  };
  app.use(cors(corsOptions));

  // ============================================================================
  // PERFORMANCE MIDDLEWARE
  // ============================================================================

  // Compression
  app.use(compression());

  // ============================================================================
  // PARSING MIDDLEWARE
  // ============================================================================

  // Body parser
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ============================================================================
  // LOGGING MIDDLEWARE
  // ============================================================================

  // HTTP request logging
  if (config.nodeEnv === 'development') {
    app.use(morgan('dev'));
  } else {
    app.use(
      morgan('combined', {
        stream: {
          write: (message: string) => {
            logger.info(message.trim());
          },
        },
      })
    );
  }

  // ============================================================================
  // RATE LIMITING
  // ============================================================================

  app.use(globalRateLimiter);

  // ============================================================================
  // ROUTES
  // ============================================================================

  // Health check routes (no prefix)
  app.use('/health', healthRoutes);

  // Deep link redirect (no prefix - for web users)
  app.get('/links/:shortCode', deepLinkController.handleDeepLinkRedirect);
  
  // Gift deep link redirect
  app.get('/gift/:shortCode', (req, res) => {
    // Redirect to app with gift code
    const { shortCode } = req.params;
    const appUrl = `appzap://gift/${shortCode}`;
    
    // If mobile, try to open app; otherwise show gift info
    const userAgent = req.get('User-Agent') || '';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent);
    
    if (isMobile) {
      res.redirect(appUrl);
    } else {
      res.redirect(`/api/v1/gifts/code/${shortCode}`);
    }
  });
  
  // Bill split deep link redirect
  app.get('/split/:sessionCode', (req, res) => {
    const { sessionCode } = req.params;
    const appUrl = `appzap://split/${sessionCode}`;
    
    // If mobile, try to open app; otherwise show session info
    const userAgent = req.get('User-Agent') || '';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent);
    
    if (isMobile) {
      res.redirect(appUrl);
    } else {
      res.redirect(`/api/v1/bill-split/code/${sessionCode}`);
    }
  });

  // API routes (api/v1 prefix)
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/eats', eatsRoutes);
  app.use('/api/v1/eats/bookings', bookingRoutes);
  app.use('/api/v1/payments', paymentRoutes);
  app.use('/api/v1/market', marketRoutes);
  app.use('/api/v1/identity', identityRoutes);
  app.use('/api/v1/deep-links', deepLinkRoutes);
  app.use('/api/v1/notifications', notificationRoutes);
  app.use('/api/v1/live', liveRoutes);
  app.use('/api/v1/reviews', reviewRoutes);
  app.use('/api/v1/loyalty', loyaltyRoutes);
  app.use('/api/v1/gifts', giftRoutes);
  app.use('/api/v1/bill-split', billSplitRoutes);
  app.use('/api/v1/promotions', promotionRoutes);
  app.use('/api/v1/coupons', couponRoutes);
  app.use('/api/v1/analytics', analyticsRoutes);
  app.use('/api/v1/restaurants', restaurantRoutes);
  // New foreigner-focused routes (Phase A-E)
  app.use('/api/v1/landmarks', landmarkRoutes);
  app.use('/api/v1/hotels', hotelRoutes);
  app.use('/api/v1/activities', activityRoutes);
  app.use('/api/v1/ads', advertisementRoutes);

  // Root endpoint
  app.get('/', (req: Request, res: Response) => {
    res.json({
      name: 'AppZap Consumer API',
      version: '1.0.0',
      status: 'running',
      environment: config.nodeEnv,
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/health',
        healthDetailed: '/health/detailed',
        auth: '/api/v1/auth',
        eats: '/api/v1/eats',
        bookings: '/api/v1/eats/bookings',
        live: '/api/v1/live',
        market: '/api/v1/market',
        reviews: '/api/v1/reviews',
        loyalty: '/api/v1/loyalty',
        gifts: '/api/v1/gifts',
        billSplit: '/api/v1/bill-split',
        promotions: '/api/v1/promotions',
        coupons: '/api/v1/coupons',
        analytics: '/api/v1/analytics',
        restaurants: '/api/v1/restaurants',
        // New foreigner-focused endpoints
        landmarks: '/api/v1/landmarks',
        hotels: '/api/v1/hotels',
        activities: '/api/v1/activities',
        ads: '/api/v1/ads',
        docs: 'See documentation at /docs',
      },
    });
  });

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`,
        statusCode: 404,
      },
    });
  });

  // ============================================================================
  // ERROR HANDLER
  // ============================================================================

  app.use((error: Error | AppError, req: Request, res: Response, next: NextFunction) => {
    // Log error
    logger.error('Express error handler', {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
    });

    // Determine status code
    const statusCode = error instanceof AppError ? error.statusCode : 500;

    // Format and send response
    const errorResponse = formatErrorResponse(
      error,
      config.nodeEnv === 'development' // Include stack trace in development
    );

    res.status(statusCode).json(errorResponse);
  });

  return app;
};

export default createApp;

