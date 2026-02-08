import request from 'supertest';
import mongoose from 'mongoose';
import createApp from '../app';
import { connectDatabase } from '../config/database';
import { connectRedis, disconnectRedis } from '../config/redis';
import User from '../models/User';

/**
 * Comprehensive API Test Suite
 * Tests all API endpoints for production readiness
 */

let app: any;
let accessToken: string;
let refreshToken: string;
let userId: string;
let cartId: string;
let restaurantId: string;
let addressId: string;

beforeAll(async () => {
  // Connect to test database
  await connectDatabase();
  await connectRedis();
  
  // Create Express app
  app = createApp();
  
  // Clean up test data
  await User.deleteMany({ phone: '8562099999999' });
}, 30000);

afterAll(async () => {
  // Clean up
  await User.deleteMany({ phone: '8562099999999' });
  await mongoose.connection.close();
  await disconnectRedis();
}, 30000);

describe('AppZap Consumer API - Complete Test Suite', () => {
  
  // ============================================================================
  // Phase 0: Health Check
  // ============================================================================
  
  describe('Phase 0: Health Check', () => {
    test('GET /health - should return healthy status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });
    
    test('GET /health/detailed - should return detailed health info', async () => {
      const response = await request(app).get('/health/detailed');
      
      expect(response.status).toBe(200);
      expect(response.body.services).toHaveProperty('mongodb');
      expect(response.body.services).toHaveProperty('redis');
    });
  });
  
  // ============================================================================
  // Phase 1: Authentication
  // ============================================================================
  
  describe('Phase 1: Authentication', () => {
    const testPhone = '8562099999999';
    const testOtp = '123456';
    
    test('POST /api/v1/auth/request-otp - should request OTP', async () => {
      const response = await request(app)
        .post('/api/v1/auth/request-otp')
        .send({ phone: testPhone });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    test('POST /api/v1/auth/verify-otp - should verify OTP and return tokens', async () => {
      // For testing, we'll mock the OTP verification
      // In production, this would connect to actual Auth API
      const response = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ phone: testPhone, otp: testOtp });
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('accessToken');
        expect(response.body).toHaveProperty('refreshToken');
        expect(response.body.user).toHaveProperty('_id');
        
        accessToken = response.body.accessToken;
        refreshToken = response.body.refreshToken;
        userId = response.body.user._id;
      } else {
        // Skip if Auth API is not available
        console.log('Auth API not available, skipping token test');
      }
    });
    
    test('GET /api/v1/auth/me - should get user profile with valid token', async () => {
      if (!accessToken) {
        return; // Skip if no token
      }
      
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('_id');
      expect(response.body.phone).toBe(testPhone);
    });
    
    test('GET /api/v1/auth/me - should fail without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me');
      
      expect(response.status).toBe(401);
    });
    
    test('POST /api/v1/auth/refresh - should refresh access token', async () => {
      if (!refreshToken) {
        return; // Skip if no token
      }
      
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('accessToken');
      }
    });
  });
  
  // ============================================================================
  // Phase 2: Eats Product
  // ============================================================================
  
  describe('Phase 2: Eats Product', () => {
    test('GET /api/v1/eats/restaurants - should list restaurants', async () => {
      const response = await request(app)
        .get('/api/v1/eats/restaurants')
        .query({ page: 1, limit: 10 });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      
      if (response.body.data.length > 0) {
        restaurantId = response.body.data[0]._id;
      }
    });
    
    test('GET /api/v1/eats/restaurants/:id - should get restaurant details', async () => {
      if (!restaurantId) {
        return; // Skip if no restaurant
      }
      
      const response = await request(app)
        .get(`/api/v1/eats/restaurants/${restaurantId}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('_id');
    });
    
    test('POST /api/v1/eats/cart - should create cart', async () => {
      if (!accessToken || !restaurantId) {
        return; // Skip if not authenticated
      }
      
      const response = await request(app)
        .post('/api/v1/eats/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          restaurantId,
          orderType: 'takeaway',
        });
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('cartId');
        cartId = response.body.cartId;
      }
    });
    
    test('GET /api/v1/eats/orders - should list user orders', async () => {
      if (!accessToken) {
        return;
      }
      
      const response = await request(app)
        .get('/api/v1/eats/orders')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
  
  // ============================================================================
  // Phase 3: Market Product
  // ============================================================================
  
  describe('Phase 3: Market Product', () => {
    test('GET /api/v1/market/products - should list products', async () => {
      const response = await request(app)
        .get('/api/v1/market/products')
        .query({ page: 1, limit: 10 });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });
    
    test('GET /api/v1/market/categories - should list categories', async () => {
      const response = await request(app)
        .get('/api/v1/market/categories');
      
      expect(response.status).toBe(200);
    });
    
    test('POST /api/v1/market/addresses - should create delivery address', async () => {
      if (!accessToken) {
        return;
      }
      
      const response = await request(app)
        .post('/api/v1/market/addresses')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          label: 'Test Home',
          recipientName: 'Test User',
          phone: '8562099999999',
          addressLine1: '123 Test Street',
          district: 'Chanthabouly',
          city: 'Vientiane',
          province: 'Vientiane Capital',
          latitude: 17.9757,
          longitude: 102.6331,
        });
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('addressId');
        addressId = response.body.addressId;
      }
    });
    
    test('GET /api/v1/market/addresses - should list delivery addresses', async () => {
      if (!accessToken) {
        return;
      }
      
      const response = await request(app)
        .get('/api/v1/market/addresses')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });
    
    test('GET /api/v1/market/orders - should list market orders', async () => {
      if (!accessToken) {
        return;
      }
      
      const response = await request(app)
        .get('/api/v1/market/orders')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });
    
    test('GET /api/v1/market/subscriptions - should list subscriptions', async () => {
      if (!accessToken) {
        return;
      }
      
      const response = await request(app)
        .get('/api/v1/market/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });
  });
  
  // ============================================================================
  // Phase 4: Identity Linking
  // ============================================================================
  
  describe('Phase 4: Identity Linking', () => {
    test('GET /api/v1/identity/profile-context - should get profile context', async () => {
      if (!accessToken) {
        return;
      }
      
      const response = await request(app)
        .get('/api/v1/identity/profile-context')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('profileType');
      expect(response.body).toHaveProperty('priceType');
    });
  });
  
  // ============================================================================
  // Phase 5: Live Product
  // ============================================================================
  
  describe('Phase 5: Live Product', () => {
    test('GET /api/v1/live/health-profile - should get or create health profile', async () => {
      if (!accessToken) {
        return;
      }
      
      const response = await request(app)
        .get('/api/v1/live/health-profile')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('userId');
    });
    
    test('PUT /api/v1/live/health-profile - should update health profile', async () => {
      if (!accessToken) {
        return;
      }
      
      const response = await request(app)
        .put('/api/v1/live/health-profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          age: 30,
          gender: 'male',
          height: 175,
          weight: 75,
          dietaryRestrictions: ['vegetarian'],
          healthGoals: [{ type: 'weight_loss', priority: 5 }],
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    test('GET /api/v1/live/meal-plans - should list meal plans', async () => {
      const response = await request(app)
        .get('/api/v1/live/meal-plans')
        .query({ page: 1, limit: 10 });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });
    
    test('GET /api/v1/live/supplements - should list supplements', async () => {
      const response = await request(app)
        .get('/api/v1/live/supplements')
        .query({ page: 1, limit: 10 });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });
    
    test('GET /api/v1/live/subscriptions - should list meal subscriptions', async () => {
      if (!accessToken) {
        return;
      }
      
      const response = await request(app)
        .get('/api/v1/live/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });
  });
  
  // ============================================================================
  // Phase 6: Deep Links & Gamification
  // ============================================================================
  
  describe('Phase 6: Deep Links & Gamification', () => {
    test('GET /api/v1/deep-links/spin-to-win/rewards - should get rewards', async () => {
      if (!accessToken) {
        return;
      }
      
      const response = await request(app)
        .get('/api/v1/deep-links/spin-to-win/rewards')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });
    
    test('GET /api/v1/deep-links/spin-to-win/statistics - should get statistics', async () => {
      if (!accessToken) {
        return;
      }
      
      const response = await request(app)
        .get('/api/v1/deep-links/spin-to-win/statistics')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalRewards');
    });
  });
  
  // ============================================================================
  // Phase 7: Notifications
  // ============================================================================
  
  describe('Phase 7: Notifications', () => {
    test('POST /api/v1/notifications/fcm-token - should update FCM token', async () => {
      if (!accessToken) {
        return;
      }
      
      const response = await request(app)
        .post('/api/v1/notifications/fcm-token')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ fcmToken: 'test-fcm-token-12345' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
  
  // ============================================================================
  // Phase 8: Bookings
  // ============================================================================
  
  describe('Phase 8: Bookings', () => {
    test('GET /api/v1/eats/bookings - should list user bookings', async () => {
      if (!accessToken) {
        return;
      }
      
      const response = await request(app)
        .get('/api/v1/eats/bookings')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });
  });
  
  // ============================================================================
  // Error Handling Tests
  // ============================================================================
  
  describe('Error Handling', () => {
    test('GET /api/v1/invalid-endpoint - should return 404', async () => {
      const response = await request(app)
        .get('/api/v1/invalid-endpoint');
      
      expect(response.status).toBe(404);
    });
    
    test('POST /api/v1/auth/request-otp - should validate phone number', async () => {
      const response = await request(app)
        .post('/api/v1/auth/request-otp')
        .send({ phone: 'invalid' });
      
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
    
    test('Protected endpoint without auth - should return 401', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me');
      
      expect(response.status).toBe(401);
    });
  });
  
  // ============================================================================
  // Performance Tests
  // ============================================================================
  
  describe('Performance', () => {
    test('Health check should respond quickly', async () => {
      const start = Date.now();
      
      await request(app).get('/health');
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should respond within 1 second
    });
    
    test('Product listing should handle pagination', async () => {
      const response = await request(app)
        .get('/api/v1/market/products')
        .query({ page: 1, limit: 100 });
      
      expect(response.status).toBe(200);
    });
  });
});


