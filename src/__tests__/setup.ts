/**
 * Test Setup and Utilities
 * 
 * Provides test fixtures, mock factories, and mock setup for all tests.
 * Uses mocking instead of real database for better isolation and reliability.
 */

import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

// ============================================================================
// MOCK MONGOOSE CONNECTION
// ============================================================================

// Mock mongoose connection state
let isConnected = false;

/**
 * Setup mock database (no actual database needed)
 */
export const setupTestDatabase = async (): Promise<void> => {
  isConnected = true;
  // Mock mongoose connection readyState
  Object.defineProperty(mongoose.connection, 'readyState', {
    get: () => isConnected ? 1 : 0,
    configurable: true,
  });
};

/**
 * Teardown mock database
 */
export const teardownTestDatabase = async (): Promise<void> => {
  isConnected = false;
};

/**
 * Clear mock database (reset mocks)
 */
export const clearDatabase = async (): Promise<void> => {
  jest.clearAllMocks();
};

// ============================================================================
// TEST FIXTURES
// ============================================================================

export const testPhones = {
  valid: '8562012345678',       // Valid format with country code
  validShort: '2012345678',     // Valid format without country code
  invalid: '12345',              // Too short
  invalidWithPlus: '+8562012345678', // Invalid - has + prefix
  rateLimit: '8562099999999',
};

export const testOTP = {
  valid: '123456',
  invalid: '000000',
  expired: '111111',
};

export const testRestaurant = {
  v1: {
    id: 'v1_store123',
    name: 'Test Restaurant V1',
    posVersion: 'v1',
    address: {
      latitude: 17.9667,
      longitude: 102.6000,
    },
  },
  v2: {
    id: 'v2_rest456',
    name: 'Test Restaurant V2',
    posVersion: 'v2',
    address: {
      latitude: 17.9700,
      longitude: 102.6100,
    },
  },
};

export const testMenuItem = {
  id: 'menu_item_001',
  name: 'Pad Thai',
  price: 35000,
  category: 'Main Dishes',
};

// ============================================================================
// MOCK USER DATA
// ============================================================================

export interface MockUser {
  _id: mongoose.Types.ObjectId;
  phone: string;
  fullName: string;
  roles: string[];
  activeProfile: string;
  points: {
    balance: number;
    tier: string;
    totalEarned: number;
    totalRedeemed: number;
  };
  hasCompletedOnboarding: boolean;
  firstLogin: boolean;
  fcmTokens?: Array<{
    token: string;
    deviceType: string;
    deviceId: string;
    createdAt: Date;
  }>;
  v1Integration?: {
    userId?: string;
    userAuthId?: string;
    phone?: string;
    linkedAt?: Date;
    dataSynced?: {
      orders: boolean;
      reviews: boolean;
      points: boolean;
      reservations: boolean;
    };
  };
}

/**
 * Create a mock user
 */
export const createTestUser = async (overrides: Partial<MockUser> = {}): Promise<MockUser> => {
  const user: MockUser = {
    _id: new mongoose.Types.ObjectId(),
    phone: testPhones.valid,
    fullName: 'Test User',
    roles: ['consumer'],
    activeProfile: 'personal',
    points: { balance: 0, tier: 'bronze', totalEarned: 0, totalRedeemed: 0 },
    hasCompletedOnboarding: true,
    firstLogin: false,
    ...overrides,
  };
  return user;
};

/**
 * Create a mock user with loyalty points
 */
export const createTestUserWithPoints = async (
  points: number,
  overrides: Partial<MockUser> = {}
): Promise<MockUser> => {
  const tier = points >= 10000 ? 'platinum' : points >= 5000 ? 'gold' : points >= 2000 ? 'silver' : 'bronze';
  return createTestUser({
    points: {
      balance: points,
      tier,
      totalEarned: points,
      totalRedeemed: 0,
    },
    ...overrides,
  });
};

// ============================================================================
// MOCK CART DATA
// ============================================================================

export interface MockCart {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  restaurantId: string;
  restaurantName: string;
  orderType: string;
  tableId?: string;
  items: Array<{
    menuItemId: string;
    name: string;
    price: number;
    quantity: number;
    modifiers?: any[];
  }>;
  subtotal: number;
  total: number;
  expiresAt: Date;
}

/**
 * Create a mock cart
 */
export const createTestCart = async (
  userId: mongoose.Types.ObjectId,
  overrides: Partial<MockCart> = {}
): Promise<MockCart> => {
  const cart: MockCart = {
    _id: new mongoose.Types.ObjectId(),
    userId,
    restaurantId: testRestaurant.v1.id,
    restaurantName: testRestaurant.v1.name,
    orderType: 'dine_in',
    tableId: 'table-5',
    items: [],
    subtotal: 0,
    total: 0,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    ...overrides,
  };
  return cart;
};

/**
 * Create a mock cart with items
 */
export const createTestCartWithItems = async (
  userId: mongoose.Types.ObjectId,
  items?: Array<{
    menuItemId: string;
    name: string;
    price: number;
    quantity: number;
  }>
): Promise<MockCart> => {
  const defaultItems = items || [
    {
      menuItemId: testMenuItem.id,
      name: testMenuItem.name,
      price: testMenuItem.price,
      quantity: 2,
      modifiers: [],
    },
  ];

  const subtotal = defaultItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return createTestCart(userId, {
    items: defaultItems,
    subtotal,
    total: subtotal,
  });
};

// ============================================================================
// MOCK ORDER DATA
// ============================================================================

