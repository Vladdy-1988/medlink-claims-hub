import http from 'k6/http';
import { check, sleep } from 'k6';

// Environment configuration
const BASE_URL = __ENV.BASE_URL || 'https://med-link-claims-vlad218.replit.app';

// Test configuration
export const options = {
  // Simple smoke test: 5 virtual users for 30 seconds
  stages: [
    { duration: '10s', target: 5 },   // Ramp up to 5 users
    { duration: '30s', target: 5 },   // Stay at 5 users
    { duration: '10s', target: 0 },   // Ramp down
  ],
  
  // Very forgiving thresholds for staging with Replit cold starts
  thresholds: {
    'http_req_duration': ['p(95)<5000'],  // Very relaxed: 5 seconds
    'http_req_failed': ['rate<0.10'],     // Allow up to 10% failure
    'checks': ['rate>0.80'],               // 80% of checks should pass
  },
};

// Simple wake-up function with basic retry
export function setup() {
  console.log('============================================');
  console.log('K6 Smoke Test Starting');
  console.log('Target URL: ' + BASE_URL);
  console.log('============================================');
  console.log('');
  console.log('Waking up Replit app (may take 30-60 seconds)...');
  
  let success = false;
  let attempts = 0;
  let maxAttempts = 6;
  
  while (!success && attempts < maxAttempts) {
    attempts = attempts + 1;
    console.log('Attempt ' + attempts + '/' + maxAttempts + '...');
    
    try {
      let res = http.get(BASE_URL, { timeout: '90s' });
      console.log('Response status: ' + res.status);
      
      if (res.status > 0) {
        console.log('App responded! Status: ' + res.status);
        success = true;
        break;
      }
    } catch (e) {
      console.log('Request failed, will retry...');
    }
    
    if (!success && attempts < maxAttempts) {
      console.log('Waiting 10 seconds before retry...');
      sleep(10);
    }
  }
  
  if (!success) {
    throw new Error('Failed to reach ' + BASE_URL + ' after ' + maxAttempts + ' attempts');
  }
  
  console.log('');
  console.log('App is awake! Starting tests...');
  console.log('============================================');
  console.log('');
  
  return { startTime: Date.now() };
}

// Main test function
export default function () {
  // Test 1: Root endpoint
  let rootRes = http.get(BASE_URL + '/', { timeout: '30s' });
  
  check(rootRes, {
    'root status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400,
    'root response time < 5s': (r) => r.timings.duration < 5000,
  });
  
  sleep(1);
  
  // Test 2: API health endpoint
  let apiRes = http.get(BASE_URL + '/api/health', { timeout: '30s' });
  
  check(apiRes, {
    'api health status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400,
    'api response time < 5s': (r) => r.timings.duration < 5000,
  });
  
  sleep(1);
}

export function teardown(data) {
  let duration = (Date.now() - data.startTime) / 1000;
  console.log('');
  console.log('============================================');
  console.log('Test completed in ' + duration.toFixed(2) + ' seconds');
  console.log('============================================');
}

// Simple summary for GitHub Actions
export function handleSummary(data) {
  return {
    'summary.json': JSON.stringify(data, null, 2),
  };
}