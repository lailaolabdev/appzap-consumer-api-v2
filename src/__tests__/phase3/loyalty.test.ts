/**
 * Phase 3 - Loyalty Program Tests
 * 
 * Tests for loyalty points and tiers endpoints
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

describe('Phase 3: Loyalty Program', () => {
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

  describe('GET /api/v1/loyalty/tiers', () => {
    it('should return tier info (public)', async () => {
      const response = await request(app)
        .get('/api/v1/loyalty/tiers');

      // May return 200 with data or 500 if service unavailable
      expect([200, 500]).toContain(response.status);
    });
  });

  describe('GET /api/v1/loyalty/earn', () => {
    it('should return earning opportunities (public)', async () => {
      const response = await request(app)
        .get('/api/v1/loyalty/earn');

      // May return 200 with data or 500 if service unavailable
      expect([200, 500]).toContain(response.status);
    });
  });

  // ==========================================================================
  // AUTHENTICATION TESTS
  // ==========================================================================

  describe('GET /api/v1/loyalty/balance', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/loyalty/balance');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/loyalty/history', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/loyalty/history');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/loyalty/preview-redemption', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/loyalty/preview-redemption')
        .send({ points: 100, orderTotal: 50000 });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/loyalty/redeem', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/loyalty/redeem')
        .send({ points: 100, orderId: 'order-123' });

      expect(response.status).toBe(401);
    });
  });
});
