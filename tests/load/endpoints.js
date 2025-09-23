import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { 
  apiRequest, 
  checkResponse, 
  generateClaimData, 
  generatePatientData,
  uploadFile,
  generateMFACode,
  batchRequests,
  BASE_URL 
} from './helpers.js';

// Custom metrics for endpoint testing
const authFlowDuration = new Trend('auth_flow_duration');
const claimsCRUDDuration = new Trend('claims_crud_duration');
const fileUploadDuration = new Trend('file_upload_duration');
const searchDuration = new Trend('search_duration');
const dashboardDuration = new Trend('dashboard_duration');
const mfaDuration = new Trend('mfa_duration');

const endpointErrors = new Rate('endpoint_errors');
const endpointSuccesses = new Counter('endpoint_successes');

// Main endpoint testing function
export function runEndpointTests() {
  // Run all endpoint test groups
  testAuthenticationFlow();
  testClaimsCRUD();
  testFileUpload();
  testSearchAndFilter();
  testDashboardMetrics();
  testConcurrentOperations();
  testEdgeCases();
}

// Test 1: Authentication Flow
export function testAuthenticationFlow() {
  group('Authentication Flow', () => {
    const startTime = Date.now();
    
    // Test health check (no auth)
    const healthResponse = apiRequest('GET', '/health');
    check(healthResponse, {
      'Health check successful': (r) => r.status === 200
    });
    
    // Test user authentication
    const userResponse = apiRequest('GET', '/api/auth/user');
    const userSuccess = check(userResponse, {
      'User auth successful': (r) => [200, 304].includes(r.status),
      'User data returned': (r) => r.json('email') !== undefined
    });
    
    if (!userSuccess) {
      endpointErrors.add(1);
      console.error('Authentication failed');
      return;
    }
    
    // Test CSRF token generation
    const csrfResponse = apiRequest('GET', '/api/auth/csrf');
    check(csrfResponse, {
      'CSRF token received': (r) => r.status === 200 || r.headers['X-Csrf-Token']
    });
    
    // Test MFA status check (admin users)
    const mfaStatusResponse = apiRequest('GET', '/api/auth/mfa/status');
    const mfaStart = Date.now();
    
    if (mfaStatusResponse.status === 200) {
      const mfaStatus = mfaStatusResponse.json();
      
      // If MFA is enabled, simulate verification
      if (mfaStatus.mfaEnabled && !mfaStatus.mfaVerified) {
        const verifyResponse = apiRequest('POST', '/api/auth/mfa/verify', {
          code: generateMFACode()
        });
        
        check(verifyResponse, {
          'MFA verification attempted': (r) => r.status === 200 || r.status === 400
        });
      }
      
      mfaDuration.add(Date.now() - mfaStart);
    }
    
    authFlowDuration.add(Date.now() - startTime);
    endpointSuccesses.add(1);
  });
}

// Test 2: Claims CRUD Operations
export function testClaimsCRUD() {
  group('Claims CRUD Operations', () => {
    const startTime = Date.now();
    let claimId = null;
    
    // CREATE - Create new claim
    const claimData = generateClaimData();
    const createResponse = apiRequest('POST', '/api/claims', claimData);
    
    const createSuccess = check(createResponse, {
      'Claim created successfully': (r) => r.status === 201,
      'Claim ID returned': (r) => r.json('id') !== undefined
    });
    
    if (createSuccess) {
      const claim = createResponse.json();
      claimId = claim.id;
      
      // READ - Get single claim
      const getResponse = apiRequest('GET', `/api/claims/${claimId}`);
      check(getResponse, {
        'Claim retrieved successfully': (r) => r.status === 200,
        'Claim data matches': (r) => r.json('id') === claimId
      });
      
      // UPDATE - Update claim status
      const updateResponse = apiRequest('PATCH', `/api/claims/${claimId}`, {
        status: 'submitted',
        notes: 'Load test update'
      });
      
      check(updateResponse, {
        'Claim updated successfully': (r) => r.status === 200,
        'Status changed': (r) => r.json('status') === 'submitted'
      });
      
      // LIST - Get all claims
      const listResponse = apiRequest('GET', '/api/claims');
      check(listResponse, {
        'Claims list retrieved': (r) => [200, 304].includes(r.status),
        'List is array': (r) => Array.isArray(r.json()),
        'List response time < 200ms': (r) => r.timings.duration < 200
      });
      
      // Test claim timeline
      if (claimId) {
        const timelineResponse = apiRequest('GET', `/api/claims/${claimId}/timeline`);
        check(timelineResponse, {
          'Timeline retrieved': (r) => [200, 304].includes(r.status)
        });
      }
      
      endpointSuccesses.add(1);
    } else {
      endpointErrors.add(1);
      console.error('Failed to create claim for CRUD testing');
    }
    
    claimsCRUDDuration.add(Date.now() - startTime);
  });
}

