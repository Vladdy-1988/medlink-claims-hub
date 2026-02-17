/**
 * EDI Sandbox Network Allowlist
 * Blocks production domains when EDI_MODE=sandbox
 * All outbound HTTP calls must go through this wrapper
 */

import https from 'https';
import http from 'http';

const nativeFetch = globalThis.fetch?.bind(globalThis);

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
  'canadalife.com',
  'bluecross.ca',
  'desjardins.com',
  'ssq.ca',
  'ia.ca',
  'empire.ca',
  'manulifegroup.com',
  'provider.medavie.ca'
];

// Parse allowed prefixes from environment
function getAllowedPrefixes(): string[] {
  // Default allowlist includes common development/testing prefixes
  const defaultAllowlist = 'localhost,127.0.0.1,sandbox.,test.,mock.,dev.,staging.,api-staging.,cdn.';
  const allowlist = process.env.OUTBOUND_ALLOWLIST || defaultAllowlist;
  return allowlist.split(',').map(p => p.trim()).filter(p => p.length > 0);
}

// Check if a domain is allowed
function isDomainAllowed(hostname: string): boolean {
  // Always allow in production mode
  if (process.env.EDI_MODE !== 'sandbox') {
    return true;
  }

  // Always allow localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return true;
  }

  // Allow localhost with port
  if (hostname.startsWith('localhost:') || hostname.startsWith('127.0.0.1:')) {
    return true;
  }

  // Always allow Replit domains (needed for OAuth/OIDC authentication)
  const lowerHost = hostname.toLowerCase();
  if (lowerHost === 'replit.com' || lowerHost.endsWith('.replit.com') ||
      lowerHost === 'replit.dev' || lowerHost.endsWith('.replit.dev') ||
      lowerHost === 'repl.co' || lowerHost.endsWith('.repl.co')) {
    return true;
  }

  // Check against allowed prefixes from environment
  const allowedPrefixes = getAllowedPrefixes();
  const lowerHostname = hostname.toLowerCase();
  
  for (const prefix of allowedPrefixes) {
    if (lowerHostname.startsWith(prefix)) {
      return true;
    }
    // Also check for subdomain patterns like *.sandbox.*
    if (lowerHostname.includes(`.${prefix}`)) {
      return true;
    }
  }

  // Check against blocked production domains - explicitly block them
  for (const blocked of BLOCKED_DOMAINS) {
    if (lowerHostname === blocked || lowerHostname.endsWith(`.${blocked}`)) {
      return false;
    }
  }

  // STRICT MODE: Block everything else in sandbox mode
  return false;
}

// Create SANDBOX_BLOCKED error response
function createBlockedResponse(hostname: string): any {
  // Create a fake Headers object that mimics the real one
  const mockHeaders = new Map([
    ['content-type', 'application/json'],
    ['x-sandbox-blocked', 'true']
  ]);
  
  return {
    ok: false,
    status: 403,
    statusText: 'Forbidden - Production domain blocked in sandbox mode',
    json: async () => ({
      error: 'SANDBOX_BLOCKED',
      message: `Domain ${hostname} is blocked in sandbox mode`,
      domain: hostname,
      allowedPrefixes: getAllowedPrefixes()
    }),
    text: async () => `SANDBOX_BLOCKED: ${hostname}`,
    headers: {
      get: (key: string) => mockHeaders.get(key.toLowerCase()) || null,
      entries: () => mockHeaders.entries(),
      keys: () => mockHeaders.keys(),
      values: () => mockHeaders.values(),
      has: (key: string) => mockHeaders.has(key.toLowerCase()),
      forEach: (fn: (value: string, key: string, map: Map<string, string>) => void) => mockHeaders.forEach(fn)
    }
  };
}

