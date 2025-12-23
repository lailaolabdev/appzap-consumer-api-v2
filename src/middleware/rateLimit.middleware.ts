import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redisClient from '../config/redis';
import config from '../config/env';
import { RateLimitError } from '../utils/errors';
import { Request, Response } from 'express';

/**
 * Global Rate Limiter
 * 100 requests per minute per IP
 */
export const globalRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs, // 1 minute
  max: config.rateLimit.maxRequests, // 100 requests
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    // @ts-expect-error - Types are outdated but library works fine
    client: redisClient,
    prefix: 'rl:global:',
  }),
  handler: (req: Request, res: Response) => {
    const error = new RateLimitError(
      'Too many requests, please try again later',
      60
    );
    res.status(429).json({
      error: {
        code: error.code,
        message: error.message,
        statusCode: 429,
        retryAfter: error.retryAfter,
      },
    });
  },
});

/**
 * OTP Request Rate Limiter
 * 3 requests per 5 minutes per phone number
 */
export const otpRequestRateLimiter = rateLimit({
  windowMs: config.rateLimit.otpWindowMs, // 5 minutes
  max: config.rateLimit.otpMaxRequests, // 3 requests
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use phone number as key if available
    return req.body.phone || req.ip || 'unknown';
  },
  store: new RedisStore({
    // @ts-expect-error - Types are outdated but library works fine
    client: redisClient,
    prefix: 'rl:otp:',
  }),
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many OTP requests. Please try again in 5 minutes.',
        statusCode: 429,
        retryAfter: 300,
      },
    });
  },
});

/**
 * OTP Verify Rate Limiter
 * 5 attempts per 10 minutes per phone number
 */
export const otpVerifyRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // 5 attempts
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.body.phone || req.ip || 'unknown';
  },
  store: new RedisStore({
    // @ts-expect-error - Types are outdated but library works fine
    client: redisClient,
    prefix: 'rl:otp-verify:',
  }),
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: {
        code: 'TOO_MANY_ATTEMPTS',
        message: 'Too many failed attempts. Please request a new OTP.',
        statusCode: 429,
        retryAfter: 600,
      },
    });
  },
  skipSuccessfulRequests: true, // Only count failed attempts
});

/**
 * Payment Endpoint Rate Limiter
 * 10 requests per minute per user
 */
export const paymentRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise IP
    return req.user?._id.toString() || req.ip || 'unknown';
  },
  store: new RedisStore({
    // @ts-expect-error - Types are outdated but library works fine
    client: redisClient,
    prefix: 'rl:payment:',
  }),
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many payment requests. Please try again in a minute.',
        statusCode: 429,
        retryAfter: 60,
      },
    });
  },
});

/**
 * Strict Rate Limiter for sensitive endpoints
 * 3 requests per minute per IP
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 requests
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    // @ts-expect-error - Types are outdated but library works fine
    client: redisClient,
    prefix: 'rl:strict:',
  }),
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests to this endpoint. Please try again later.',
        statusCode: 429,
        retryAfter: 60,
      },
    });
  },
});

