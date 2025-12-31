import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisClient } from '../config/redis';
import config from '../config/env';
import { RateLimitError } from '../utils/errors';
import { Request, Response, NextFunction } from 'express';

/**
 * Skip rate limiting in test environment
 */
const isTestEnvironment = process.env.NODE_ENV === 'test';

/**
 * No-op middleware for test environment
 */
const noopLimiter = (req: Request, res: Response, next: NextFunction) => next();

/**
 * Global Rate Limiter
 * 100 requests per minute per IP
 * (Disabled in test environment)
 */
const globalLimiter = isTestEnvironment ? noopLimiter : rateLimit({
  windowMs: config.rateLimit.windowMs, // 1 minute
  max: config.rateLimit.maxRequests, // 100 requests
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => (redisClient as any).sendCommand(args),
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

export const globalRateLimiter = globalLimiter;

/**
 * OTP Request Rate Limiter
 * 3 requests per 5 minutes per phone number
 * (Disabled in test environment)
 */
const otpRequestLimiter = isTestEnvironment ? noopLimiter : rateLimit({
  windowMs: config.rateLimit.otpWindowMs, // 5 minutes
  max: config.rateLimit.otpMaxRequests, // 3 requests
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use phone number as key if available
    return req.body.phone || req.ip || 'unknown';
  },
  store: new RedisStore({
    sendCommand: (...args: string[]) => (redisClient as any).sendCommand(args),
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

export const otpRequestRateLimiter = otpRequestLimiter;

/**
 * OTP Verify Rate Limiter
 * 5 attempts per 10 minutes per phone number
 * (Disabled in test environment)
 */
const otpVerifyLimiter = isTestEnvironment ? noopLimiter : rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // 5 attempts
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.body.phone || req.ip || 'unknown';
  },
  store: new RedisStore({
    sendCommand: (...args: string[]) => (redisClient as any).sendCommand(args),
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

export const otpVerifyRateLimiter = otpVerifyLimiter;

/**
 * Payment Endpoint Rate Limiter
 * 10 requests per minute per user
 * (Disabled in test environment)
 */
const paymentLimiter = isTestEnvironment ? noopLimiter : rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise IP
    return req.user?._id.toString() || req.ip || 'unknown';
  },
  store: new RedisStore({
    sendCommand: (...args: string[]) => (redisClient as any).sendCommand(args),
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

export const paymentRateLimiter = paymentLimiter;

/**
 * Strict Rate Limiter for sensitive endpoints
 * 3 requests per minute per IP
 * (Disabled in test environment)
 */
const strictLimiter = isTestEnvironment ? noopLimiter : rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 requests
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => (redisClient as any).sendCommand(args),
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

export const strictRateLimiter = strictLimiter;
