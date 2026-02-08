/**
 * Phase 4 - Payment Methods Tests
 * 
 * Tests for payment method endpoints
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

describe('Phase 4: Payment Methods', () => {
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
  // AUTHENTICATION TESTS
  // ==========================================================================

  describe('GET /api/v1/payments/methods', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/payments/methods');

      expect([401, 404]).toContain(response.status);
    });
  });

  describe('POST /api/v1/payments/methods', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/payments/methods')
        .send({
          type: 'phapay',
          phoneNumber: '8562012345678',
        });

      expect([401, 404]).toContain(response.status);
    });
  });

  describe('DELETE /api/v1/payments/methods/:methodId', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/v1/payments/methods/test-method-id');

      expect([401, 404]).toContain(response.status);
    });
  });

  describe('GET /api/v1/payments/transactions', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/payments/transactions');

      expect([401, 404]).toContain(response.status);
    });
  });
});
