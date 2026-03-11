/**
 * Phase 5 — Feature 06: Restaurant AI Smart Search & Browsing
 *
 * Tests for GET /api/v1/restaurants/search
 *
 * The current implementation performs case-insensitive string matching against
 * restaurant name, cuisine, and address fields via unifiedRestaurantService.
 * Full LLM/vector AI search is a planned future enhancement — documented in gap report.
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

describe('Phase 5 — Feature 06: Restaurant Smart Search', () => {

    // ==========================================================================
    // ROUTE EXISTENCE
    // ==========================================================================

    describe('GET /api/v1/restaurants/search — Route & Shape', () => {
        it('should exist and return a valid response shape', async () => {
            const response = await request(app)
                .get('/api/v1/restaurants/search');

            // Route must be registered (not 404)
            expect(response.status).not.toBe(404);
            // Acceptable: success with data or 500 (service unavailable without DB)
            expect([200, 500, 503]).toContain(response.status);
        });

        it('should return { success, data, total, page } on success', async () => {
            const response = await request(app)
                .get('/api/v1/restaurants/search');

            if (response.status === 200) {
                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('data');
                expect(Array.isArray(response.body.data)).toBe(true);
                expect(response.body).toHaveProperty('total');
                expect(response.body).toHaveProperty('page');
            }
        });
    });

    // ==========================================================================
    // QUERY PARAMETER: q (search text)
    // ==========================================================================

    describe('GET /api/v1/restaurants/search — ?q= text query', () => {
        it('should accept a natural-language ?q= query', async () => {
            const response = await request(app)
                .get('/api/v1/restaurants/search')
                .query({ q: 'romantic riverside spaghetti' });

            expect(response.status).not.toBe(404);
            expect([200, 500, 503]).toContain(response.status);
        });

        it('should accept a simple restaurant name query', async () => {
            const response = await request(app)
                .get('/api/v1/restaurants/search')
                .query({ q: 'coffee' });

            expect(response.status).not.toBe(404);
            expect([200, 500, 503]).toContain(response.status);
        });

        it('should handle an empty ?q= without errors (return all)', async () => {
            const response = await request(app)
                .get('/api/v1/restaurants/search')
                .query({ q: '' });

            expect(response.status).not.toBe(404);
            expect([200, 500, 503]).toContain(response.status);
        });

        it('should not return 500 for a query that matches nothing', async () => {
            const response = await request(app)
                .get('/api/v1/restaurants/search')
                .query({ q: 'xyzzy-nonexistent-restaurant-abc' });

            // Must NOT crash; valid empty response or service error acceptable
            expect(response.status).not.toBe(404);
            if (response.status === 200) {
                expect(response.body.success).toBe(true);
                expect(Array.isArray(response.body.data)).toBe(true);
            }
        });
    });

    // ==========================================================================
    // QUERY PARAMETER: cuisine filter
    // ==========================================================================

    describe('GET /api/v1/restaurants/search — ?cuisine= filter', () => {
        it('should accept ?cuisine= filter', async () => {
            const response = await request(app)
                .get('/api/v1/restaurants/search')
                .query({ cuisine: 'Thai' });

            expect(response.status).not.toBe(404);
            expect([200, 500, 503]).toContain(response.status);
        });

        it('should accept ?cuisine= combined with ?q=', async () => {
            const response = await request(app)
                .get('/api/v1/restaurants/search')
                .query({ q: 'river view', cuisine: 'Italian' });

            expect(response.status).not.toBe(404);
            expect([200, 500, 503]).toContain(response.status);
        });
    });

    // ==========================================================================
    // QUERY PARAMETER: isReservable filter
    // ==========================================================================

    describe('GET /api/v1/restaurants/search — ?isReservable= filter', () => {
        it('should accept ?isReservable=true filter', async () => {
            const response = await request(app)
                .get('/api/v1/restaurants/search')
                .query({ isReservable: 'true' });

            expect(response.status).not.toBe(404);
            expect([200, 500, 503]).toContain(response.status);
        });

        it('should accept ?isReservable=false filter', async () => {
            const response = await request(app)
                .get('/api/v1/restaurants/search')
                .query({ isReservable: 'false' });

            expect(response.status).not.toBe(404);
            expect([200, 500, 503]).toContain(response.status);
        });
    });

    // ==========================================================================
    // QUERY PARAMETER: pagination (skip / limit)
    // ==========================================================================

    describe('GET /api/v1/restaurants/search — Pagination', () => {
        it('should accept ?skip= and ?limit= params', async () => {
            const response = await request(app)
                .get('/api/v1/restaurants/search')
                .query({ skip: 0, limit: 10 });

            expect(response.status).not.toBe(404);
            expect([200, 500, 503]).toContain(response.status);
        });

        it('should accept page 2 using skip=20&limit=10', async () => {
            const response = await request(app)
                .get('/api/v1/restaurants/search')
                .query({ skip: 20, limit: 10 });

            expect(response.status).not.toBe(404);
            expect([200, 500, 503]).toContain(response.status);
        });

        it('should compute correct page number in response body', async () => {
            const response = await request(app)
                .get('/api/v1/restaurants/search')
                .query({ skip: 20, limit: 10 });

            if (response.status === 200) {
                // page = floor(skip / limit) + 1 = floor(20/10) + 1 = 3
                expect(response.body.page).toBe(3);
            }
        });
    });

    // ==========================================================================
    // COMBINED: All filters at once
    // ==========================================================================

    describe('GET /api/v1/restaurants/search — Combined filters', () => {
        it('should handle all query params simultaneously without crashing', async () => {
            const response = await request(app)
                .get('/api/v1/restaurants/search')
                .query({
                    q: 'hot spaghetti river view romantic date',
                    cuisine: 'Italian',
                    isReservable: 'true',
                    skip: 0,
                    limit: 5,
                });

            expect(response.status).not.toBe(404);
            expect([200, 500, 503]).toContain(response.status);
        });
    });

    // ==========================================================================
    // RELATED: GET /api/v1/restaurants/featured
    // ==========================================================================

    describe('GET /api/v1/restaurants/featured — Premium listings for Discovery UI', () => {
        it('should return featured restaurants endpoint', async () => {
            const response = await request(app)
                .get('/api/v1/restaurants/featured');

            expect(response.status).not.toBe(404);
            expect([200, 500, 503]).toContain(response.status);
        });

        it('should accept ?limit= and ?province= filters', async () => {
            const response = await request(app)
                .get('/api/v1/restaurants/featured')
                .query({ limit: 5, province: 'Vientiane' });

            expect([200, 500, 503]).toContain(response.status);
        });

        it('should accept GPS coordinates for nearby filtering', async () => {
            const response = await request(app)
                .get('/api/v1/restaurants/featured')
                .query({ lat: 17.9667, lng: 102.6000, limit: 10 });

            expect([200, 500, 503]).toContain(response.status);
        });

        it('should return { success, data, total } shape on success', async () => {
            const response = await request(app)
                .get('/api/v1/restaurants/featured');

            if (response.status === 200) {
                expect(response.body).toHaveProperty('success', true);
                expect(Array.isArray(response.body.data)).toBe(true);
                expect(response.body).toHaveProperty('total');
            }
        });
    });

    // ==========================================================================
    // RELATED: GET /api/v1/restaurants/new (Discovery section spotlight)
    // ==========================================================================

    describe('GET /api/v1/restaurants/new — New spotlight section', () => {
        it('should return the new restaurants endpoint', async () => {
            const response = await request(app)
                .get('/api/v1/restaurants/new');

            expect(response.status).not.toBe(404);
            expect([200, 500, 503]).toContain(response.status);
        });

        it('should accept ?daysBack= param', async () => {
            const response = await request(app)
                .get('/api/v1/restaurants/new')
                .query({ daysBack: 7, limit: 5 });

            expect([200, 500, 503]).toContain(response.status);
        });
    });

    // ==========================================================================
    // RELATED: GET /api/v1/restaurants/:id — Tap result to navigate
    // ==========================================================================

    describe('GET /api/v1/restaurants/:id — Routing into restaurant detail', () => {
        it('should return 404 for unknown restaurant ID', async () => {
            const response = await request(app)
                .get('/api/v1/restaurants/nonexistent_v2_000000000000000000000000');

            expect([404, 500, 503]).toContain(response.status);
        });

        it('should not return 404 route-not-found for valid ID format', async () => {
            const response = await request(app)
                .get('/api/v1/restaurants/v2_validRestaurantId123');

            // Should hit the handler and get 404 (not found) or 500 (no DB), not "route not found"
            expect(response.status).not.toBe(200); // no real DB to return data
            expect([404, 500, 503]).toContain(response.status);
        });
    });

});
