/**
 * Phase 1 - Cart Management Tests
 * 
 * Tests for cart creation, item management, and validation
 */

import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
  createTestUser,
  generateTestToken,
  authHeader,
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

describe('Phase 1: Cart Management', () => {
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
  // CREATE CART TESTS
  // ==========================================================================

  describe('POST /api/v1/eats/cart', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/eats/cart')
        .send({
          restaurantId: 'test-restaurant',
          orderType: 'dine_in',
        });

      expect(response.status).toBe(401);
    });
  });

  // ==========================================================================
  // ADD ITEM TO CART TESTS
  // ==========================================================================

  describe('POST /api/v1/eats/cart/:cartId/items', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/eats/cart/test-cart-id/items')
        .send({
          menuItemId: 'item-1',
          quantity: 1,
        });

      expect(response.status).toBe(401);
    });
  });

  // ==========================================================================
  // UPDATE CART ITEM TESTS
  // ==========================================================================

  describe('PUT /api/v1/eats/cart/:cartId/items/:itemId', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .put('/api/v1/eats/cart/test-cart-id/items/item-1')
        .send({ quantity: 2 });

      expect(response.status).toBe(401);
    });
  });

  // ==========================================================================
  // REMOVE CART ITEM TESTS
  // ==========================================================================

  describe('DELETE /api/v1/eats/cart/:cartId/items/:itemId', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/v1/eats/cart/test-cart-id/items/item-1');

      expect(response.status).toBe(401);
    });
  });
});
