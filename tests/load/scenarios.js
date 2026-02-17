import { sleep, check } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { authenticate, apiRequest, checkResponse, generateClaimData, thinkTime, BASE_URL } from './helpers.js';
import { runEndpointTests } from './endpoints.js';
import { applyThresholds } from './thresholds.js';

// Custom metrics
const errorRate = new Rate('errors');
const claimCreationDuration = new Trend('claim_creation_duration');
const dashboardLoadDuration = new Trend('dashboard_load_duration');

function parsePositiveIntEnv(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const LOAD_RAMP_UP_DURATION = __ENV.K6_LOAD_RAMP_UP_DURATION || '30s';
const LOAD_HOLD_DURATION = __ENV.K6_LOAD_HOLD_DURATION || '4m';
const LOAD_RAMP_DOWN_DURATION = __ENV.K6_LOAD_RAMP_DOWN_DURATION || '30s';
const LOAD_TARGET_VUS = parsePositiveIntEnv(__ENV.K6_LOAD_TARGET_VUS, 100);
const SOAK_VUS = parsePositiveIntEnv(__ENV.K6_SOAK_VUS, 50);
const SOAK_DURATION = __ENV.K6_SOAK_DURATION || '30m';
const ENABLE_SOAK_SCENARIO = __ENV.K6_ENABLE_SOAK === 'true';

const scenarios = {
  // Smoke test: Minimal load to verify system works
  smoke_test: {
    executor: 'constant-vus',
    vus: 1,
    duration: '1m',
    tags: { test_type: 'smoke' },
    env: { SCENARIO: 'smoke' },
    startTime: '0s'
  },

  // Load test: Normal expected load
  load_test: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: LOAD_RAMP_UP_DURATION, target: Math.floor(LOAD_TARGET_VUS / 2) },
      { duration: LOAD_HOLD_DURATION, target: LOAD_TARGET_VUS },
      { duration: LOAD_RAMP_DOWN_DURATION, target: 0 },
    ],
    tags: { test_type: 'load' },
    env: { SCENARIO: 'load' },
    startTime: '0s'
  },

  // Stress test: Beyond normal operations
  stress_test: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 100 },   // Ramp to 100 users
      { duration: '2m', target: 200 },   // Ramp to 200 users
      { duration: '5m', target: 300 },   // Stay at 300 users
      { duration: '2m', target: 0 },     // Ramp down
    ],
    tags: { test_type: 'stress' },
    env: { SCENARIO: 'stress' },
    startTime: '0s'
  },

  // Spike test: Sudden load increase
  spike_test: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10s', target: 0 },    // Baseline
      { duration: '30s', target: 500 },  // Spike to 500 users
      { duration: '1m', target: 500 },   // Hold the spike
      { duration: '30s', target: 0 },    // Quick ramp down
    ],
    tags: { test_type: 'spike' },
    env: { SCENARIO: 'spike' },
    startTime: '0s'
  },
};

if (ENABLE_SOAK_SCENARIO) {
  scenarios.soak_test = {
    executor: 'constant-vus',
    vus: SOAK_VUS,
    duration: SOAK_DURATION,
    tags: { test_type: 'soak' },
    env: { SCENARIO: 'soak' },
    startTime: '0s'
  };
}

