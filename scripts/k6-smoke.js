import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');

// Environment configuration
const BASE_URL = __ENV.BASE_URL || 'https://med-link-claims-vlad218.replit.app';

// Test configuration
export const options = {
  // Simple smoke test: 5 virtual users for 30 seconds
  stages: [
    { duration: '5s', target: 5 },   // Ramp up to 5 virtual users
    { duration: '30s', target: 5 },  // Stay at 5 users for 30 seconds
    { duration: '5s', target: 0 },   // Ramp down to 0 users
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
    'http_req_duration{endpoint:root}': ['p(95)<400'],
    'http_req_duration{endpoint:api_healthz}': ['p(95)<200'],
    'http_req_duration{endpoint:api_root}': ['p(95)<200'],
    
    // Check thresholds - 95% of checks should pass
    'checks': ['rate>0.95'],
  },
  
  // Tags for better reporting
  tags: {
    test_type: 'smoke',
    environment: __ENV.ENVIRONMENT || 'staging',
  },
  
  // Don't save cookies between iterations
  noConnectionReuse: true,
  noVUConnectionReuse: true,
};

// Main test scenario
export default function () {
  // Test 1: Root Health Check Endpoint (/)
  group('Root Health Check', function () {
    const rootParams = {
      tags: { endpoint: 'root' },
      timeout: '10s',
    };
    
    const rootRes = http.get(BASE_URL + '/', rootParams);
    const rootDuration = rootRes.timings.duration;
    apiLatency.add(rootDuration);
    
    const rootChecks = check(rootRes, {
      'root endpoint status is 200': (r) => r.status === 200,
      'root endpoint response time < 400ms': (r) => r.timings.duration < 400,
      'root endpoint has content': (r) => r.body && r.body.length > 0,
      'root endpoint returns HTML': (r) => {
        const contentType = r.headers['Content-Type'] || r.headers['content-type'] || '';
        return contentType.includes('text/html') || r.body.includes('<!DOCTYPE') || r.body.includes('<html');
      },
    });
    
    if (!rootChecks) {
      errorRate.add(1);
      console.log(`Root endpoint check failed: status=${rootRes.status}, duration=${rootDuration}ms`);
    }
    
    sleep(1);
  });

  // Test 2: API Health Check Endpoint (/api/healthz or /api/)
  group('API Health Check', function () {
    // Try /api/healthz first
    const healthzParams = {
      tags: { endpoint: 'api_healthz' },
      timeout: '10s',
    };
    
    let apiRes = http.get(BASE_URL + '/api/healthz', healthzParams);
    
    // If /api/healthz doesn't exist (404), try /api/
    if (apiRes.status === 404) {
      const apiParams = {
        tags: { endpoint: 'api_root' },
        timeout: '10s',
      };
      apiRes = http.get(BASE_URL + '/api/', apiParams);
    }
    
    const apiDuration = apiRes.timings.duration;
    apiLatency.add(apiDuration);
    
    const apiChecks = check(apiRes, {
      'API endpoint accessible': (r) => r.status === 200 || r.status === 201 || r.status === 204,
      'API endpoint response time < 400ms': (r) => r.timings.duration < 400,
      'API endpoint returns valid response': (r) => {
        // Check if it's a valid API response
        if (r.status === 200 || r.status === 201) {
          try {
            // Try to parse as JSON
            const body = JSON.parse(r.body);
            return true;
          } catch {
            // If not JSON, check if it has some content
            return r.body && r.body.length > 0;
          }
        }
        return r.status === 204; // No content is also valid
      },
    });
    
    if (!apiChecks) {
      errorRate.add(1);
      console.log(`API endpoint check failed: status=${apiRes.status}, duration=${apiDuration}ms`);
    }
    
    sleep(1);
  });

  // Test 3: Basic Load Pattern - Additional root endpoint requests
  group('Basic Load Test', function () {
    // Make 3 quick successive requests to simulate basic load
    for (let i = 0; i < 3; i++) {
      const loadParams = {
        tags: { endpoint: 'root', request_num: i + 1 },
        timeout: '10s',
      };
      
      const loadRes = http.get(BASE_URL + '/', loadParams);
      apiLatency.add(loadRes.timings.duration);
      
      const loadChecks = check(loadRes, {
        [`request ${i + 1} successful`]: (r) => r.status === 200,
        [`request ${i + 1} fast (<400ms)`]: (r) => r.timings.duration < 400,
      });
      
      if (!loadChecks) {
        errorRate.add(1);
      }
      
      // Small delay between requests
      sleep(0.5);
    }
  });
  
  // Random sleep between iterations (1-3 seconds)
  sleep(1 + Math.random() * 2);
}

