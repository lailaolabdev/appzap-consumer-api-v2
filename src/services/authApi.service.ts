import { GraphQLClient, gql } from 'graphql-request';
import config from '../config/env';
import logger from '../utils/logger';
import { ExternalAPIError } from '../utils/errors';

/**
 * Auth API Service (GraphQL)
 * Handles OTP requests and verification through existing Auth API
 */

const client = new GraphQLClient(config.authApi.url, {
  // @ts-ignore - timeout option is valid but not in types
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// GraphQL Mutations
const REQUEST_OTP_MUTATION = gql`
  mutation RequestOtpMutation($data: OtpInput!) {
    requestOtp(data: $data) {
      message
    }
  }
`;

const VERIFY_OTP_MUTATION = gql`
  mutation VerifyOtp($data: VerifyOtpInput!, $where: VerifyOtpWhereInput!) {
    verifyOtp(data: $data, where: $where) {
      message
    }
  }
`;

export interface RequestOTPInput {
  phone: string;
  platform?: string;
  header?: string;
}

export interface RequestOTPResult {
  success: boolean;
  referenceId?: string;
  expiresIn?: number;
  message: string;
}

export interface VerifyOTPInput {
  phone: string;
  otp: string;
}

export interface VerifyOTPResult {
  success: boolean;
  user?: {
    id: string;
    nickName?: string;
    phone: string;
    role?: string;
  };
  message: string;
}

/**
 * Request OTP from Auth API
 */
export const requestOTP = async (
  input: RequestOTPInput
): Promise<RequestOTPResult> => {
  try {
    logger.info('Requesting OTP from Auth API', {
      phone: input.phone.replace(/(\d{3})\d+(\d{4})/, '$1****$2'),
    });

    const response = await client.request<any>(REQUEST_OTP_MUTATION, {
      data: {
        phone: input.phone,
        platform: input.platform || 'APPZAP',
        header: input.header || 'AppZap',
      },
    });

    if (response.requestOtp?.message === 'Full Request for day') {
      return {
        success: false,
        message: 'Failed to send OTP',
      };
    }

    if (response.requestOtp?.message) {
      return {
        success: true,
        message: response.requestOtp.message,
        expiresIn: 300, // Default 5 minutes
      };
    }

    return {
      success: false,
      message: 'Failed to send OTP',
    };
  } catch (error: any) {
    logger.error('Auth API request OTP failed', {
      error: error.message,
      response: error.response?.errors,
    });

    throw new ExternalAPIError(
      'Auth API',
      'Failed to request OTP',
      { originalError: error.message }
    );
  }
};

/**
 * Verify OTP with Auth API
 */
export const verifyOTP = async (
  input: VerifyOTPInput
): Promise<VerifyOTPResult> => {
  try {
    logger.info('Verifying OTP with Auth API', {
      phone: input.phone.replace(/(\d{3})\d+(\d{4})/, '$1****$2'),
    });

    console.log('OTP PHONE', input.otp);

    const response = await client.request<any>(VERIFY_OTP_MUTATION, {
      data: {
        code: input.otp,
      },
      where: {
        phone: input.phone,
      },
    });

    console.log('RESPONSE123', response);

    if (response.verifyOtp?.message === 'OTP_NOT_FOUND') {
      return {
        success: false,
        message: 'Invalid OTP',
      };
    }

    if (response.verifyOtp?.message) {
      // OTP verified successfully
      // Note: Auth API doesn't return tokens directly from verifyOtp
      // Consumer API will generate its own tokens
      return {
        success: true,
        user: {
          id: '', // Will be populated from Consumer DB
          phone: input.phone,
          role: 'user',
        },
        message: response.verifyOtp.message || 'OTP verified successfully',
      };
    }

    return {
      success: false,
      message: 'Invalid OTP',
    };
  } catch (error: any) {
    logger.error('Auth API verify OTP failed', {
      error: error.message,
      response: error.response?.errors,
    });

    // Check if it's an invalid OTP error
    if (error.response?.errors?.[0]?.message?.includes('Invalid') ||
        error.response?.errors?.[0]?.message?.includes('incorrect') ||
        error.response?.errors?.[0]?.message?.includes('expired')) {
      return {
        success: false,
        message: 'Invalid or expired OTP',
      };
    }

    throw new ExternalAPIError(
      'Auth API',
      'Failed to verify OTP',
      { originalError: error.message }
    );
  }
};

export default {
  requestOTP,
  verifyOTP,
};

