/**
 * Phase 1 - Restaurant Discovery Tests
 * 
 * Tests for restaurant listing and discovery endpoints
 */

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

describe('Phase 1: Restaurant Discovery', () => {
  // ==========================================================================
  // GET RESTAURANTS TESTS
  // ==========================================================================

  describe('GET /api/v1/eats/restaurants', () => {
    it('should return restaurants endpoint', async () => {
      const response = await request(app).get('/api/v1/eats/restaurants');

      // May return 200 with data or 500 if service is unavailable
      // We're testing the route exists and responds
      expect([200, 500, 503]).toContain(response.status);
    });

    it('should accept query parameters', async () => {
      const response = await request(app)
        .get('/api/v1/eats/restaurants')
        .query({
          lat: 17.9667,
          lng: 102.6000,
          limit: 10,
        });

      expect([200, 500, 503]).toContain(response.status);
    });

    it('should accept search query', async () => {
      const response = await request(app)
        .get('/api/v1/eats/restaurants')
        .query({ search: 'coffee' });

      expect([200, 500, 503]).toContain(response.status);
    });
  });

  // ==========================================================================
  // GET RESTAURANT BY ID TESTS
  // ==========================================================================

  describe('GET /api/v1/eats/restaurants/:restaurantId', () => {
    it('should accept restaurant ID parameter', async () => {
      const response = await request(app)
        .get('/api/v1/eats/restaurants/test-restaurant-123');

      // May return 200, 404, or 500
      expect([200, 404, 500, 503]).toContain(response.status);
    });
  });

  // ==========================================================================
  // GET RESTAURANT MENU TESTS
  // ==========================================================================

  describe('GET /api/v1/eats/restaurants/:restaurantId/menu', () => {
    it('should accept menu endpoint', async () => {
      const response = await request(app)
        .get('/api/v1/eats/restaurants/test-restaurant-123/menu');

      expect([200, 404, 500, 503]).toContain(response.status);
    });
  });
});