// Wrap fetch for sandbox protection
export async function safeFetch(url: string | Request | URL, options?: RequestInit): Promise<Response> {
  try {
    // Handle different input types
    let urlString: string;
    if (typeof url === 'string') {
      urlString = url;
    } else if (url instanceof URL) {
      urlString = url.toString();
    } else if (url instanceof Request) {
      urlString = url.url;
    } else {
      urlString = String(url);
    }

    const parsedUrl = new URL(urlString);
    
    if (!isDomainAllowed(parsedUrl.hostname)) {
      console.error(`🚫 SANDBOX_BLOCKED: Attempt to contact blocked domain: ${parsedUrl.hostname}`);
      console.error(`   EDI_MODE=${process.env.EDI_MODE}`);
      console.error(`   Allowed prefixes: ${getAllowedPrefixes().join(', ')}`);
      
      // Return mock response for blocked domains
      return createBlockedResponse(parsedUrl.hostname) as Response;
    }

    if (typeof nativeFetch !== 'function') {
      throw new Error('Native fetch is unavailable; cannot execute safeFetch');
    }

    // Use the original runtime fetch captured before global patching.
    const response = await nativeFetch(urlString, options);
    
    // In sandbox mode, add metadata to responses
    if (process.env.EDI_MODE === 'sandbox') {
      const originalJson = response.json.bind(response);
      const originalText = response.text.bind(response);
      
      (response as any).json = async () => {
        const data = await originalJson();
        return {
          ...data,
          _sandbox: true,
          _sandboxTimestamp: new Date().toISOString()
        };
      };
      
      (response as any).text = async () => {
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
    console.error(`🚫 SANDBOX_BLOCKED: HTTPS request to blocked domain: ${hostname}`);
    
    const mockResponse = {
      statusCode: 403,
      headers: {
        'content-type': 'application/json'
      },
      on: (event: string, handler: Function) => {
        if (event === 'data') {
          handler(Buffer.from(JSON.stringify({
            error: 'SANDBOX_BLOCKED',
            message: `Domain ${hostname} is blocked in sandbox mode`,
            allowedPrefixes: getAllowedPrefixes()
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
    console.error(`🚫 SANDBOX_BLOCKED: HTTP request to blocked domain: ${hostname}`);
    
    const mockResponse = {
      statusCode: 403,
      headers: {
        'content-type': 'application/json'
      },
      on: (event: string, handler: Function) => {
        if (event === 'data') {
          handler(Buffer.from(JSON.stringify({
            error: 'SANDBOX_BLOCKED',
            message: `Domain ${hostname} is blocked in sandbox mode`,
            allowedPrefixes: getAllowedPrefixes()
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
    console.log('✅ EDI Sandbox mode ACTIVE - strict domain blocking enabled');
    console.log(`   Allowed prefixes: ${getAllowedPrefixes().join(', ')}`);
    console.log(`   Blocked production domains: ${BLOCKED_DOMAINS.slice(0, 5).join(', ')}... (${BLOCKED_DOMAINS.length} total)`);
    console.log('   All other domains will be BLOCKED');
  } else {
    console.log('⚠️  EDI Sandbox mode DISABLED - all domains allowed');
    console.log('   Set EDI_MODE=sandbox to enable domain blocking');
  }
}

// Test if a specific domain would be blocked
export function testDomain(domain: string): { allowed: boolean; reason: string } {
  if (process.env.EDI_MODE !== 'sandbox') {
    return { allowed: true, reason: 'Not in sandbox mode' };
  }
  
  // Check localhost
  if (domain === 'localhost' || domain === '127.0.0.1' || 
      domain.startsWith('localhost:') || domain.startsWith('127.0.0.1:')) {
    return { allowed: true, reason: 'Localhost is always allowed' };
  }

  // Check Replit domains (needed for OAuth/OIDC)
  const lowerDomain = domain.toLowerCase();
  if (lowerDomain === 'replit.com' || lowerDomain.endsWith('.replit.com') ||
      lowerDomain === 'replit.dev' || lowerDomain.endsWith('.replit.dev') ||
      lowerDomain === 'repl.co' || lowerDomain.endsWith('.repl.co')) {
    return { allowed: true, reason: 'Replit domain always allowed for auth' };
  }
  
  // Check allowed prefixes
  const allowedPrefixes = getAllowedPrefixes();
  
  for (const prefix of allowedPrefixes) {
    if (lowerDomain.startsWith(prefix) || lowerDomain.includes(`.${prefix}`)) {
      return { 
        allowed: true, 
        reason: `Matches allowed prefix: ${prefix}` 
      };
    }
  }
  
  // Check blocked domains
  for (const blocked of BLOCKED_DOMAINS) {
    if (lowerDomain === blocked || lowerDomain.endsWith(`.${blocked}`)) {
      return { 
        allowed: false, 
        reason: `Production domain explicitly blocked: ${blocked}` 
      };
    }
  }
  
  // Strict mode: block everything else
  return { 
    allowed: false, 
    reason: 'Domain not in allowed list (strict mode)' 
  };
}

// Export for testing
export { isDomainAllowed, getAllowedPrefixes };
