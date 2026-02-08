/**
 * Phase 2 - Spin-to-Win Tests
 * 
 * Tests for spin-to-win reward endpoints
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

describe('Phase 2: Spin-to-Win', () => {
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

  describe('GET /api/v1/deep-links/spin-to-win/rewards', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/deep-links/spin-to-win/rewards');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/deep-links/spin-to-win/:rewardId/spin', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/deep-links/spin-to-win/test-reward-id/spin');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/deep-links/spin-to-win/:rewardId/redeem', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/deep-links/spin-to-win/test-reward-id/redeem');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/deep-links/spin-to-win/statistics', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/deep-links/spin-to-win/statistics');

      expect(response.status).toBe(401);
    });
  });
});
