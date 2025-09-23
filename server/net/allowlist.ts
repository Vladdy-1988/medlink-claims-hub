/**
 * EDI Sandbox Network Allowlist
 * Blocks production domains when EDI_MODE=sandbox
 * All outbound HTTP calls must go through this wrapper
 */

import { URL } from 'url';
import fetch from 'node-fetch';
import https from 'https';
import http from 'http';

// Production domains that must be blocked in sandbox mode
const BLOCKED_DOMAINS = [
  'manulife.ca',
  'sunlife.ca', 
  'telus.com',
  'telus.ca',
  'wsib.on.ca',
  'wcb.mb.ca',
  'worksafebc.com',
  'claims.greenshield.ca',
  'provider.canadalife.com',
  'bluecross.ca',
  'desjardins.com',
  'ssq.ca',
  'ia.ca',
  'empire.ca',
  'manulifegroup.com',
  'provider.medavie.ca'
];

// Allowed patterns in sandbox mode
const ALLOWED_PATTERNS = [
  /^localhost(:\d+)?$/,
  /^127\.0\.0\.1(:\d+)?$/,
  /^sandbox\./,
  /^test\./,
  /^mock\./,
  /^dev\./,
  /^staging\./,
  /\.sandbox\./,
  /\.test\./,
  /\.mock\./
];

// Check if a domain is allowed
function isDomainAllowed(hostname: string): boolean {
  // Always allow in production mode
  if (process.env.EDI_MODE !== 'sandbox') {
    return true;
  }

  // Check against allowed patterns
  for (const pattern of ALLOWED_PATTERNS) {
    if (pattern.test(hostname.toLowerCase())) {
      return true;
    }
  }

  // Check against blocked domains
  const domain = hostname.toLowerCase();
  for (const blocked of BLOCKED_DOMAINS) {
    if (domain === blocked || domain.endsWith(`.${blocked}`)) {
      return false;
    }
  }

  // Allow by default if not in blocked list
  return true;
}

// Wrap fetch for sandbox protection
export async function safeFetch(url: string, options?: any): Promise<any> {
  try {
    const parsedUrl = new URL(url);
    
    if (!isDomainAllowed(parsedUrl.hostname)) {
      console.warn(`🚫 BLOCKED: Attempt to contact production domain in sandbox mode: ${parsedUrl.hostname}`);
      
      // Return mock response for blocked domains
      return {
        ok: false,
        status: 403,
        statusText: 'Forbidden - Production domain blocked in sandbox mode',
        json: async () => ({
          error: 'SANDBOX_BLOCKED',
          message: `Production domain ${parsedUrl.hostname} is blocked in sandbox mode`,
          domain: parsedUrl.hostname
        }),
        text: async () => `SANDBOX-BLOCKED: ${parsedUrl.hostname}`
      };
    }

    // Make the actual request
    const response = await fetch(url, options);
    
    // In sandbox mode, prefix responses
    if (process.env.EDI_MODE === 'sandbox') {
      const originalJson = response.json.bind(response);
      const originalText = response.text.bind(response);
      
      response.json = async () => {
        const data = await originalJson();
        return {
          ...data,
          _sandbox: true,
          _sandboxTimestamp: new Date().toISOString()
        };
      };
      
      response.text = async () => {
        const text = await originalText();
        return `SANDBOX-${text}`;
      };
    }
    
    return response;
  } catch (error: any) {
    console.error('Network request failed:', error);
    throw error;
  }
}

// Wrap HTTPS request for sandbox protection
export function safeHttpsRequest(options: any, callback?: any): any {
  const hostname = options.hostname || options.host;
  
  if (!isDomainAllowed(hostname)) {
    console.warn(`🚫 BLOCKED: Attempt to contact production domain in sandbox mode: ${hostname}`);
    
    const mockResponse = {
      statusCode: 403,
      headers: {
        'content-type': 'application/json'
      },
      on: (event: string, handler: Function) => {
        if (event === 'data') {
          handler(Buffer.from(JSON.stringify({
            error: 'SANDBOX_BLOCKED',
            message: `Production domain ${hostname} is blocked in sandbox mode`
          })));
        }
        if (event === 'end') {
          handler();
        }
      }
    };
    
    if (callback) {
      process.nextTick(() => callback(mockResponse));
    }
    
    return {
      on: () => {},
      write: () => {},
      end: () => {}
    };
  }
  
  return https.request(options, callback);
}

// Wrap HTTP request for sandbox protection  
export function safeHttpRequest(options: any, callback?: any): any {
  const hostname = options.hostname || options.host;
  
  if (!isDomainAllowed(hostname)) {
    console.warn(`🚫 BLOCKED: Attempt to contact production domain in sandbox mode: ${hostname}`);
    
    const mockResponse = {
      statusCode: 403,
      headers: {
        'content-type': 'application/json'
      },
      on: (event: string, handler: Function) => {
        if (event === 'data') {
          handler(Buffer.from(JSON.stringify({
            error: 'SANDBOX_BLOCKED',
            message: `Production domain ${hostname} is blocked in sandbox mode`
          })));
        }
        if (event === 'end') {
          handler();
        }
      }
    };
    
    if (callback) {
      process.nextTick(() => callback(mockResponse));
    }
    
    return {
      on: () => {},
      write: () => {},
      end: () => {}
    };
  }
  
  return http.request(options, callback);
}

// Verify sandbox mode is working
export function verifySandboxMode(): void {
  if (process.env.EDI_MODE === 'sandbox') {
    console.log('✅ EDI Sandbox mode enabled - production domains will be blocked');
    console.log('   Blocked domains:', BLOCKED_DOMAINS.join(', '));
  } else {
    console.log('⚠️  EDI Sandbox mode disabled - all domains allowed');
  }
}

// Test if a specific domain would be blocked
export function testDomain(domain: string): { allowed: boolean; reason: string } {
  if (process.env.EDI_MODE !== 'sandbox') {
    return { allowed: true, reason: 'Not in sandbox mode' };
  }
  
  const allowed = isDomainAllowed(domain);
  
  if (!allowed) {
    return { 
      allowed: false, 
      reason: `Production domain blocked in sandbox mode` 
    };
  }
  
  for (const pattern of ALLOWED_PATTERNS) {
    if (pattern.test(domain.toLowerCase())) {
      return { 
        allowed: true, 
        reason: `Matches allowed pattern: ${pattern}` 
      };
    }
  }
  
  return { 
    allowed: true, 
    reason: 'Not in blocked list' 
  };
}