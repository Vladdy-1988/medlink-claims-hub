# MedLink Claims Hub - k6 Load Testing Suite

## Overview
This comprehensive k6 load testing suite validates MedLink Claims Hub performance under various load conditions, ensuring the application meets all Service Level Objectives (SLOs).

## Test Structure

### Core Files
- **`scenarios.js`** - Main test orchestrator with multiple scenarios
- **`endpoints.js`** - API endpoint-specific tests  
- **`thresholds.js`** - SLO definitions and performance criteria
- **`helpers.js`** - Authentication, data generation, and utility functions
- **`performance-monitor.js`** - Database and memory monitoring
- **`run-load-tests.sh`** - Test execution script with reporting

## Test Scenarios

### 1. Smoke Test
- **Purpose**: Basic functionality validation
- **Load**: 1 user for 1 minute
- **Use Case**: Quick health check before deployments

### 2. Load Test  
- **Purpose**: Normal operations simulation
- **Load**: Ramps to 100 users over 5 minutes
- **Use Case**: Validate typical daily load handling

### 3. Stress Test
- **Purpose**: Peak load validation
- **Load**: Ramps to 300 users over 10 minutes  
- **Use Case**: Test system limits and degradation patterns

### 4. Spike Test
- **Purpose**: Sudden traffic surge handling
- **Load**: 0→500 users in 30 seconds
- **Use Case**: Flash traffic events, viral content scenarios

## SLO Compliance

### Critical Performance Metrics
- ✅ **p95 Response Time**: < 400ms for all API calls
- ✅ **p99 Response Time**: < 1000ms for all API calls
- ✅ **Error Rate**: < 1% across all endpoints
- ✅ **Claims List**: < 200ms response time
- ✅ **File Upload**: < 5s for 5MB files
- ✅ **Dashboard Stats**: < 300ms load time

### Endpoint-Specific SLOs
- **Authentication**: p95 < 150ms
- **Search Operations**: p95 < 400ms  
- **CRUD Operations**: p95 < 1000ms
- **File Uploads**: p95 < 5000ms

## Running Tests

### Quick Start
```bash
# Run interactive menu
./run-load-tests.sh

# Run specific scenario
./run-load-tests.sh smoke    # Quick validation
./run-load-tests.sh load     # Normal load test
./run-load-tests.sh stress   # Peak load test
./run-load-tests.sh spike    # Traffic surge test
```

### Direct k6 Commands
```bash
# Simple smoke test
k6 run --vus 1 --duration 30s tests/load/scenarios.js

# Load test with custom VUs
k6 run --vus 50 --duration 5m tests/load/scenarios.js

# Run with specific scenario
k6 run -e K6_SCENARIO=stress tests/load/scenarios.js
```

### Environment Variables
```bash
BASE_URL=http://localhost:5000  # Target URL
TEST_ENV=development            # Environment name
K6_SCENARIO=load               # Scenario to run
```

## Test Coverage

### Authentication Flow
- User login simulation
- MFA verification (when enabled)
- CSRF token handling
- Session management

### Claims Operations
- Create new claim with synthetic data
- Read claim details
- Update claim status
- List claims with pagination
- Search and filter claims

### File Operations  
- Upload various file sizes (0.5MB - 5MB)
- Attachment metadata creation
- Concurrent upload handling

### Dashboard & Analytics
- Stats aggregation performance
- Recent activity queries
- Complex filter combinations
- N+1 query detection

## Performance Monitoring

### Database Metrics
- Connection pool utilization
- Active connections count
- Query duration tracking
- Slow query detection (>100ms)
- N+1 pattern identification

### Memory Metrics
- Heap usage monitoring
- RSS memory tracking
- Memory leak detection
- Growth rate analysis

### System Health
- API error rates
- Response time percentiles
- Request throughput
- Connection errors

## Reports & Analysis

### Report Generation
Reports are automatically generated in the `reports/` directory:
- `smoke_summary_[timestamp].json` - Detailed metrics
- `performance_[timestamp].txt` - SLO compliance report
- `latest_summary.json` - Most recent test results

### Interpreting Results

#### Performance Categories
- **Excellent**: p95 < 200ms, errors < 0.1%
- **Good**: p95 < 400ms, errors < 0.5%
- **Acceptable**: p95 < 700ms, errors < 1%
- **Poor**: p95 > 1000ms, errors > 5%

#### Common Issues
- **High p95/p99**: Database query optimization needed
- **Connection pool exhaustion**: Increase pool size
- **Memory growth**: Potential memory leak
- **N+1 queries**: Implement eager loading

## Data Privacy

### Synthetic Data Only
- All test data is randomly generated
- No real patient information used
- Anonymized field values
- Test-specific metadata tagging

### Test Data Examples
```javascript
{
  type: "medication",
  patientName: "Test Patient xyz123",
  patientId: "PAT-abc12345",
  amount: 150.00,
  metadata: { testRun: true }
}
```

## Troubleshooting

### Common Issues

#### k6 not installed
```bash
# Install k6 on Ubuntu/Debian
sudo apt-get update && sudo apt-get install k6

# Or use snap
sudo snap install k6
```

#### Application not responding
- Ensure application is running on port 5000
- Check `BASE_URL` environment variable
- Verify health endpoint: `curl http://localhost:5000/health`

#### Threshold failures
- Review `reports/latest_performance.txt`
- Check database connection pool settings
- Monitor server resources during tests
- Consider vertical/horizontal scaling

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run Load Tests
  run: |
    ./run-load-tests.sh smoke
    if [ $? -ne 0 ]; then
      echo "Smoke test failed"
      exit 1
    fi
```

### Pre-deployment Checklist
1. ✅ Run smoke test
2. ✅ Verify SLO compliance
3. ✅ Check error rates < 1%
4. ✅ Review performance reports
5. ✅ Confirm no memory leaks

## Best Practices

### Test Execution
- Run smoke tests before each deployment
- Schedule load tests during off-peak hours
- Monitor production metrics during tests
- Keep test data separate from production

### Performance Optimization
- Use connection pooling efficiently
- Implement query result caching
- Optimize database indexes
- Monitor and fix N+1 queries
- Use CDN for static assets

## Future Enhancements
- [ ] WebSocket connection testing
- [ ] GraphQL endpoint testing
- [ ] Distributed load generation
- [ ] Real-time dashboard monitoring
- [ ] Automated performance regression detection

## Support
For issues or questions about load testing:
1. Check test logs in `reports/` directory
2. Review application logs for errors
3. Ensure all dependencies are installed
4. Verify network connectivity

---
*Last Updated: September 2025*
*Version: 1.0.0*