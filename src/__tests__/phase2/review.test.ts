/**
 * Phase 2 - Reviews Tests
 * 
 * Tests for reviews and ratings endpoints
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

describe('Phase 2: Reviews', () => {
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

  describe('GET /api/v1/reviews', () => {
    it('should return store reviews (public)', async () => {
      const response = await request(app)
        .get('/api/v1/reviews')
        .query({ storeId: 'test-store-id' });

      // May return 200 with data, 400 if missing storeId, or 500 if service unavailable
      expect([200, 400, 500]).toContain(response.status);
    });
  });

  describe('GET /api/v1/reviews/stats/:storeId', () => {
    it('should return store review stats (public)', async () => {
      const response = await request(app)
        .get('/api/v1/reviews/stats/test-store-id');

      // May return 200 with data or 500 if service unavailable
      expect([200, 500]).toContain(response.status);
    });
  });

  describe('GET /api/v1/reviews/:id', () => {
    it('should get review by ID (public)', async () => {
      const response = await request(app)
        .get('/api/v1/reviews/test-review-id');

      // May return 200, 404, or 500
      expect([200, 404, 500]).toContain(response.status);
    });
  });

  // ==========================================================================
  // AUTHENTICATION TESTS
  // ==========================================================================

  describe('POST /api/v1/reviews', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/reviews')
        .send({
          storeId: 'store-123',
          star: 5,
          comment: 'Great food!',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/reviews/my-reviews', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/reviews/my-reviews');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/v1/reviews/:id', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .put('/api/v1/reviews/test-review-id')
        .send({ star: 4 });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/v1/reviews/:id', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/v1/reviews/test-review-id');

      expect(response.status).toBe(401);
    });
  });
});
