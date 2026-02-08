/**
 * Phase 3 - Push Notifications Tests
 * 
 * Tests for notification endpoints
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

describe('Phase 3: Push Notifications', () => {
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

  describe('POST /api/v1/notifications/fcm-token', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/notifications/fcm-token')
        .send({
          fcmToken: 'test-token',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/v1/notifications/fcm-token', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/v1/notifications/fcm-token');

      expect(response.status).toBe(401);
    });
  });
});
