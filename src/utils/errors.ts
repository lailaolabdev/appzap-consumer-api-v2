/**
 * Custom Error Classes for AppZap Consumer API
 */

export class AppError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;
  details?: any;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational = true,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Authentication Errors (401)
export class AuthenticationError extends AppError {
  constructor(message: string, code: string, details?: any) {
    super(message, 401, code, true, details);
  }
}

export class InvalidTokenError extends AuthenticationError {
  constructor(message = 'Invalid or expired token') {
    super(message, 'INVALID_TOKEN');
  }
}

export class InvalidOTPError extends AuthenticationError {
  constructor(message = 'Invalid or expired OTP', details?: any) {
    super(message, 'INVALID_OTP', details);
  }
}

// Authorization Errors (403)
export class AuthorizationError extends AppError {
  constructor(message: string, code: string, details?: any) {
    super(message, 403, code, true, details);
  }
}

export class InsufficientPermissionsError extends AuthorizationError {
  constructor(message = 'Insufficient permissions') {
    super(message, 'INSUFFICIENT_PERMISSIONS');
  }
}

// Validation Errors (400)
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
  }
}

export class InvalidInputError extends ValidationError {
  constructor(message: string, field?: string) {
    super(message, { field });
    this.code = 'INVALID_INPUT';
  }
}

// Not Found Errors (404)
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with ID ${identifier} not found`
      : `${resource} not found`;
    super(message, 404, 'NOT_FOUND', true, { resource, identifier });
  }
}

// Conflict Errors (409)
export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 409, 'CONFLICT', true, details);
  }
}

export class DuplicateError extends ConflictError {
  constructor(resource: string, field: string, value: string) {
    super(`${resource} with ${field} '${value}' already exists`, {
      resource,
      field,
      value,
    });
    this.code = 'DUPLICATE_RESOURCE';
  }
}

// Rate Limit Errors (429)
export class RateLimitError extends AppError {
  retryAfter: number;

  constructor(message = 'Too many requests', retryAfter = 60) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', true);
    this.retryAfter = retryAfter;
  }
}

// Payment Errors (402)
export class PaymentError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 402, 'PAYMENT_FAILED', true, details);
  }
}

// External API Errors (502)
export class ExternalAPIError extends AppError {
  constructor(service: string, message: string, details?: any) {
    super(`${service} API error: ${message}`, 502, 'EXTERNAL_API_ERROR', true, {
      service,
      ...details,
    });
  }
}

export class POSSyncError extends ExternalAPIError {
  constructor(message: string, details?: any) {
    super('POS V2', message, details);
    this.code = 'POS_SYNC_FAILED';
  }
}

export class SupplierSyncError extends ExternalAPIError {
  constructor(message: string, details?: any) {
    super('Supplier', message, details);
    this.code = 'SUPPLIER_SYNC_FAILED';
  }
}

// Business Logic Errors (400)
export class BusinessLogicError extends AppError {
  constructor(message: string, code: string, details?: any) {
    super(message, 400, code, true, details);
  }
}

export class CartExpiredError extends BusinessLogicError {
  constructor() {
    super('Cart has expired', 'CART_EXPIRED');
  }
}

export class CartEmptyError extends BusinessLogicError {
  constructor() {
    super('Cannot checkout an empty cart', 'CART_EMPTY');
  }
}

export class InsufficientPointsError extends BusinessLogicError {
  constructor(required: number, available: number) {
    super('Insufficient loyalty points', 'INSUFFICIENT_POINTS', {
      required,
      available,
    });
  }
}

export class ItemUnavailableError extends BusinessLogicError {
  constructor(itemName: string) {
    super(`Item '${itemName}' is currently unavailable`, 'ITEM_UNAVAILABLE', {
      itemName,
    });
  }
}

/**
 * Error response formatter
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    statusCode: number;
    details?: any;
    stack?: string;
  };
}

export const formatErrorResponse = (
  error: AppError | Error,
  includeStack = false
): ErrorResponse => {
  if (error instanceof AppError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        details: error.details,
        ...(includeStack && { stack: error.stack }),
      },
    };
  }

  // Unknown errors
  return {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      statusCode: 500,
      ...(includeStack && { stack: error.stack }),
    },
  };
};