// Test scenario configurations
export const options = {
  scenarios,
  
  // Apply thresholds from thresholds.js
  thresholds: applyThresholds(),
  
  // Configure summary output
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// Main test function
export default function () {
  const scenario = __ENV.SCENARIO || 'unknown';
  
  // Log current scenario
  console.log(`Running scenario: ${scenario}`);
  
  // Run appropriate test based on scenario
  switch (scenario) {
    case 'smoke':
      runSmokeTest();
      break;
    case 'load':
      runLoadTest();
      break;
    case 'stress':
      runStressTest();
      break;
    case 'spike':
      runSpikeTest();
      break;
    case 'soak':
      runSoakTest();
      break;
    default:
      runLoadTest(); // Default to load test
  }
}

// Smoke test: Basic functionality verification
function runSmokeTest() {
  console.log('Executing smoke test...');
  
  // Test basic connectivity
  const healthCheck = apiRequest('GET', '/health');
  checkResponse(healthCheck, 200, 'Health Check');
  
  // Test authentication
  const auth = authenticate();
  check(auth, {
    'Authentication successful': (a) => a.userId !== null
  });
  
  // Test main endpoints with minimal load
  const endpoints = [
    '/api/auth/user',
    '/api/claims',
    '/api/dashboard/stats',
    '/api/patients',
    '/api/providers'
  ];
  
  endpoints.forEach(endpoint => {
    const response = apiRequest('GET', endpoint);
    const success = checkResponse(response, [200, 304], `GET ${endpoint}`);
    errorRate.add(!success);
  });
  
  sleep(1);
}

// Load test: Normal operations simulation
function runLoadTest() {
  console.log('Executing load test...');
  
  // Simulate typical user journey
  const journeys = [
    simulateProviderWorkflow,
    simulateAdminWorkflow,
    simulateStaffWorkflow
  ];
  
  // Pick a random journey
  const journey = journeys[Math.floor(Math.random() * journeys.length)];
  journey();
  
  // Think time between operations
  sleep(Math.random() * 3 + 1);
}

// Stress test: Heavy load simulation
function runStressTest() {
  console.log('Executing stress test...');
  
  // Perform intensive operations
  for (let i = 0; i < 3; i++) {
    // Create multiple claims rapidly
    const claimData = generateClaimData();
    const startTime = Date.now();
    const response = apiRequest('POST', '/api/claims', claimData);
    claimCreationDuration.add(Date.now() - startTime);
    
    if (response.status === 201) {
      const claim = response.json();
      
      // Immediately update the claim
      apiRequest('PATCH', `/api/claims/${claim.id}`, {
        status: 'submitted',
        notes: 'Stress test submission'
      });
    }
    
    errorRate.add(response.status >= 400);
  }
  
  // Heavy dashboard queries
  const dashStart = Date.now();
  apiRequest('GET', '/api/dashboard/stats');
  dashboardLoadDuration.add(Date.now() - dashStart);
  
  // Minimal think time to maintain pressure
  sleep(0.5);
}

// Spike test: Sudden traffic surge
function runSpikeTest() {
  console.log('Executing spike test...');
  
  // Aggressive concurrent requests
  const requests = [];
  for (let i = 0; i < 10; i++) {
    requests.push(() => apiRequest('GET', '/api/claims'));
    requests.push(() => apiRequest('GET', '/api/dashboard/stats'));
  }
  
  // Execute all requests with minimal delay
  requests.forEach((req, index) => {
    setTimeout(() => {
      const response = req();
      errorRate.add(response.status >= 400);
    }, index * 100); // 100ms between requests
  });
  
  sleep(1);
}

// Soak test: Extended duration test
function runSoakTest() {
  console.log('Executing soak test...');
  
  // Steady load over extended period
  runLoadTest(); // Reuse load test logic
  
  // Check for memory leaks or degradation
  if (__ITER % 100 === 0) {
    console.log(`Soak test iteration ${__ITER}: Checking system stability...`);
    const metricsResponse = apiRequest('GET', '/metrics');
    if (metricsResponse.status === 200) {
      console.log('System metrics collected successfully');
    }
  }
}

// User workflow simulations
function simulateProviderWorkflow() {
  // Provider creates and submits claims
  const claimData = generateClaimData();
  
  // Create claim
  const createResponse = apiRequest('POST', '/api/claims', claimData);
  if (createResponse.status === 201) {
    const claim = createResponse.json();
    
    // View claim details
    apiRequest('GET', `/api/claims/${claim.id}`);
    
    // Submit claim
    apiRequest('PATCH', `/api/claims/${claim.id}`, {
      status: 'submitted'
    });
  }
  
  // Check dashboard
  apiRequest('GET', '/api/dashboard/stats');
}

function simulateAdminWorkflow() {
  // Admin reviews claims and manages system
  
  // View all claims
  const claimsResponse = apiRequest('GET', '/api/claims');
  
  if (claimsResponse.status === 200) {
    const claims = claimsResponse.json();
    
    // Review random claims
    if (claims && claims.length > 0) {
      const randomClaim = claims[Math.floor(Math.random() * claims.length)];
      apiRequest('GET', `/api/claims/${randomClaim.id}`);
      
      // Approve or deny claim
      const decision = Math.random() > 0.5 ? 'approved' : 'denied';
      apiRequest('PATCH', `/api/claims/${randomClaim.id}`, {
        status: decision,
        notes: `Load test ${decision}`
      });
    }
  }
  
  // Check system metrics
  apiRequest('GET', '/api/metrics');
  apiRequest('GET', '/api/dashboard/stats');
}

function simulateStaffWorkflow() {
  // Staff processes claims
  
  // Search for pending claims
  apiRequest('GET', '/api/claims?status=pending');
  
  // View patients
  apiRequest('GET', '/api/patients');
  
  // View providers
  apiRequest('GET', '/api/providers');
  
  // Dashboard check
  apiRequest('GET', '/api/dashboard/stats');
}

// Custom summary handler
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  // Console output
  console.log(textSummary(data, { indent: ' ', enableColors: true }));
  
  // Generate reports
  const reports = {
    [`reports/summary_${timestamp}.json`]: JSON.stringify(data, null, 2),
    [`reports/report_${timestamp}.html`]: htmlReport(data),
    'reports/latest_summary.json': JSON.stringify(data, null, 2),
    'reports/latest_report.html': htmlReport(data)
  };
  
  // Performance summary
  const perfSummary = generatePerformanceSummary(data);
  reports[`reports/performance_${timestamp}.txt`] = perfSummary;
  reports['reports/latest_performance.txt'] = perfSummary;
  
  return reports;
}

