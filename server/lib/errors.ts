/**
 * EDI Connector Error Taxonomy
 * Standardized error codes and handling for all connector types
 */

export type ConnectorErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTH_ERROR'
  | 'TRANSPORT_ERROR'
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'PAYER_REJECT'
  | 'DUPLICATE'
  | 'UNKNOWN';

export class ConnectorError extends Error {
  public code: ConnectorErrorCode;
  public details?: any;
  public retriable: boolean;

  constructor(code: ConnectorErrorCode, message: string, details?: any) {
    super(message);
    this.name = 'ConnectorError';
    this.code = code;
    this.details = details;
    this.retriable = shouldRetry(code);
    
    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConnectorError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      retriable: this.retriable,
      stack: this.stack,
    };
  }
}

/**
 * Classify HTTP errors into connector error codes
 */
export function classifyHttpError(statusCode: number, responseBody?: any): ConnectorErrorCode {
  if (statusCode >= 400 && statusCode < 500) {
    switch (statusCode) {
      case 400:
        return 'VALIDATION_ERROR';
      case 401:
      case 403:
        return 'AUTH_ERROR';
      case 409:
        return 'DUPLICATE';
      case 429:
        return 'RATE_LIMIT';
      default:
        return 'PAYER_REJECT';
    }
  }
  
  if (statusCode >= 500) {
    return 'TRANSPORT_ERROR';
  }
  
  return 'UNKNOWN';
}

/**
 * Determine if an error should be retried based on error code
 */
export function shouldRetry(code: ConnectorErrorCode): boolean {
  switch (code) {
    case 'TRANSPORT_ERROR':
    case 'TIMEOUT':
    case 'RATE_LIMIT':
      return true;
    case 'VALIDATION_ERROR':
    case 'AUTH_ERROR':
    case 'PAYER_REJECT':
    case 'DUPLICATE':
    case 'UNKNOWN':
      return false;
    default:
      return false;
  }
}

/**
 * Calculate exponential backoff delay for retry attempts
 */
export function calculateBackoffDelay(attempt: number): number {
  // Exponential backoff: 2^n * 2000ms (2 seconds base)
  const baseDelay = 2000;
  const maxDelay = 300000; // 5 minutes maximum
  const delay = Math.min(Math.pow(2, attempt) * baseDelay, maxDelay);
  
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.1 * delay;
  return Math.floor(delay + jitter);
}