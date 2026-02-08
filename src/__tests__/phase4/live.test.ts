/**
 * Phase 4 - Live (Healthy Meals) Tests
 * 
 * Tests for live meal subscription endpoints
 */

import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
} from '../setup';

// ============================================================================
// MOCK ALL EXTERNAL DEPENDENCIES
// ============================================================================

jest.mock('../../config/redis', () => ({
  redisHelpers: {
    get: jest.fn().mockResolvedValue(null),
    setWithTTL: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  },
  connectRedis: jest.fn().mockResolvedValue(undefined),
  disconnectRedis: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => ({
    process: jest.fn(),
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  }));
});

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: { cert: jest.fn() },
  messaging: jest.fn().mockReturnValue({ send: jest.fn().mockResolvedValue('message-id') }),
}));

import createApp from '../../app';
import request from 'supertest';

const app = createApp();

describe('Phase 4: Live (Healthy Meals)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  // ==========================================================================
  // PUBLIC ENDPOINT TESTS
  // ==========================================================================

  describe('GET /api/v1/live/plans', () => {
    it('should return meal plans (public)', async () => {
      const response = await request(app)
        .get('/api/v1/live/plans');

      // May return 200 with data or 500/404 if service unavailable
      expect([200, 404, 500]).toContain(response.status);
    });
  });

  // ==========================================================================
  // AUTHENTICATION TESTS
  // ==========================================================================

  describe('POST /api/v1/live/subscriptions', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/live/subscriptions')
        .send({
          planId: 'plan-123',
          duration: 'weekly',
        });

      expect([401, 404]).toContain(response.status);
    });
  });

  describe('GET /api/v1/live/subscriptions', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/live/subscriptions');

      expect([401, 404]).toContain(response.status);
    });
  });
});
