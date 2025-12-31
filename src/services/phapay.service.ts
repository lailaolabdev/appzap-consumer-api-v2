// @ts-nocheck
import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import config from '../config/env';
import logger from '../utils/logger';
import { PaymentError } from '../utils/errors';

/**
 * Phapay Payment Service
 * Handles payment session creation and webhook verification
 */

// Create axios instance for Phapay API
const phapayClient: AxiosInstance = axios.create({
  baseURL: config.phapay.apiUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================================
// TYPES
// ============================================================================

export interface CreatePaymentSessionInput {
  orderId: string;
  amount: number;
  currency?: string;
  returnUrl: string;
  webhookUrl: string;
  customerInfo?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  metadata?: Record<string, any>;
}

export interface PaymentSession {
  sessionId: string;
  paymentUrl: string;
  qrCode?: string;
  expiresAt: Date;
}

export interface WebhookPayload {
  paymentId: string;
  sessionId: string;
  orderId: string;
  status: 'success' | 'failed' | 'cancelled';
  amount: number;
  transactionId?: string;
  timestamp: string;
  signature: string;
}

// ============================================================================
// PAYMENT SESSION
// ============================================================================

/**
 * Create payment session with Phapay
 */
export const createPaymentSession = async (
  input: CreatePaymentSessionInput
): Promise<PaymentSession> => {
  try {
    if (!config.phapay.merchantId || !config.phapay.secretKey) {
      throw new PaymentError('Phapay credentials not configured', {
        merchantId: config.phapay.merchantId ? 'configured' : 'missing',
        secretKey: config.phapay.secretKey ? 'configured' : 'missing',
      });
    }

    logger.info('Creating Phapay payment session', {
      orderId: input.orderId,
      amount: input.amount,
    });

    // Prepare payload
    const payload = {
      merchantId: config.phapay.merchantId,
      orderId: input.orderId,
      amount: input.amount,
      currency: input.currency || 'LAK',
      returnUrl: input.returnUrl,
      webhookUrl: input.webhookUrl,
      customerInfo: input.customerInfo,
      metadata: {
        ...input.metadata,
        source: 'appzap_consumer_api',
      },
    };

    // Generate signature
    const signature = generatePaymentSignature(payload);
    payload.signature = signature;

    // Call Phapay API
    const response = await phapayClient.post('/api/v1/payment/create', payload);

    const sessionData = response.data.data || response.data;

    logger.info('Phapay payment session created', {
      orderId: input.orderId,
      sessionId: sessionData.sessionId,
    });

    return {
      sessionId: sessionData.sessionId,
      paymentUrl: sessionData.paymentUrl,
      qrCode: sessionData.qrCode,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    };
  } catch (error: any) {
    logger.error('Failed to create Phapay payment session', {
      orderId: input.orderId,
      error: error.message,
      response: error.response?.data,
    });

    throw new PaymentError(
      'Failed to create payment session',
      { orderId: input.orderId, error: error.message }
    );
  }
};

/**
 * Generate payment signature (HMAC SHA256)
 */
function generatePaymentSignature(payload: any): string {
  if (!config.phapay.secretKey) {
    throw new PaymentError('Phapay secret key not configured');
  }

  // Sort keys and create string
  const sortedKeys = Object.keys(payload).sort();
  const signatureString = sortedKeys
    .filter((key) => key !== 'signature' && payload[key] !== undefined)
    .map((key) => `${key}=${JSON.stringify(payload[key])}`)
    .join('&');

  // Generate HMAC SHA256
  const hmac = crypto.createHmac('sha256', config.phapay.secretKey);
  hmac.update(signatureString);
  return hmac.digest('hex');
}

// ============================================================================
// WEBHOOK VERIFICATION
// ============================================================================

/**
 * Verify webhook signature
 */
export const verifyWebhookSignature = (
  payload: Omit<WebhookPayload, 'signature'>,
  receivedSignature: string
): boolean => {
  try {
    if (!config.phapay.webhookSecret) {
      logger.error('Phapay webhook secret not configured');
      return false;
    }

    // Create signature string (same as payment signature)
    const sortedKeys = Object.keys(payload).sort();
    const signatureString = sortedKeys
      .map((key) => `${key}=${JSON.stringify(payload[key])}`)
      .join('&');

    // Generate expected signature
    const hmac = crypto.createHmac('sha256', config.phapay.webhookSecret);
    hmac.update(signatureString);
    const expectedSignature = hmac.digest('hex');

    // Timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(receivedSignature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logger.error('Failed to verify webhook signature', { error });
    return false;
  }
};

/**
 * Process webhook payload
 */
export const processWebhook = (payload: WebhookPayload): {
  valid: boolean;
  orderId?: string;
  status?: string;
  transactionId?: string;
} => {
  try {
    // Verify signature
    const { signature, ...payloadWithoutSignature } = payload;
    const isValid = verifyWebhookSignature(payloadWithoutSignature, signature);

    if (!isValid) {
      logger.error('Invalid webhook signature', { orderId: payload.orderId });
      return { valid: false };
    }

    logger.info('Webhook verified successfully', {
      orderId: payload.orderId,
      status: payload.status,
    });

    return {
      valid: true,
      orderId: payload.orderId,
      status: payload.status,
      transactionId: payload.transactionId,
    };
  } catch (error) {
    logger.error('Failed to process webhook', { error });
    return { valid: false };
  }
};

// ============================================================================
// REFUNDS
// ============================================================================

export interface CreateRefundInput {
  paymentId: string;
  orderId: string;
  amount: number;
  reason: string;
}

/**
 * Create refund
 */
export const createRefund = async (
  input: CreateRefundInput
): Promise<{ refundId: string; status: string }> => {
  try {
    if (!config.phapay.merchantId || !config.phapay.secretKey) {
      throw new PaymentError('Phapay credentials not configured');
    }

    logger.info('Creating Phapay refund', {
      paymentId: input.paymentId,
      orderId: input.orderId,
      amount: input.amount,
    });

    const payload = {
      merchantId: config.phapay.merchantId,
      paymentId: input.paymentId,
      orderId: input.orderId,
      amount: input.amount,
      reason: input.reason,
    };

    const signature = generatePaymentSignature(payload);
    payload.signature = signature;

    const response = await phapayClient.post('/api/v1/refund/create', payload);

    const refundData = response.data.data || response.data;

    logger.info('Phapay refund created', {
      refundId: refundData.refundId,
      orderId: input.orderId,
    });

    return {
      refundId: refundData.refundId,
      status: refundData.status,
    };
  } catch (error: any) {
    logger.error('Failed to create Phapay refund', {
      orderId: input.orderId,
      error: error.message,
    });

    throw new PaymentError('Failed to create refund', {
      orderId: input.orderId,
      error: error.message,
    });
  }
};

// ============================================================================
// PAYMENT STATUS
// ============================================================================

/**
 * Check payment status
 */
export const getPaymentStatus = async (
  sessionId: string
): Promise<{ status: string; transactionId?: string }> => {
  try {
    const response = await phapayClient.get(`/api/v1/payment/${sessionId}/status`, {
      params: {
        merchantId: config.phapay.merchantId,
      },
    });

    const statusData = response.data.data || response.data;

    return {
      status: statusData.status,
      transactionId: statusData.transactionId,
    };
  } catch (error: any) {
    logger.error('Failed to get payment status', { sessionId, error: error.message });
    throw new PaymentError('Failed to get payment status', { sessionId });
  }
};

// ============================================================================
// EXPORT
// ============================================================================

export default {
  createPaymentSession,
  verifyWebhookSignature,
  processWebhook,
  createRefund,
  getPaymentStatus,
};

