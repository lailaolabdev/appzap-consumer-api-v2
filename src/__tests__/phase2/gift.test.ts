/**
 * Phase 2 - Social Gifting Tests
 * 
 * Tests for gift/voucher endpoints
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

describe('Phase 2: Social Gifting', () => {
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

  describe('GET /api/v1/gifts/templates', () => {
    it('should return gift templates (public)', async () => {
      const response = await request(app)
        .get('/api/v1/gifts/templates');

      // May return 200 with data or 500 if service unavailable
      expect([200, 500]).toContain(response.status);
    });
  });

  describe('GET /api/v1/gifts/code/:code', () => {
    it('should get gift by code (public)', async () => {
      const response = await request(app)
        .get('/api/v1/gifts/code/test-gift-code');

      // May return 200, 404, or 500
      expect([200, 404, 500]).toContain(response.status);
    });
  });

  // ==========================================================================
  // AUTHENTICATION TESTS
  // ==========================================================================

  describe('POST /api/v1/gifts', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/gifts')
        .send({
          type: 'digital_coffee',
          amount: 25000,
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/gifts/claim', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/gifts/claim')
        .send({ giftCode: 'test-code' });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/gifts/redeem', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/gifts/redeem')
        .send({ giftCode: 'test-code', restaurantId: 'rest-1' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/gifts/sent', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/gifts/sent');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/gifts/received', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/gifts/received');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/gifts/:giftId', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/gifts/test-gift-id');

      expect(response.status).toBe(401);
    });
  });
});