// Test lifecycle hooks
export function setup() {
  console.log('='.repeat(60));
  console.log('K6 Smoke Test Starting');
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`Environment: ${__ENV.ENVIRONMENT || 'staging'}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  
  // Verify the target is reachable
  console.log('\nVerifying target is reachable...');
  const res = http.get(BASE_URL, { timeout: '20s' });
  
  if (res.status === 0) {
    throw new Error(`Target ${BASE_URL} is not reachable. Please check the URL and network connectivity.`);
  }
  
  console.log(`✅ Target is reachable (status: ${res.status})`);
  console.log(`✅ Response time: ${res.timings.duration}ms`);
  console.log('\nStarting performance tests...\n');
  
  return { 
    startTime: Date.now(),
    baseUrl: BASE_URL,
  };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log('\n' + '='.repeat(60));
  console.log('K6 Smoke Test Completed');
  console.log(`Total Duration: ${duration.toFixed(2)}s`);
  console.log(`Target URL: ${data.baseUrl}`);
  console.log('='.repeat(60));
}

// Handle test summary - Compatible with GitHub workflow
export function handleSummary(data) {
  console.log('\n📊 Test Summary:');
  
  // Create a text summary for console output
  let textSummary = '\n' + '='.repeat(60) + '\n';
  textSummary += '📊 Performance Test Results\n';
  textSummary += '='.repeat(60) + '\n\n';
  
  // Extract and display key metrics
  if (data.metrics) {
    textSummary += '🎯 Key Metrics:\n';
    textSummary += '-'.repeat(30) + '\n';
    
    // P95 Latency
    if (data.metrics.http_req_duration) {
      const p95 = data.metrics.http_req_duration.values['p(95)'];
      const p50 = data.metrics.http_req_duration.values['p(50)'];
      const avg = data.metrics.http_req_duration.values['avg'];
      
      textSummary += `  📈 Response Times:\n`;
      textSummary += `     • P95 Latency: ${p95?.toFixed(2)}ms ${p95 < 400 ? '✅' : '❌'} (target: <400ms)\n`;
      textSummary += `     • P50 Latency: ${p50?.toFixed(2)}ms\n`;
      textSummary += `     • Average: ${avg?.toFixed(2)}ms\n`;
    }
    
    // Error Rate
    if (data.metrics.http_req_failed) {
      const failRate = data.metrics.http_req_failed.values.rate || 0;
      const failPercent = (failRate * 100).toFixed(2);
      textSummary += `\n  ❌ Error Rate: ${failPercent}% ${failRate < 0.01 ? '✅' : '❌'} (target: <1%)\n`;
    }
    
    // Success Rate
    if (data.metrics.checks) {
      const checkRate = data.metrics.checks.values.rate || 0;
      const successPercent = (checkRate * 100).toFixed(2);
      textSummary += `\n  ✅ Checks Passed: ${successPercent}% ${checkRate > 0.95 ? '✅' : '❌'} (target: >95%)\n`;
    }
    
    // Request counts
    if (data.metrics.http_reqs) {
      const totalReqs = data.metrics.http_reqs.values.count;
      const reqRate = data.metrics.http_reqs.values.rate;
      textSummary += `\n  📊 Total Requests: ${totalReqs}\n`;
      textSummary += `  📊 Request Rate: ${reqRate?.toFixed(2)} req/s\n`;
    }
    
    // Custom metrics
    if (data.metrics.errors) {
      const errorRate = data.metrics.errors.values.rate || 0;
      const errorPercent = (errorRate * 100).toFixed(2);
      textSummary += `\n  🔍 Custom Error Rate: ${errorPercent}%\n`;
    }
  }
  
  // Threshold results
  textSummary += '\n' + '='.repeat(60) + '\n';
  textSummary += '🎯 SLO Validation:\n';
  textSummary += '-'.repeat(30) + '\n';
  
  let allPassed = true;
  if (data.metrics) {
    // Check P95 < 400ms
    const p95 = data.metrics.http_req_duration?.values['p(95)'] || 0;
    if (p95 < 400) {
      textSummary += '  ✅ P95 latency < 400ms: PASS\n';
    } else {
      textSummary += '  ❌ P95 latency < 400ms: FAIL\n';
      allPassed = false;
    }
    
    // Check error rate < 1%
    const failRate = data.metrics.http_req_failed?.values.rate || 0;
    if (failRate < 0.01) {
      textSummary += '  ✅ Error rate < 1%: PASS\n';
    } else {
      textSummary += '  ❌ Error rate < 1%: FAIL\n';
      allPassed = false;
    }
  }
  
  textSummary += '\n' + '='.repeat(60) + '\n';
  textSummary += `📋 Overall Result: ${allPassed ? '✅ PASS' : '❌ FAIL'}\n`;
  textSummary += '='.repeat(60) + '\n';
  
  // Print to console
  console.log(textSummary);
  
  // Return outputs compatible with GitHub workflow
  // The workflow expects JSON files in specific locations
  return {
    'stdout': textSummary, // Console output
    'summary.json': JSON.stringify(data, null, 2), // For the workflow to process
  };
}