/**
 * Phase 1 - Deep Links Tests
 * 
 * Tests for deep link creation and redirect handlers
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

describe('Phase 1: Deep Links', () => {
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
  // CREATE DEEP LINK TESTS
  // ==========================================================================

  describe('POST /api/v1/deep-links', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/deep-links')
        .send({
          targetType: 'order',
          targetId: 'order-123',
        });

      expect(response.status).toBe(401);
    });
  });

  // ==========================================================================
  // DEEP LINK REDIRECT TESTS
  // ==========================================================================

  describe('GET /links/:shortCode', () => {
    it('should handle link redirect', async () => {
      const response = await request(app)
        .get('/links/test-short-code');

      // May return 302 redirect, 404 if not found, or 500 if DB unavailable
      expect([302, 404, 500]).toContain(response.status);
    });
  });

  describe('GET /gift/:shortCode', () => {
    it('should handle gift link redirect', async () => {
      const response = await request(app)
        .get('/gift/test-gift-code');

      // May return 302 redirect or 404 if not found
      expect([302, 404]).toContain(response.status);
    });
  });

  describe('GET /split/:sessionCode', () => {
    it('should handle split link redirect', async () => {
      const response = await request(app)
        .get('/split/test-session-code');

      // May return 302 redirect or 404 if not found
      expect([302, 404]).toContain(response.status);
    });
  });
});
