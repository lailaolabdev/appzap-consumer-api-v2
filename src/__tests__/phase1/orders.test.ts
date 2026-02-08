/**
 * Phase 1 - Orders Tests
 * 
 * Tests for order history and order details endpoints
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

describe('Phase 1: Orders', () => {
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
  // GET ORDERS AUTHENTICATION TESTS
  // ==========================================================================

  describe('GET /api/v1/eats/orders', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/eats/orders');

      expect(response.status).toBe(401);
    });
  });

  // ==========================================================================
  // GET ORDER BY ID TESTS
  // ==========================================================================

  describe('GET /api/v1/eats/orders/:orderId', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/eats/orders/test-order-id');

      expect(response.status).toBe(401);
    });
  });
});
