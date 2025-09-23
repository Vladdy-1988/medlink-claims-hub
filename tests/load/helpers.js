import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// Base URL configuration
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Test data configuration
export const TEST_USERS = new SharedArray('test_users', function () {
  return [
    { email: 'loadtest_admin@medlinkclaims.com', id: 'test-admin-001', role: 'admin', name: 'Test Admin' },
    { email: 'loadtest_provider@medlinkclaims.com', id: 'test-provider-001', role: 'provider', name: 'Test Provider' },
    { email: 'loadtest_staff@medlinkclaims.com', id: 'test-staff-001', role: 'staff', name: 'Test Staff' }
  ];
});

// Authentication helper
export function authenticate() {
  // In development mode, authentication is bypassed
  // Return a mock authenticated session
  return {
    userId: 'dev-user-001',
    email: 'dev@medlinkclaims.com',
    token: 'dev-token',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'k6-load-test/1.0'
    }
  };
}

// Helper to generate synthetic claim data
export function generateClaimData() {
  const claimTypes = ['medication', 'dental', 'vision', 'physiotherapy', 'massage'];
  const statuses = ['draft', 'submitted', 'processing', 'approved', 'denied'];
  
  return {
    type: claimTypes[randomIntBetween(0, claimTypes.length - 1)],
    status: 'draft', // Always start as draft
    patientName: `Test Patient ${randomString(5)}`,
    patientId: `PAT-${randomString(8)}`,
    insurerId: `INS-${randomIntBetween(1000, 9999)}`,
    providerId: `PROV-${randomString(8)}`,
    serviceDate: new Date(Date.now() - randomIntBetween(0, 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    amount: randomIntBetween(50, 5000),
    currency: 'CAD',
    notes: `Load test claim created at ${new Date().toISOString()}`,
    metadata: {
      testRun: true,
      timestamp: Date.now(),
      scenario: __ENV.K6_SCENARIO || 'unknown'
    }
  };
}

// Helper to generate synthetic patient data
export function generatePatientData() {
  const provinces = ['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE'];
  
  return {
    firstName: `Test${randomString(5)}`,
    lastName: `Patient${randomString(5)}`,
    dateOfBirth: `19${randomIntBetween(50, 99)}-${String(randomIntBetween(1, 12)).padStart(2, '0')}-${String(randomIntBetween(1, 28)).padStart(2, '0')}`,
    healthCardNumber: `${randomIntBetween(1000, 9999)}-${randomIntBetween(100, 999)}-${randomIntBetween(100, 999)}`,
    province: provinces[randomIntBetween(0, provinces.length - 1)],
    email: `testpatient${randomString(8)}@example.com`,
    phone: `${randomIntBetween(200, 999)}-${randomIntBetween(200, 999)}-${randomIntBetween(1000, 9999)}`,
    address: {
      street: `${randomIntBetween(1, 999)} Test Street`,
      city: 'Test City',
      province: provinces[randomIntBetween(0, provinces.length - 1)],
      postalCode: `X${randomIntBetween(0, 9)}X ${randomIntBetween(0, 9)}X${randomIntBetween(0, 9)}`
    }
  };
}

// Helper to create a test file for upload
export function generateTestFile(sizeInMB = 1) {
  const sizeInBytes = sizeInMB * 1024 * 1024;
  const chunks = Math.ceil(sizeInBytes / 1024);
  let content = '';
  
  for (let i = 0; i < chunks; i++) {
    content += randomString(1024);
  }
  
  return {
    content: content.substring(0, sizeInBytes),
    filename: `test_file_${randomString(8)}.pdf`,
    contentType: 'application/pdf'
  };
}

// Helper to check response and extract data
export function checkResponse(response, expectedStatus = 200, testName = '') {
  const checks = check(response, {
    [`${testName} - status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
    [`${testName} - response time < 2000ms`]: (r) => r.timings.duration < 2000,
    [`${testName} - has response body`]: (r) => r.body && r.body.length > 0
  });
  
  if (!checks) {
    console.error(`Failed ${testName}: Status ${response.status}, Body: ${response.body}`);
  }
  
  try {
    return response.json();
  } catch (e) {
    return response.body;
  }
}

// Helper to make API request with authentication
export function apiRequest(method, endpoint, body = null, params = {}) {
  const auth = authenticate();
  const url = `${BASE_URL}${endpoint}`;
  
  const options = {
    headers: auth.headers
  };
  
  // Merge params into options
  for (let key in params) {
    options[key] = params[key];
  }
  
  if (body) {
    options.headers['Content-Type'] = 'application/json';
    return http[method.toLowerCase()](url, JSON.stringify(body), options);
  }
  
  return http[method.toLowerCase()](url, options);
}

// Helper to simulate file upload
export function uploadFile(sizeInMB = 1) {
  const auth = authenticate();
  const file = generateTestFile(sizeInMB);
  
  // First get upload URL
  const uploadUrlResponse = apiRequest('POST', '/api/objects/upload');
  
  if (uploadUrlResponse.status !== 200) {
    console.error('Failed to get upload URL');
    return null;
  }
  
  const { uploadURL } = uploadUrlResponse.json();
  
  // Upload file
  const uploadResponse = http.put(uploadURL, file.content, {
    headers: {
      'Content-Type': file.contentType,
      'Content-Length': file.content.length.toString()
    }
  });
  
  return {
    uploadUrlResponse,
    uploadResponse,
    filename: file.filename,
    size: file.content.length
  };
}

// Helper to batch operations for efficiency
export function batchRequests(requests) {
  return http.batch(requests.map(req => {
    const auth = authenticate();
    const headers = {};
    
    // Copy auth headers
    for (let key in auth.headers) {
      headers[key] = auth.headers[key];
    }
    
    // Copy request headers if exist
    if (req.headers) {
      for (let key in req.headers) {
        headers[key] = req.headers[key];
      }
    }
    
    return {
      method: req.method || 'GET',
      url: `${BASE_URL}${req.endpoint}`,
      body: req.body ? JSON.stringify(req.body) : null,
      params: {
        headers: headers
      }
    };
  }));
}

// Performance monitoring helpers
export function measureDatabasePerformance() {
  // Measure database-heavy operations
  const operations = [
    { endpoint: '/api/dashboard/stats', name: 'Dashboard Stats' },
    { endpoint: '/api/claims?limit=100', name: 'Claims List (100)' },
    { endpoint: '/api/claims?search=test&filter=pending', name: 'Claims Search' }
  ];
  
  const results = [];
  
  operations.forEach(op => {
    const start = Date.now();
    const response = apiRequest('GET', op.endpoint);
    const duration = Date.now() - start;
    
    results.push({
      operation: op.name,
      duration,
      status: response.status,
      success: response.status === 200 || response.status === 304
    });
  });
  
  return results;
}

// Helper to generate MFA code (mock for testing)
export function generateMFACode() {
  return String(randomIntBetween(100000, 999999));
}

// Helper to simulate realistic user behavior with think time
export function thinkTime(min = 1, max = 3) {
  const delay = randomIntBetween(min * 1000, max * 1000);
  return new Promise(resolve => setTimeout(resolve, delay));
}

// Export test configuration
export const testConfig = {
  thresholds: {
    http_req_duration: ['p(95)<400', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.95']
  },
  tags: {
    testSuite: 'medlink-claims-hub',
    environment: __ENV.TEST_ENV || 'development'
  }
};