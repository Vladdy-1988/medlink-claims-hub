// SLO (Service Level Objectives) and Performance Thresholds for MedLink Claims Hub

export function applyThresholds() {
  return {
    // === CRITICAL SLOs ===
    
    // API Response Times - p95 must be under 400ms, p99 under 1000ms
    'http_req_duration': [
      'p(95)<400',  // 95% of requests must complete within 400ms
      'p(99)<1000', // 99% of requests must complete within 1000ms
      'avg<250',    // Average response time should be under 250ms
      'med<200',    // Median response time should be under 200ms
    ],
    
    // Error Rate - Must be less than 1%
    'http_req_failed': ['rate<0.01'],
    
    // Check Success Rate - 95% of checks must pass
    'checks': ['rate>0.95'],
    
    // === ENDPOINT-SPECIFIC SLOs ===
    
    // Claims List Performance - Must respond within 200ms
    'http_req_duration{endpoint:claims_list}': [
      'p(95)<200',
      'p(99)<300',
    ],
    
    // Dashboard Stats - Critical for user experience
    'http_req_duration{endpoint:dashboard_stats}': [
      'p(95)<300',
      'p(99)<500',
    ],
    
    // Authentication Flow
    'http_req_duration{endpoint:auth}': [
      'p(95)<150',
      'p(99)<250',
    ],
    
    // File Upload - 5MB files must upload within 5 seconds
    'http_req_duration{endpoint:file_upload}': [
      'p(95)<5000',
      'p(99)<7000',
    ],
    
    // Search Operations
    'http_req_duration{endpoint:search}': [
      'p(95)<400',
      'p(99)<600',
    ],
    
    // === CUSTOM METRICS SLOs ===
    
    // Authentication flow completion
    'auth_flow_duration': [
      'p(95)<500',
      'p(99)<1000',
    ],
    
    // Claims CRUD operations
    'claims_crud_duration': [
      'p(95)<1000',
      'p(99)<2000',
    ],
    
    // File upload operations
    'file_upload_duration': [
      'p(95)<5000',  // 5 seconds for p95
      'p(99)<7000',  // 7 seconds for p99
    ],
    
    // Search and filter operations
    'search_duration': [
      'p(95)<400',
      'p(99)<600',
    ],
    
    // Dashboard loading
    'dashboard_duration': [
      'p(95)<500',
      'p(99)<800',
    ],
    
    // MFA verification
    'mfa_duration': [
      'p(95)<200',
      'p(99)<400',
    ],
    
    // Claim creation specific
    'claim_creation_duration': [
      'p(95)<800',
      'p(99)<1500',
    ],
    
    // Dashboard load specific
    'dashboard_load_duration': [
      'p(95)<400',
      'p(99)<700',
    ],
    
    // === RELIABILITY METRICS ===
    
    // Error rates by endpoint
    'endpoint_errors': ['rate<0.02'],  // Less than 2% endpoint errors
    
    // === SYSTEM STABILITY ===
    
    // HTTP connection errors
    'http_req_connecting': ['p(95)<100'],  // Connection time
    'http_req_tls_handshaking': ['p(95)<100'],  // TLS handshake time
    'http_req_waiting': ['p(95)<350'],  // Time to first byte
    'http_req_receiving': ['p(95)<50'],  // Content download time
    
    // Rate limiting (should not trigger during normal load)
    'http_reqs{status:429}': ['count<10'],  // Less than 10 rate limit errors
    
    // Server errors
    'http_reqs{status:500}': ['count<5'],   // Less than 5 server errors
    'http_reqs{status:502}': ['count<2'],   // Less than 2 bad gateway errors
    'http_reqs{status:503}': ['count<2'],   // Less than 2 service unavailable errors
  };
}

// Performance categories for reporting
export const performanceCategories = {
  excellent: {
    p95: 200,
    p99: 400,
    errorRate: 0.001
  },
  good: {
    p95: 400,
    p99: 700,
    errorRate: 0.005
  },
  acceptable: {
    p95: 700,
    p99: 1000,
    errorRate: 0.01
  },
  poor: {
    p95: 1000,
    p99: 2000,
    errorRate: 0.05
  }
};

// Critical endpoints that must meet strict SLOs
export const criticalEndpoints = [
  '/api/auth/user',
  '/api/claims',
  '/api/dashboard/stats',
  '/api/claims/:id',
  '/health'
];

// Database performance thresholds
export const databaseThresholds = {
  connectionPool: {
    maxConnections: 50,
    warningUtilization: 0.7,  // Warn at 70% utilization
    criticalUtilization: 0.9  // Critical at 90% utilization
  },
  queryPerformance: {
    slowQueryThreshold: 100,  // Queries over 100ms are considered slow
    criticalQueryThreshold: 500,  // Queries over 500ms are critical
    maxAcceptableQueries: 1000  // Max queries per second
  }
};

// Memory thresholds
export const memoryThresholds = {
  heapUsed: {
    warning: 0.7,  // 70% of heap
    critical: 0.85  // 85% of heap
  },
  rss: {
    warningMB: 512,
    criticalMB: 768
  }
};

// N+1 query detection thresholds
export const n1QueryThresholds = {
  maxQueriesPerRequest: 10,  // More than 10 queries per request might indicate N+1
  suspiciousPattern: 5  // Same query repeated more than 5 times
};

