import winston from 'winston';
import config from '../config/env';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  
  // Add metadata if exists
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  
  return msg;
});

// Create logger instance
const logger = winston.createLogger({
  level: config.logLevel,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: combine(
        colorize(),
        logFormat
      ),
    }),
    // File transports
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Create logs directory if doesn't exist
import fs from 'fs';
import path from 'path';
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Helper functions to mask sensitive data
export const maskPhone = (phone: string): string => {
  if (!phone) return '';
  return phone.replace(/(\d{3})\d+(\d{4})/, '$1****$2');
};

export const maskEmail = (email: string): string => {
  if (!email) return '';
  const [local, domain] = email.split('@');
  return `${local.substring(0, 2)}***@${domain}`;
};

export const sanitizeLog = (data: any): any => {
  if (!data) return data;
  
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization'];
  
  if (typeof data === 'object') {
    const sanitized = { ...data };
    
    for (const key in sanitized) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '***REDACTED***';
      } else if (key === 'phone') {
        sanitized[key] = maskPhone(sanitized[key]);
      } else if (key === 'email') {
        sanitized[key] = maskEmail(sanitized[key]);
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = sanitizeLog(sanitized[key]);
      }
    }
    
    return sanitized;
  }
  
  return data;
};

// Wrapper methods with automatic sanitization
export const safeLogger = {
  info: (message: string, metadata?: any) => {
    logger.info(message, sanitizeLog(metadata));
  },
  error: (message: string, metadata?: any) => {
    logger.error(message, sanitizeLog(metadata));
  },
  warn: (message: string, metadata?: any) => {
    logger.warn(message, sanitizeLog(metadata));
  },
  debug: (message: string, metadata?: any) => {
    logger.debug(message, sanitizeLog(metadata));
  },
};

export default logger;

