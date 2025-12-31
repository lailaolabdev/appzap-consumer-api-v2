// @ts-nocheck
import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { redisClient } from '../config/redis';
import config from '../config/env';

const router = Router();

/**
 * @route   GET /health
 * @desc    Basic health check
 * @access  Public
 */
router.get('/', async (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
  });
});

/**
 * @route   GET /health/detailed
 * @desc    Detailed health check with dependencies
 * @access  Public
 */
router.get('/detailed', async (req: Request, res: Response) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    version: '1.0.0',
    services: {
      api: 'healthy',
      mongodb: 'unknown',
      redis: 'unknown',
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB',
    },
  };

  try {
    // Check MongoDB
    if (mongoose.connection.readyState === 1) {
      health.services.mongodb = 'healthy';
      await mongoose.connection.db?.admin().ping();
    } else {
      health.services.mongodb = 'unhealthy';
      health.status = 'degraded';
    }
  } catch (error) {
    health.services.mongodb = 'unhealthy';
    health.status = 'degraded';
  }

  try {
    // Check Redis
    const pong = await redisClient.ping();
    if (pong === 'PONG') {
      health.services.redis = 'healthy';
    } else {
      health.services.redis = 'unhealthy';
      health.status = 'degraded';
    }
  } catch (error) {
    health.services.redis = 'unhealthy';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

/**
 * @route   GET /health/liveness
 * @desc    Kubernetes liveness probe
 * @access  Public
 */
router.get('/liveness', (req: Request, res: Response) => {
  res.status(200).json({ status: 'alive' });
});

/**
 * @route   GET /health/readiness
 * @desc    Kubernetes readiness probe
 * @access  Public
 */
router.get('/readiness', async (req: Request, res: Response) => {
  try {
    // Check critical dependencies
    const isMongoReady = mongoose.connection.readyState === 1;
    const isRedisReady = redisClient.status === 'ready';

    if (isMongoReady && isRedisReady) {
      res.status(200).json({ status: 'ready' });
    } else {
      res.status(503).json({
        status: 'not_ready',
        mongodb: isMongoReady ? 'ready' : 'not_ready',
        redis: isRedisReady ? 'ready' : 'not_ready',
      });
    }
  } catch (error) {
    res.status(503).json({ status: 'not_ready', error: 'Health check failed' });
  }
});

export default router;

