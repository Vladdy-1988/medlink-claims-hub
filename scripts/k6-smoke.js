import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');

// Environment configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Test configuration
export const options = {
  // Smoke test pattern: ramp up, sustain, ramp down
  stages: [
    { duration: '30s', target: 5 },   // Ramp up to 5 virtual users
    { duration: '1m', target: 5 },    // Stay at 5 users for 1 minute
    { duration: '30s', target: 0 },   // Ramp down to 0 users
  ],
  
  // Thresholds (SLOs)
  thresholds: {
    // Overall HTTP request duration p95 should be below 400ms
    'http_req_duration': ['p(95)<400'],
    
    // Overall HTTP failure rate should be below 1%
    'http_req_failed': ['rate<0.01'],
    
    // Custom metric thresholds
    'errors': ['rate<0.01'],
    'api_latency': ['p(95)<400'],
    
    // Endpoint-specific thresholds
    'http_req_duration{endpoint:healthz}': ['p(95)<100'],
    'http_req_duration{endpoint:auth}': ['p(95)<300'],
    'http_req_duration{endpoint:claims}': ['p(95)<400'],
    
    // Check thresholds
    'checks': ['rate>0.95'], // 95% of checks should pass
  },
  
  // Tags for better reporting
  tags: {
    test_type: 'smoke',
    environment: __ENV.ENVIRONMENT || 'staging',
  },
};

// Helper function to handle authentication
function authenticate() {
  const loginPayload = JSON.stringify({
    email: __ENV.TEST_USER_EMAIL || 'test@example.com',
    password: __ENV.TEST_USER_PASSWORD || 'Test123!@#',
  });

  const loginParams = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { endpoint: 'auth' },
  };

  const loginRes = http.post(`${BASE_URL}/api/auth/login`, loginPayload, loginParams);
  
  check(loginRes, {
    'login successful': (r) => r.status === 200,
    'auth token received': (r) => r.json('token') !== undefined || r.cookies['session'] !== undefined,
  }) || errorRate.add(1);

  // Extract session/token for authenticated requests
  if (loginRes.status === 200) {
    // Check for JWT token in response
    const responseData = loginRes.json();
    if (responseData && responseData.token) {
      return { Authorization: `Bearer ${responseData.token}` };
    }
    // Or check for session cookie
    const sessionCookie = loginRes.cookies['session'] || loginRes.cookies['connect.sid'];
    if (sessionCookie && sessionCookie.length > 0) {
      return { Cookie: `session=${sessionCookie[0].value}` };
    }
  }
  
  return {};
}

