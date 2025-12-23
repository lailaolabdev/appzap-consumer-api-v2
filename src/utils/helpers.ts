import crypto from 'crypto';
import config from '../config/env';

/**
 * Phone number utilities
 */
export const phoneUtils = {
  /**
   * Validate Lao phone number format
   */
  isValidLaoPhone(phone: string): boolean {
    // Accepts: 8562093352677 or 2093352677
    return /^(856)?\d{8,10}$/.test(phone);
  },

  /**
   * Normalize phone number to include country code
   */
  normalize(phone: string): string {
    if (!phone) return '';
    // Remove any spaces or special characters
    const cleaned = phone.replace(/\D/g, '');
    // Add 856 if missing
    return cleaned.startsWith('856') ? cleaned : `856${cleaned}`;
  },

  /**
   * Format phone for Supplier API (without country code)
   */
  normalizeForSupplier(phone: string): string {
    const normalized = this.normalize(phone);
    // Remove 856 prefix for Supplier API
    return normalized.startsWith('856') ? normalized.substring(3) : normalized;
  },

  /**
   * Mask phone number for logging
   */
  mask(phone: string): string {
    if (!phone) return '';
    return phone.replace(/(\d{3})\d+(\d{4})/, '$1****$2');
  },
};

/**
 * Encryption utilities
 */
export const encryptionUtils = {
  /**
   * Encrypt sensitive data
   */
  encrypt(text: string): string {
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(config.encryption.key.padEnd(32, '0').slice(0, 32));
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return `${iv.toString('hex')}:${encrypted}`;
  },

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedText: string): string {
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(config.encryption.key.padEnd(32, '0').slice(0, 32));

    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  },
};

/**
 * Generate unique codes
 */
export const codeGenerators = {
  /**
   * Generate order code
   */
  orderCode(prefix = 'ORD'): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  },

  /**
   * Generate market order code
   */
  marketOrderCode(): string {
    return this.orderCode('MKT');
  },

  /**
   * Generate subscription code
   */
  subscriptionCode(): string {
    return this.orderCode('SUB');
  },

  /**
   * Generate booking code
   */
  bookingCode(): string {
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `AZ-${date}-${random}`;
  },
};

/**
 * Date/Time utilities
 */
export const dateUtils = {
  /**
   * Add days to date
   */
  addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  },

  /**
   * Add hours to date
   */
  addHours(date: Date, hours: number): Date {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
  },

  /**
   * Add minutes to date
   */
  addMinutes(date: Date, minutes: number): Date {
    const result = new Date(date);
    result.setMinutes(result.getMinutes() + minutes);
    return result;
  },

  /**
   * Check if date is today
   */
  isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  },

  /**
   * Format date to YYYY-MM-DD
   */
  formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  },
};

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Radius of Earth in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 100) / 100; // Round to 2 decimal places
};

/**
 * Pagination helper
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  skip?: number;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const paginate = <T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginationResult<T> => {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

/**
 * Retry utility with exponential backoff
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> => {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
};

/**
 * Sleep utility
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

