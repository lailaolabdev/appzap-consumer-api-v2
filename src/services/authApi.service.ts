import { GraphQLClient, gql } from 'graphql-request';
import config from '../config/env';
import logger from '../utils/logger';
import { ExternalAPIError } from '../utils/errors';

/**
 * Auth API Service (GraphQL)
 * Handles OTP requests and verification through existing Auth API
 */

const client = new GraphQLClient(config.authApi.url, {
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// GraphQL Mutations
const REQUEST_OTP_MUTATION = gql`
  mutation RequestOtp($data: CreateOtpProviderInput!) {
    requestOtp(data: $data) {
      status
      message
      data {
        id
        referenceId
        expiresIn
      }
    }
  }
`;

const PHONE_LOGIN_MUTATION = gql`
  mutation PhoneLogin($where: PhoneLoginUserInput!) {
    phoneLogin(where: $where) {
      status
      message
      data {
        id
        firstName
        lastName
        phoneNumber
        email
        role
        accessToken
        refreshToken
      }
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
    firstName?: string;
    lastName?: string;
    phoneNumber: string;
    email?: string;
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
        phoneNumber: input.phone,
        platform: input.platform || 'APPZAP',
        header: input.header || 'AppZap',
      },
    });

    if (response.requestOtp?.status === 'success') {
      return {
        success: true,
        referenceId: response.requestOtp.data?.referenceId,
        expiresIn: response.requestOtp.data?.expiresIn || 300,
        message: 'OTP sent successfully',
      };
    }

    return {
      success: false,
      message: response.requestOtp?.message || 'Failed to send OTP',
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

    const response = await client.request<any>(PHONE_LOGIN_MUTATION, {
      where: {
        phoneNumber: input.phone,
        otp: input.otp,
      },
    });

    if (response.phoneLogin?.status === 'success' && response.phoneLogin.data) {
      return {
        success: true,
        user: {
          id: response.phoneLogin.data.id,
          firstName: response.phoneLogin.data.firstName,
          lastName: response.phoneLogin.data.lastName,
          phoneNumber: response.phoneLogin.data.phoneNumber,
          email: response.phoneLogin.data.email,
          role: response.phoneLogin.data.role,
        },
        message: 'OTP verified successfully',
      };
    }

    return {
      success: false,
      message: response.phoneLogin?.message || 'Invalid OTP',
    };
  } catch (error: any) {
    logger.error('Auth API verify OTP failed', {
      error: error.message,
      response: error.response?.errors,
    });

    // Check if it's an invalid OTP error
    if (error.response?.errors?.[0]?.message?.includes('Invalid')) {
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

