/**
 * Controlled HTTP Client using Axios
 * All axios requests must go through this wrapper to enforce allowlist
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { testDomain } from './allowlist';

// Create controlled axios instance
const httpClient: AxiosInstance = axios.create({
  timeout: 30000,
  headers: {
    'User-Agent': 'MedLink-Claims-Hub/1.0'
  }
});

// Add request interceptor to validate against allowlist
httpClient.interceptors.request.use(
  (config: AxiosRequestConfig) => {
    // Extract hostname from URL
    let hostname: string;
    
    try {
      if (config.url) {
        // Handle absolute URLs
        if (config.url.startsWith('http://') || config.url.startsWith('https://')) {
          const url = new URL(config.url);
          hostname = url.hostname;
        } else if (config.baseURL) {
          // Handle relative URLs with baseURL
          const url = new URL(config.url, config.baseURL);
          hostname = url.hostname;
        } else {
          // Assume relative URL on same host - allow
          return config;
        }
      } else if (config.baseURL) {
        const url = new URL(config.baseURL);
        hostname = url.hostname;
      } else {
        // No URL specified - allow (will fail later)
        return config;
      }
      
      // Test domain against allowlist
      const { allowed, reason } = testDomain(hostname);
      
      if (!allowed && process.env.EDI_MODE === 'sandbox') {
        console.error(`🚫 AXIOS BLOCKED: Request to ${hostname} blocked`);
        console.error(`   Reason: ${reason}`);
        
        // Throw error to cancel request
        const error = new Error(`SANDBOX_BLOCKED: Domain ${hostname} is blocked in sandbox mode`) as any;
        error.code = 'SANDBOX_BLOCKED';
        error.hostname = hostname;
        error.reason = reason;
        return Promise.reject(error);
      }
      
      // Add sandbox headers if in sandbox mode
      if (process.env.EDI_MODE === 'sandbox') {
        config.headers = {
          ...config.headers,
          'X-Sandbox-Mode': 'true',
          'X-Sandbox-Timestamp': new Date().toISOString()
        };
      }
      
      return config;
    } catch (error) {
      console.error('Error in axios request interceptor:', error);
      return Promise.reject(error);
    }
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to add sandbox metadata
httpClient.interceptors.response.use(
  (response) => {
    // Add sandbox metadata to responses
    if (process.env.EDI_MODE === 'sandbox') {
      response.data = {
        ...response.data,
        _sandbox: true,
        _sandboxTimestamp: new Date().toISOString()
      };
    }
    return response;
  },
  (error: AxiosError) => {
    // Handle sandbox blocked errors specially
    if ((error as any).code === 'SANDBOX_BLOCKED') {
      // Return a mock error response
      return Promise.resolve({
        status: 403,
        statusText: 'Forbidden',
        data: {
          error: 'SANDBOX_BLOCKED',
          message: (error as any).message,
          hostname: (error as any).hostname,
          reason: (error as any).reason
        },
        headers: {},
        config: error.config as any
      });
    }
    return Promise.reject(error);
  }
);

// Export the controlled client
export default httpClient;

// Also export a function to create custom instances with the same protection
export function createProtectedAxiosInstance(config?: AxiosRequestConfig): AxiosInstance {
  const instance = axios.create(config);
  
  // Apply the same interceptors
  instance.interceptors.request.use(
    httpClient.interceptors.request.handlers[0].fulfilled,
    httpClient.interceptors.request.handlers[0].rejected
  );
  
  instance.interceptors.response.use(
    httpClient.interceptors.response.handlers[0].fulfilled,
    httpClient.interceptors.response.handlers[0].rejected
  );
  
  return instance;
}

// Export types for better TypeScript support
export type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// Log warning if axios is imported directly elsewhere
if (process.env.NODE_ENV !== 'production') {
  console.log('✅ Protected HTTP client initialized');
  console.log('   Use this instead of importing axios directly');
}