import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface Config {
  // Server
  port: number;
  nodeEnv: string;
  apiUrl: string;

  // Database
  mongodb: {
    uri: string;
  };

  // Redis
  redis: {
    url: string;
    host: string;
    port: number;
    password?: string;
    db: number;
    cacheTTL: number;
    tokenTTL: number;
  };

  // JWT
  jwt: {
    secret: string;
    refreshSecret: string;
    accessExpiry: string;
    refreshExpiry: string;
  };

  // External APIs
  authApi: {
    url: string;
  };
  posV2Api: {
    url: string;
    apiKey?: string;
  };
  supplierApi: {
    url: string;
    exchangeKey: string;
  };

  // Payment
  phapay: {
    merchantId?: string;
    secretKey?: string;
    webhookSecret?: string;
    apiUrl: string;
  };

  // Firebase
  firebase: {
    projectId?: string;
    privateKey?: string;
    clientEmail?: string;
    apiKey?: string;
    dynamicLinkDomain?: string;
  };

  // Security
  encryption: {
    key: string;
  };

  // Rate Limiting
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    otpMaxRequests: number;
    otpWindowMs: number;
  };

  // Monitoring
  sentry: {
    dsn?: string;
  };
  logLevel: string;
}

const config: Config = {
  // Server
  port: parseInt(process.env.PORT || '9000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiUrl: process.env.CONSUMER_API_URL || 'http://localhost:9000',

  // Database
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/appzap_consumer_dev',
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    cacheTTL: parseInt(process.env.REDIS_CACHE_TTL || '300', 10),
    tokenTTL: parseInt(process.env.REDIS_TOKEN_TTL || '86400', 10),
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change-this-refresh-secret',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '24h',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '30d',
  },

  // External APIs
  authApi: {
    url: process.env.AUTH_API_URL || 'https://auth.lailaolab.com',
  },
  posV2Api: {
    url: process.env.POS_V2_API_URL || 'http://localhost:8080',
    apiKey: process.env.POS_V2_API_KEY,
  },
  supplierApi: {
    url: process.env.SUPPLIER_API_URL || '',
    exchangeKey: process.env.SUPPLIER_EXCHANGE_KEY || '',
  },

  // Payment
  phapay: {
    merchantId: process.env.PHAPAY_MERCHANT_ID,
    secretKey: process.env.PHAPAY_SECRET_KEY,
    webhookSecret: process.env.PHAPAY_WEBHOOK_SECRET,
    apiUrl: process.env.PHAPAY_API_URL || 'https://payment.phapay.com',
  },

  // Firebase
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    apiKey: process.env.FIREBASE_API_KEY,
    dynamicLinkDomain: process.env.FIREBASE_DYNAMIC_LINK_DOMAIN || 'https://appzap.page.link',
  },

  // Security
  encryption: {
    key: process.env.ENCRYPTION_KEY || 'change-this-encryption-key',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    otpMaxRequests: parseInt(process.env.OTP_RATE_LIMIT_MAX || '3', 10),
    otpWindowMs: parseInt(process.env.OTP_RATE_LIMIT_WINDOW_MS || '300000', 10),
  },

  // Monitoring
  sentry: {
    dsn: process.env.SENTRY_DSN,
  },
  logLevel: process.env.LOG_LEVEL || 'info',
};

// Validate critical configuration
const validateConfig = (): void => {
  const errors: string[] = [];

  if (config.nodeEnv === 'production') {
    if (config.jwt.secret === 'change-this-secret') {
      errors.push('JWT_SECRET must be set in production');
    }
    if (config.jwt.refreshSecret === 'change-this-refresh-secret') {
      errors.push('JWT_REFRESH_SECRET must be set in production');
    }
    if (!config.mongodb.uri.includes('mongodb')) {
      errors.push('MONGODB_URI must be valid');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
};

validateConfig();

export default config;