// Test 3: File Upload Operations
export function testFileUpload() {
  group('File Upload Operations', () => {
    const fileSizes = [0.5, 1, 2, 5]; // Test different file sizes in MB
    
    fileSizes.forEach(size => {
      const startTime = Date.now();
      
      // Upload file
      const uploadResult = uploadFile(size);
      
      if (uploadResult) {
        const uploadSuccess = check(uploadResult.uploadResponse, {
          [`${size}MB file uploaded`]: (r) => r.status === 200 || r.status === 201,
          [`Upload time < ${size === 5 ? 5000 : 2000}ms`]: (r) => r.timings.duration < (size === 5 ? 5000 : 2000)
        });
        
        if (uploadSuccess) {
          endpointSuccesses.add(1);
          
          // Test attachment creation
          const attachmentData = {
            claimId: 'test-claim-' + Date.now(),
            filename: uploadResult.filename,
            fileType: 'application/pdf',
            fileSize: uploadResult.size,
            uploadedBy: 'load-test-user'
          };
          
          const attachResponse = apiRequest('POST', '/api/attachments', attachmentData);
          check(attachResponse, {
            'Attachment record created': (r) => r.status === 200 || r.status === 201
          });
        } else {
          endpointErrors.add(1);
        }
      }
      
      fileUploadDuration.add(Date.now() - startTime);
    });
  });
}

// Test 4: Search and Filtering
export function testSearchAndFilter() {
  group('Search and Filter Operations', () => {
    const searchQueries = [
      { endpoint: '/api/claims?status=pending', name: 'Filter by status' },
      { endpoint: '/api/claims?search=test', name: 'Text search' },
      { endpoint: '/api/claims?from=2024-01-01&to=2024-12-31', name: 'Date range filter' },
      { endpoint: '/api/claims?type=medication', name: 'Filter by type' },
      { endpoint: '/api/claims?amount_min=100&amount_max=1000', name: 'Amount range filter' },
      { endpoint: '/api/patients?search=john', name: 'Patient search' },
      { endpoint: '/api/providers?specialty=dental', name: 'Provider search' }
    ];
    
    searchQueries.forEach(query => {
      const startTime = Date.now();
      const response = apiRequest('GET', query.endpoint);
      
      const success = check(response, {
        [`${query.name} successful`]: (r) => [200, 304].includes(r.status),
        [`${query.name} < 300ms`]: (r) => r.timings.duration < 300,
        [`${query.name} returns array`]: (r) => Array.isArray(r.json())
      });
      
      if (success) {
        endpointSuccesses.add(1);
      } else {
        endpointErrors.add(1);
      }
      
      searchDuration.add(Date.now() - startTime);
    });
    
    // Test complex combined filters
    const complexQuery = '/api/claims?status=pending&type=medication&search=pain&limit=50';
    const complexResponse = apiRequest('GET', complexQuery);
    
    check(complexResponse, {
      'Complex filter query successful': (r) => [200, 304].includes(r.status),
      'Complex query < 500ms': (r) => r.timings.duration < 500
    });
  });
}

// Test 5: Dashboard Metrics Loading
export function testDashboardMetrics() {
  group('Dashboard Metrics', () => {
    const startTime = Date.now();
    
    // Main dashboard stats
    const statsResponse = apiRequest('GET', '/api/dashboard/stats');
    const statsSuccess = check(statsResponse, {
      'Dashboard stats loaded': (r) => [200, 304].includes(r.status),
      'Stats response < 300ms': (r) => r.timings.duration < 300,
      'Contains required metrics': (r) => {
        const data = r.json();
        return data.totalClaims !== undefined &&
               data.pendingClaims !== undefined &&
               data.approvedAmount !== undefined;
      }
    });
    
    // Recent activity
    const activityResponse = apiRequest('GET', '/api/claims/updates?since=' + 
      new Date(Date.now() - 3600000).toISOString());
    
    check(activityResponse, {
      'Recent activity loaded': (r) => [200, 304].includes(r.status),
      'Activity has updates field': (r) => r.json('updates') !== undefined
    });
    
    // Analytics data (if available)
    const analyticsEndpoints = [
      '/api/dashboard/claims-by-status',
      '/api/dashboard/claims-by-type',
      '/api/dashboard/monthly-trend',
      '/api/dashboard/provider-stats'
    ];
    
    analyticsEndpoints.forEach(endpoint => {
      const response = apiRequest('GET', endpoint);
      // These might not exist, so just check if they respond
      if (response.status === 200) {
        endpointSuccesses.add(1);
      }
    });
    
    if (statsSuccess) {
      endpointSuccesses.add(1);
    } else {
      endpointErrors.add(1);
    }
    
    dashboardDuration.add(Date.now() - startTime);
  });
}

