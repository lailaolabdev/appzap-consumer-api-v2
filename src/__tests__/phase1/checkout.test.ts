/**
 * Phase 1 - Checkout Tests
 * 
 * Tests for checkout endpoint authentication and validation
 */

import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
} from '../setup';

// ============================================================================
// MOCK ALL EXTERNAL DEPENDENCIES BEFORE IMPORTING APP
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

describe('Phase 1: Checkout', () => {
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
  // CHECKOUT AUTHENTICATION TESTS
  // ==========================================================================

  describe('POST /api/v1/eats/cart/:cartId/checkout', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/eats/cart/test-cart-id/checkout')
        .send({
          paymentMethod: 'phapay',
        });

      expect(response.status).toBe(401);
    });
  });
});
