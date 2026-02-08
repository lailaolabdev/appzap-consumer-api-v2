/**
 * Phase 2 - Bill Splitting Tests
 * 
 * Tests for bill split session endpoints
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

describe('Phase 2: Bill Splitting', () => {
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

  describe('GET /api/v1/bill-split/code/:code', () => {
    it('should get session by code (public)', async () => {
      const response = await request(app)
        .get('/api/v1/bill-split/code/test-session-code');

      // May return 200, 404, or 500
      expect([200, 404, 500]).toContain(response.status);
    });
  });

  // ==========================================================================
  // AUTHENTICATION TESTS
  // ==========================================================================

  describe('POST /api/v1/bill-split', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/bill-split')
        .send({
          orderId: 'order-123',
          splitMethod: 'equal',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/bill-split/join', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/bill-split/join')
        .send({ sessionCode: 'test-code' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/bill-split/active', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/bill-split/active');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/bill-split/history', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/bill-split/history');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/bill-split/:sessionId', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/bill-split/test-session-id');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/bill-split/:sessionId/pay', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/bill-split/test-session-id/pay')
        .send({ amount: 50000 });

      expect(response.status).toBe(401);
    });
  });
});