// Evaluate test results against SLOs
export function evaluateResults(metrics) {
  const evaluation = {
    passed: true,
    failures: [],
    warnings: [],
    category: 'excellent'
  };
  
  // Check p95 response time
  const p95 = metrics.http_req_duration && metrics.http_req_duration.values && metrics.http_req_duration.values['p(95)'];
  if (p95 > 400) {
    evaluation.failures.push(`p95 response time (${p95}ms) exceeds 400ms SLO`);
    evaluation.passed = false;
  } else if (p95 > 300) {
    evaluation.warnings.push(`p95 response time (${p95}ms) approaching limit`);
  }
  
  // Check p99 response time  
  const p99 = metrics.http_req_duration && metrics.http_req_duration.values && metrics.http_req_duration.values['p(99)'];
  if (p99 > 1000) {
    evaluation.failures.push(`p99 response time (${p99}ms) exceeds 1000ms SLO`);
    evaluation.passed = false;
  } else if (p99 > 800) {
    evaluation.warnings.push(`p99 response time (${p99}ms) approaching limit`);
  }
  
  // Check error rate
  const errorRate = (metrics.http_req_failed && metrics.http_req_failed.values && metrics.http_req_failed.values.rate) || 0;
  if (errorRate > 0.01) {
    evaluation.failures.push(`Error rate (${(errorRate * 100).toFixed(2)}%) exceeds 1% SLO`);
    evaluation.passed = false;
  } else if (errorRate > 0.005) {
    evaluation.warnings.push(`Error rate (${(errorRate * 100).toFixed(2)}%) approaching limit`);
  }
  
  // Check specific endpoints
  if (metrics['http_req_duration{endpoint:claims_list}']) {
    const claimsP95 = metrics['http_req_duration{endpoint:claims_list}'].values['p(95)'];
    if (claimsP95 > 200) {
      evaluation.failures.push(`Claims list p95 (${claimsP95}ms) exceeds 200ms SLO`);
      evaluation.passed = false;
    }
  }
  
  // File upload checks
  if (metrics.file_upload_duration) {
    const uploadP95 = metrics.file_upload_duration.values['p(95)'];
    if (uploadP95 > 5000) {
      evaluation.failures.push(`File upload p95 (${uploadP95}ms) exceeds 5s SLO`);
      evaluation.passed = false;
    }
  }
  
  // Determine performance category
  if (p95 <= performanceCategories.excellent.p95 && 
      p99 <= performanceCategories.excellent.p99 &&
      errorRate <= performanceCategories.excellent.errorRate) {
    evaluation.category = 'excellent';
  } else if (p95 <= performanceCategories.good.p95 &&
             p99 <= performanceCategories.good.p99 &&
             errorRate <= performanceCategories.good.errorRate) {
    evaluation.category = 'good';
  } else if (p95 <= performanceCategories.acceptable.p95 &&
             p99 <= performanceCategories.acceptable.p99 &&
             errorRate <= performanceCategories.acceptable.errorRate) {
    evaluation.category = 'acceptable';
  } else {
    evaluation.category = 'poor';
  }
  
  return evaluation;
}

// Generate SLO compliance report
export function generateSLOReport(metrics) {
  let report = '=== SLO COMPLIANCE REPORT ===\n\n';
  
  const evaluation = evaluateResults(metrics);
  
  report += `Overall Status: ${evaluation.passed ? '✅ PASS' : '❌ FAIL'}\n`;
  report += `Performance Category: ${evaluation.category.toUpperCase()}\n\n`;
  
  if (evaluation.failures.length > 0) {
    report += '🚨 FAILURES:\n';
    evaluation.failures.forEach(failure => {
      report += `  - ${failure}\n`;
    });
    report += '\n';
  }
  
  if (evaluation.warnings.length > 0) {
    report += '⚠️  WARNINGS:\n';
    evaluation.warnings.forEach(warning => {
      report += `  - ${warning}\n`;
    });
    report += '\n';
  }
  
  // Detailed metrics
  report += '📊 KEY METRICS:\n';
  report += `  Response Times:\n`;
  const med = metrics.http_req_duration && metrics.http_req_duration.values && metrics.http_req_duration.values.med;
  const p95Val = metrics.http_req_duration && metrics.http_req_duration.values && metrics.http_req_duration.values['p(95)'];
  const p99Val = metrics.http_req_duration && metrics.http_req_duration.values && metrics.http_req_duration.values['p(99)'];
  const errRate = metrics.http_req_failed && metrics.http_req_failed.values && metrics.http_req_failed.values.rate;
  const reqRate = metrics.http_reqs && metrics.http_reqs.values && metrics.http_reqs.values.rate;
  
  report += `    - p50: ${med ? med.toFixed(2) : 'N/A'}ms\n`;
  report += `    - p95: ${p95Val ? p95Val.toFixed(2) : 'N/A'}ms\n`;
  report += `    - p99: ${p99Val ? p99Val.toFixed(2) : 'N/A'}ms\n`;
  report += `  Error Rate: ${errRate ? (errRate * 100).toFixed(3) : '0.000'}%\n`;
  report += `  Requests/sec: ${reqRate ? reqRate.toFixed(2) : 'N/A'}\n`;
  
  return report;
}

// Export all threshold functions
export default {
  applyThresholds,
  performanceCategories,
  criticalEndpoints,
  databaseThresholds,
  memoryThresholds,
  n1QueryThresholds,
  evaluateResults,
  generateSLOReport
};