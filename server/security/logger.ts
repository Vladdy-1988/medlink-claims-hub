import { Request } from 'express';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// PHI fields that should be redacted
const PHI_FIELDS = [
  'name',
  'patientName',
  'firstName',
  'lastName',
  'healthCardNumber',
  'dob',
  'dateOfBirth',
  'ssn',
  'socialSecurityNumber',
  'address',
  'email',
  'phone',
  'phoneNumber',
  'identifiers',
  'medicalRecordNumber',
  'mrn',
];

// Redact PHI from objects
function redactPHI(obj: any, depth = 0): any {
  if (depth > 10) return '[MAX_DEPTH_EXCEEDED]'; // Prevent infinite recursion
  
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactPHI(item, depth + 1));
  }
  
  const redacted: any = {};
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const lowerKey = key.toLowerCase();
      
      // Check if field name contains PHI indicators
      const isPHI = PHI_FIELDS.some(field => 
        lowerKey.includes(field.toLowerCase())
      );
      
      if (isPHI) {
        redacted[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        redacted[key] = redactPHI(obj[key], depth + 1);
      } else {
        redacted[key] = obj[key];
      }
    }
  }
  
  return redacted;
}

export class SecureLogger {
  private logLevel: LogLevel;
  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
  };
  
  constructor() {
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
  }
  
  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.logLevel];
  }
  
  private formatMessage(level: LogLevel, message: string, context?: any): string {
    const timestamp = new Date().toISOString();
    const sanitizedContext = context ? redactPHI(context) : undefined;
    
    const logEntry = {
      timestamp,
      level,
      message,
      ...(sanitizedContext && { context: sanitizedContext }),
    };
    
    return JSON.stringify(logEntry);
  }
  
  debug(message: string, context?: any): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }
  
  info(message: string, context?: any): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, context));
    }
  }
  
  warn(message: string, context?: any): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context));
    }
  }
  
  error(message: string, error?: Error | any, context?: any): void {
    if (this.shouldLog('error')) {
      const errorContext = {
        ...context,
        error: error instanceof Error ? {
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        } : error,
      };
      console.error(this.formatMessage('error', message, errorContext));
    }
  }
  
  fatal(message: string, error?: Error | any, context?: any): void {
    if (this.shouldLog('fatal')) {
      const errorContext = {
        ...context,
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
        } : error,
      };
      console.error(this.formatMessage('fatal', message, errorContext));
    }
  }
  
  // Log HTTP requests with PHI redaction
  logRequest(req: Request, responseTime?: number, statusCode?: number): void {
    if (this.shouldLog('info')) {
      const logData = {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        userId: (req as any).user?.claims?.sub,
        statusCode,
        responseTime: responseTime ? `${responseTime}ms` : undefined,
        // Redact sensitive query params and body
        query: redactPHI(req.query),
        body: req.body ? redactPHI(req.body) : undefined,
      };
      
      this.info('HTTP Request', logData);
    }
  }
}

// Create singleton instance
export const logger = new SecureLogger();

// Express middleware for request logging
export function requestLogger(req: Request, res: any, next: any): void {
  const startTime = Date.now();
  
  // Log response on finish
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    logger.logRequest(req, responseTime, res.statusCode);
  });
  
  next();
}