export interface MockOrder {
  _id: mongoose.Types.ObjectId;
  orderCode: string;
  userId: mongoose.Types.ObjectId;
  orderType: string;
  productType: string;
  restaurantId: string;
  restaurantName: string;
  tableId?: string;
  items: Array<{
    menuItemId: string;
    name: string;
    price: number;
    quantity: number;
    modifiers?: any[];
  }>;
  subtotal: number;
  discount: number;
  tip: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  posSyncStatus: string;
  createdAt: Date;
}

/**
 * Create a mock order
 */
export const createTestOrder = async (
  userId: mongoose.Types.ObjectId,
  overrides: Partial<MockOrder> = {}
): Promise<MockOrder> => {
  const order: MockOrder = {
    _id: new mongoose.Types.ObjectId(),
    orderCode: `ORD-${Date.now()}-001`,
    userId,
    orderType: 'dine_in',
    productType: 'eats',
    restaurantId: testRestaurant.v1.id,
    restaurantName: testRestaurant.v1.name,
    tableId: 'table-5',
    items: [
      {
        menuItemId: testMenuItem.id,
        name: testMenuItem.name,
        price: testMenuItem.price,
        quantity: 2,
        modifiers: [],
      },
    ],
    subtotal: 70000,
    discount: 0,
    tip: 0,
    total: 70000,
    paymentMethod: 'phapay',
    paymentStatus: 'completed',
    status: 'completed',
    posSyncStatus: 'synced',
    createdAt: new Date(),
    ...overrides,
  };
  return order;
};

// ============================================================================
// MOCK DEEP LINK DATA
// ============================================================================

export interface MockDeepLink {
  _id: mongoose.Types.ObjectId;
  shortCode: string;
  targetType: string;
  targetId: string;
  userId: mongoose.Types.ObjectId;
  longUrl: string;
  campaignName: string;
  source: string;
  medium: string;
  isActive: boolean;
  expiresAt: Date;
  analytics: {
    clicks: number;
    uniqueClicks: number;
    appOpens: number;
    conversions: number;
  };
}

/**
 * Create a mock deep link
 */
export const createTestDeepLink = async (
  userId: mongoose.Types.ObjectId,
  overrides: Partial<MockDeepLink> = {}
): Promise<MockDeepLink> => {
  const shortCode = `test${Date.now()}`;
  
  const deepLink: MockDeepLink = {
    _id: new mongoose.Types.ObjectId(),
    shortCode,
    targetType: 'order',
    targetId: 'order-123',
    userId,
    longUrl: `appzap://order/order-123`,
    campaignName: 'test_campaign',
    source: 'web_ordering',
    medium: 'qr_code',
    isActive: true,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    analytics: {
      clicks: 0,
      uniqueClicks: 0,
      appOpens: 0,
      conversions: 0,
    },
    ...overrides,
  };
  return deepLink;
};

// ============================================================================
// MOCK REWARD DATA (for Spin-to-Win)
// ============================================================================

export interface MockReward {
  rewardId: string;
  userId: string;
  orderId: string;
  spinsTotal: number;
  spinsUsed: number;
  prizes: any[];
  expiresAt: Date;
  isExpired: boolean;
}

/**
 * Create a mock spin-to-win reward
 */
export const createTestReward = async (
  userId: string,
  overrides: Partial<MockReward> = {}
): Promise<MockReward> => {
  const reward: MockReward = {
    rewardId: `reward-${Date.now()}`,
    userId,
    orderId: 'order-123',
    spinsTotal: 3,
    spinsUsed: 0,
    prizes: [],
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    isExpired: false,
    ...overrides,
  };
  return reward;
};

// ============================================================================
// JWT HELPERS
// ============================================================================

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-testing';

/**
 * Generate a valid access token for testing
 */
export const generateTestToken = (user: MockUser): string => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      phone: user.phone,
      roles: user.roles,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
};

/**
 * Generate an expired token for testing
 */
export const generateExpiredToken = (user: MockUser): string => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      phone: user.phone,
      roles: user.roles,
    },
    JWT_SECRET,
    { expiresIn: '-1h' }
  );
};

/**
 * Generate an invalid token
 */
export const generateInvalidToken = (): string => {
  return 'invalid.token.here';
};

// ============================================================================
// REQUEST HELPERS
// ============================================================================

/**
 * Create authorization header
 */
export const authHeader = (token: string): { Authorization: string } => ({
  Authorization: `Bearer ${token}`,
});

/**
 * Generate random phone number for testing
 */
export const generateRandomPhone = (): string => {
  const random = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  return `856${random}`;
};

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

/**
 * Assert error response format
 */
export const assertErrorResponse = (
  body: any,
  expectedCode: string,
  expectedStatus: number
): void => {
  expect(body).toHaveProperty('error');
  expect(body.error).toHaveProperty('code', expectedCode);
  expect(body.error).toHaveProperty('statusCode', expectedStatus);
  expect(body.error).toHaveProperty('message');
};

/**
 * Assert pagination response format
 */
export const assertPaginationResponse = (body: any): void => {
  expect(body).toHaveProperty('data');
  expect(body).toHaveProperty('pagination');
  expect(body.pagination).toHaveProperty('page');
  expect(body.pagination).toHaveProperty('limit');
  expect(body.pagination).toHaveProperty('total');
};

export default {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
  testPhones,
  testOTP,
  testRestaurant,
  testMenuItem,
  createTestUser,
  createTestUserWithPoints,
  createTestCart,
  createTestCartWithItems,
  createTestOrder,
  createTestDeepLink,
  createTestReward,
  generateTestToken,
  generateExpiredToken,
  generateInvalidToken,
  authHeader,
  generateRandomPhone,
  assertErrorResponse,
  assertPaginationResponse,
};
