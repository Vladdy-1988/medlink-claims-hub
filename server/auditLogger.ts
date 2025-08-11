import { storage } from './storage';

/**
 * Centralized audit logger for healthcare compliance
 * 
 * Logs all user actions and system events without exposing PHI.
 * Maintains audit trail for regulatory compliance (HIPAA, etc.)
 */

export interface AuditEvent {
  id?: string;
  userId?: string;
  organizationId?: string;
  action: string;
  resourceType: 'claim' | 'preauth' | 'user' | 'file' | 'system';
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  details?: Record<string, any>;
  timestamp?: Date;
  success: boolean;
  errorMessage?: string;
}

export class AuditLogger {
  private static instance: AuditLogger;
  
  private constructor() {}

  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  /**
   * Log a user action or system event
   */
  async log(event: AuditEvent): Promise<void> {
    try {
      // Sanitize details to remove any PHI
      const sanitizedDetails = this.sanitizeDetails(event.details);
      
      const auditEntry: AuditEvent = {
        ...event,
        details: sanitizedDetails,
        timestamp: event.timestamp || new Date(),
      };

      // Store in database
      await storage.createAuditLog(auditEntry);

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[AUDIT] ${auditEntry.action}`, {
          userId: auditEntry.userId,
          resourceType: auditEntry.resourceType,
          resourceId: auditEntry.resourceId,
          success: auditEntry.success,
          timestamp: auditEntry.timestamp,
        });
      }
    } catch (error) {
      // Never throw from audit logger to avoid breaking main flow
      console.error('[AUDIT] Failed to log audit event:', error);
    }
  }

  /**
   * Log successful user action
   */
  async logSuccess(
    action: string,
    resourceType: AuditEvent['resourceType'],
    userId?: string,
    resourceId?: string,
    details?: Record<string, any>,
    request?: any
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resourceType,
      resourceId,
      details,
      success: true,
      ipAddress: this.getClientIP(request),
      userAgent: request?.headers?.['user-agent'],
      sessionId: request?.sessionID,
    });
  }

  /**
   * Log failed user action
   */
  async logError(
    action: string,
    resourceType: AuditEvent['resourceType'],
    error: Error | string,
    userId?: string,
    resourceId?: string,
    details?: Record<string, any>,
    request?: any
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resourceType,
      resourceId,
      details,
      success: false,
      errorMessage: typeof error === 'string' ? error : error.message,
      ipAddress: this.getClientIP(request),
      userAgent: request?.headers?.['user-agent'],
      sessionId: request?.sessionID,
    });
  }

  /**
   * Log system event
   */
  async logSystem(
    action: string,
    success: boolean,
    details?: Record<string, any>,
    errorMessage?: string
  ): Promise<void> {
    await this.log({
      action,
      resourceType: 'system',
      success,
      details,
      errorMessage,
    });
  }

  /**
   * Sanitize audit details to remove PHI
   */
  private sanitizeDetails(details?: Record<string, any>): Record<string, any> | undefined {
    if (!details) return undefined;

    const sanitized = { ...details };
    
    // Remove common PHI fields
    const phiFields = [
      'healthCardNumber',
      'socialSecurityNumber',
      'ssn',
      'sin',
      'dateOfBirth',
      'dob',
      'medicalRecordNumber',
      'mrn',
      'patientName',
      'firstName',
      'lastName',
      'fullName',
      'address',
      'phoneNumber',
      'phone',
      'email',
      'emergencyContact',
    ];

    phiFields.forEach(field => {
      if (sanitized[field]) {
        // Replace with redacted indicator
        sanitized[field] = '[REDACTED]';
      }
    });

    // Recursively sanitize nested objects
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeDetails(sanitized[key]);
      }
    });

    return sanitized;
  }

  /**
   * Extract client IP address from request
   */
  private getClientIP(request?: any): string | undefined {
    if (!request) return undefined;

    return request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           request.headers['x-real-ip'] ||
           request.connection?.remoteAddress ||
           request.socket?.remoteAddress ||
           request.ip;
  }
}

// Convenience functions for common audit scenarios
export const auditLogger = AuditLogger.getInstance();

// User authentication events
export const logUserLogin = (userId: string, request?: any) =>
  auditLogger.logSuccess('user.login', 'user', userId, userId, undefined, request);

export const logUserLogout = (userId: string, request?: any) =>
  auditLogger.logSuccess('user.logout', 'user', userId, userId, undefined, request);

export const logLoginFailure = (email: string, error: string, request?: any) =>
  auditLogger.logError('user.login_failed', 'user', error, undefined, undefined, { email }, request);

// Claim management events
export const logClaimCreated = (userId: string, claimId: string, request?: any) =>
  auditLogger.logSuccess('claim.created', 'claim', userId, claimId, undefined, request);

export const logClaimUpdated = (userId: string, claimId: string, changes: Record<string, any>, request?: any) =>
  auditLogger.logSuccess('claim.updated', 'claim', userId, claimId, { changes }, request);

export const logClaimSubmitted = (userId: string, claimId: string, submissionId: string, request?: any) =>
  auditLogger.logSuccess('claim.submitted', 'claim', userId, claimId, { submissionId }, request);

export const logClaimViewed = (userId: string, claimId: string, request?: any) =>
  auditLogger.logSuccess('claim.viewed', 'claim', userId, claimId, undefined, request);

export const logClaimDeleted = (userId: string, claimId: string, request?: any) =>
  auditLogger.logSuccess('claim.deleted', 'claim', userId, claimId, undefined, request);

// File management events
export const logFileUploaded = (userId: string, fileId: string, filename: string, request?: any) =>
  auditLogger.logSuccess('file.uploaded', 'file', userId, fileId, { filename }, request);

export const logFileDownloaded = (userId: string, fileId: string, filename: string, request?: any) =>
  auditLogger.logSuccess('file.downloaded', 'file', userId, fileId, { filename }, request);

export const logFileDeleted = (userId: string, fileId: string, filename: string, request?: any) =>
  auditLogger.logSuccess('file.deleted', 'file', userId, fileId, { filename }, request);

// System events
export const logSystemStartup = () =>
  auditLogger.logSystem('system.startup', true);

export const logSystemShutdown = () =>
  auditLogger.logSystem('system.shutdown', true);

export const logDatabaseMigration = (version: string, success: boolean, error?: string) =>
  auditLogger.logSystem('system.migration', success, { version }, error);

export const logScheduledJobRun = (jobName: string, success: boolean, error?: string) =>
  auditLogger.logSystem('system.scheduled_job', success, { jobName }, error);

// Security events
export const logSecurityEvent = (event: string, userId?: string, details?: Record<string, any>, request?: any) =>
  auditLogger.logError('security.violation', 'system', event, userId, undefined, details, request);

export const logRateLimitExceeded = (userId?: string, request?: any) =>
  auditLogger.logError('security.rate_limit', 'system', 'Rate limit exceeded', userId, undefined, undefined, request);

export const logUnauthorizedAccess = (userId?: string, resource?: string, request?: any) =>
  auditLogger.logError('security.unauthorized', 'system', 'Unauthorized access attempt', userId, undefined, { resource }, request);