// Test 6: Concurrent Operations
export function testConcurrentOperations() {
  group('Concurrent Operations', () => {
    // Batch multiple operations
    const requests = [
      { endpoint: '/api/claims', method: 'GET' },
      { endpoint: '/api/dashboard/stats', method: 'GET' },
      { endpoint: '/api/patients', method: 'GET' },
      { endpoint: '/api/providers', method: 'GET' },
      { endpoint: '/api/insurers', method: 'GET' }
    ];
    
    const responses = batchRequests(requests);
    
    responses.forEach((response, index) => {
      check(response, {
        [`Concurrent request ${index + 1} successful`]: (r) => [200, 304].includes(r.status)
      });
    });
    
    // Test concurrent claim creation
    const concurrentClaims = [];
    for (let i = 0; i < 5; i++) {
      concurrentClaims.push({
        endpoint: '/api/claims',
        method: 'POST',
        body: generateClaimData()
      });
    }
    
    const claimResponses = batchRequests(concurrentClaims);
    let successCount = 0;
    
    claimResponses.forEach((response) => {
      if (response.status === 201) {
        successCount++;
      }
    });
    
    check(successCount, {
      'At least 3/5 concurrent claims created': (count) => count >= 3
    });
  });
}

// Test 7: Edge Cases and Error Handling
export function testEdgeCases() {
  group('Edge Cases', () => {
    // Test invalid claim ID
    const invalidResponse = apiRequest('GET', '/api/claims/invalid-id-12345');
    check(invalidResponse, {
      'Invalid ID returns 404': (r) => r.status === 404
    });
    
    // Test missing required fields
    const incompleteResponse = apiRequest('POST', '/api/claims', {
      type: 'medication'
      // Missing other required fields
    });
    
    check(incompleteResponse, {
      'Missing fields returns 400': (r) => r.status === 400
    });
    
    // Test large payload
    const largeNotes = 'x'.repeat(10000);
    const claimData = generateClaimData();
    claimData.notes = largeNotes;
    const largePayloadResponse = apiRequest('POST', '/api/claims', claimData);
    
    check(largePayloadResponse, {
      'Large payload handled': (r) => [201, 400, 413].includes(r.status)
    });
    
    // Test special characters in search
    const specialCharsResponse = apiRequest('GET', '/api/claims?search=' + encodeURIComponent('test@#$%^&*()'));
    check(specialCharsResponse, {
      'Special characters handled': (r) => r.status !== 500
    });
    
    // Test pagination limits
    const paginationResponse = apiRequest('GET', '/api/claims?limit=1000&offset=0');
    check(paginationResponse, {
      'Large pagination handled': (r) => [200, 304].includes(r.status)
    });
  });
}

// Performance monitoring for database operations
export function testDatabasePerformance() {
  group('Database Performance', () => {
    // Test N+1 query patterns
    const claimsResponse = apiRequest('GET', '/api/claims?include=attachments,patient,provider');
    
    check(claimsResponse, {
      'Complex query < 500ms': (r) => r.timings.duration < 500
    });
    
    // Test connection pool under load
    const parallelRequests = [];
    for (let i = 0; i < 20; i++) {
      parallelRequests.push({
        endpoint: '/api/dashboard/stats',
        method: 'GET'
      });
    }
    
    const poolResponses = batchRequests(parallelRequests);
    let errorCount = 0;
    
    poolResponses.forEach(response => {
      if (response.status >= 500) {
        errorCount++;
      }
    });
    
    check(errorCount, {
      'Connection pool handles load': (count) => count === 0
    });
  });
}

// Export for use in scenarios
export { 
  testAuthenticationFlow as testAuth,
  testClaimsCRUD as testClaims,
  testFileUpload as testUploads,
  testSearchAndFilter as testSearch,
  testDashboardMetrics as testDashboard
};