// Main test scenario
export default function () {
  // Test 1: Health Check Endpoint
  group('Health Check', function () {
    const healthParams = {
      tags: { endpoint: 'healthz' },
    };
    
    const healthRes = http.get(`${BASE_URL}/healthz`, healthParams);
    const healthDuration = healthRes.timings.duration;
    apiLatency.add(healthDuration);
    
    const healthChecks = check(healthRes, {
      'health check status is 200': (r) => r.status === 200,
      'health check response time < 100ms': (r) => r.timings.duration < 100,
      'health check returns ok': (r) => {
        try {
          const body = r.json();
          return body.status === 'ok' || body.healthy === true;
        } catch {
          return r.body.includes('ok') || r.body.includes('healthy');
        }
      },
    });
    
    if (!healthChecks) {
      errorRate.add(1);
    }
    
    sleep(1);
  });

  // Test 2: Authentication Flow
  group('Authentication', function () {
    const authHeaders = authenticate();
    
    // Verify authentication worked
    if (Object.keys(authHeaders).length === 0) {
      console.error('Authentication failed - skipping authenticated endpoints');
      errorRate.add(1);
      return;
    }
    
    // Test authenticated endpoint
    const meParams = {
      headers: authHeaders,
      tags: { endpoint: 'auth' },
    };
    
    const meRes = http.get(`${BASE_URL}/api/auth/me`, meParams);
    apiLatency.add(meRes.timings.duration);
    
    const meChecks = check(meRes, {
      'user profile accessible': (r) => r.status === 200,
      'user data returned': (r) => {
        try {
          const body = r.json();
          return body.id !== undefined || body.userId !== undefined;
        } catch {
          return false;
        }
      },
    });
    
    if (!meChecks) {
      errorRate.add(1);
    }
    
    sleep(1);
  });

  // Test 3: Claims Endpoint (Authenticated)
  group('Claims API', function () {
    // Get auth headers
    const authHeaders = authenticate();
    
    if (Object.keys(authHeaders).length === 0) {
      console.error('Authentication failed - skipping claims endpoints');
      errorRate.add(1);
      return;
    }
    
    // Test GET /api/claims
    const getClaimsParams = {
      headers: authHeaders,
      tags: { endpoint: 'claims' },
    };
    
    const getClaimsRes = http.get(`${BASE_URL}/api/claims`, getClaimsParams);
    apiLatency.add(getClaimsRes.timings.duration);
    
    const getClaimsChecks = check(getClaimsRes, {
      'claims list accessible': (r) => r.status === 200,
      'claims response is array': (r) => {
        try {
          const body = r.json();
          return Array.isArray(body) || Array.isArray(body.claims);
        } catch {
          return false;
        }
      },
      'claims response time < 400ms': (r) => r.timings.duration < 400,
    });
    
    if (!getClaimsChecks) {
      errorRate.add(1);
    }
    
    sleep(1);
    
    // Test POST /api/claims (create new claim)
    const newClaim = {
      patientId: `TEST_PATIENT_${Date.now()}`,
      providerId: 'TEST_PROVIDER_001',
      serviceDate: new Date().toISOString(),
      serviceType: 'consultation',
      amount: 150.00,
      status: 'draft',
      items: [
        {
          code: '99213',
          description: 'Office visit',
          quantity: 1,
          amount: 150.00,
        }
      ],
    };
    
    const postClaimsParams = {
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      tags: { endpoint: 'claims' },
    };
    
    const postClaimsRes = http.post(
      `${BASE_URL}/api/claims`,
      JSON.stringify(newClaim),
      postClaimsParams
    );
    apiLatency.add(postClaimsRes.timings.duration);
    
    const postClaimsChecks = check(postClaimsRes, {
      'claim creation successful': (r) => r.status === 201 || r.status === 200,
      'claim ID returned': (r) => {
        try {
          const body = r.json();
          return body.id !== undefined || body.claimId !== undefined;
        } catch {
          return false;
        }
      },
      'claim creation time < 400ms': (r) => r.timings.duration < 400,
    });
    
    if (!postClaimsChecks) {
      errorRate.add(1);
    }
    
    sleep(1);
  });
}

// Test lifecycle hooks
export function setup() {
  console.log('='.repeat(50));
  console.log('K6 Smoke Test Starting');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Environment: ${__ENV.ENVIRONMENT || 'staging'}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('='.repeat(50));
  
  // Verify the target is reachable
  const res = http.get(BASE_URL);
  if (res.status === 0) {
    throw new Error(`Target ${BASE_URL} is not reachable`);
  }
  
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log('='.repeat(50));
  console.log('K6 Smoke Test Completed');
  console.log(`Duration: ${duration}s`);
  console.log('='.repeat(50));
}

// Handle test summary
export function handleSummary(data) {
  console.log('Test Summary:', JSON.stringify(data, null, 2));
  
  // Return summary in multiple formats
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data, null, 2),
  };
}

// Helper to create text summary
function textSummary(data, options) {
  const indent = options.indent || '';
  let summary = '\n' + indent + '='.repeat(40) + '\n';
  summary += indent + 'Performance Test Summary\n';
  summary += indent + '='.repeat(40) + '\n\n';
  
  // Extract key metrics
  if (data.metrics) {
    summary += indent + 'Key Metrics:\n';
    summary += indent + '-'.repeat(20) + '\n';
    
    if (data.metrics.http_req_duration) {
      const p95 = data.metrics.http_req_duration.values['p(95)'];
      summary += indent + `P95 Latency: ${p95?.toFixed(2)}ms\n`;
    }
    
    if (data.metrics.http_req_failed) {
      const failRate = data.metrics.http_req_failed.values.rate;
      summary += indent + `Error Rate: ${(failRate * 100).toFixed(2)}%\n`;
    }
    
    if (data.metrics.checks) {
      const checkRate = data.metrics.checks.values.rate;
      summary += indent + `Checks Passed: ${(checkRate * 100).toFixed(2)}%\n`;
    }
  }
  
  summary += '\n' + indent + '='.repeat(40) + '\n';
  return summary;
}