// Generate performance summary
function generatePerformanceSummary(data) {
  let summary = '=== MEDLINK CLAIMS HUB LOAD TEST RESULTS ===\n\n';
  summary += `Test completed at: ${new Date().toISOString()}\n`;
  summary += `Total duration: ${data.state.testRunDurationMs}ms\n\n`;
  
  // Check SLO compliance
  summary += '=== SLO COMPLIANCE ===\n';
  const slos = [
    { metric: 'http_req_duration', p95: 400, p99: 1000 },
    { metric: 'http_req_failed', threshold: 0.01 },
  ];
  
  slos.forEach(slo => {
    const metric = data.metrics[slo.metric];
    if (metric) {
      if (slo.p95) {
        const p95Pass = metric.values['p(95)'] < slo.p95;
        const p99Pass = metric.values['p(99)'] < slo.p99;
        summary += `${slo.metric}: p95=${metric.values['p(95)']}ms (${p95Pass ? 'PASS' : 'FAIL'}), p99=${metric.values['p(99)']}ms (${p99Pass ? 'PASS' : 'FAIL'})\n`;
      } else if (slo.threshold) {
        const rate = metric.values.rate;
        const pass = rate < slo.threshold;
        summary += `${slo.metric}: ${(rate * 100).toFixed(2)}% (${pass ? 'PASS' : 'FAIL'})\n`;
      }
    }
  });
  
  summary += '\n=== KEY METRICS ===\n';
  Object.entries(data.metrics).forEach(([name, metric]) => {
    if (metric.type === 'trend') {
      const avg = metric.values.avg ? metric.values.avg.toFixed(2) : 'N/A';
      const p95 = metric.values['p(95)'] ? metric.values['p(95)'].toFixed(2) : 'N/A';
      summary += `${name}: avg=${avg}ms, p95=${p95}ms\n`;
    } else if (metric.type === 'rate') {
      summary += `${name}: ${(metric.values.rate * 100).toFixed(2)}%\n`;
    }
  });
  
  return summary;
}
