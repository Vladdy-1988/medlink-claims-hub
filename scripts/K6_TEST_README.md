# K6 Performance Test - Smoke Test

## Overview
This K6 smoke test (`k6-smoke.js`) validates the basic functionality and performance of the MedLink Claims Hub staging environment.

## Test Configuration

### Endpoints Tested
- **Root endpoint (/)** - Main application health check
- **API endpoints** - `/api/healthz` (primary) or `/api/` (fallback)
- **Basic load pattern** - Multiple concurrent requests to simulate real usage

### Performance SLOs
- ✅ P95 response time < 400ms
- ✅ HTTP failure rate < 1%
- ✅ 95% of checks must pass

### Load Pattern
- Ramp up to 5 virtual users over 5 seconds
- Maintain 5 concurrent users for 30 seconds
- Ramp down to 0 users over 5 seconds

## Running Locally

### Prerequisites
```bash
# Install K6 on macOS
brew install k6

# Install K6 on Linux (Ubuntu/Debian)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Install K6 on Windows
choco install k6
```

### Run Test
```bash
# Test staging environment (default)
k6 run scripts/k6-smoke.js

# Test with custom URL
k6 run scripts/k6-smoke.js -e BASE_URL=https://med-link-claims-vlad218.replit.app

# Test with JSON output for CI
k6 run \
  --out json=k6-results/results.json \
  --summary-export=k6-results/summary.json \
  scripts/k6-smoke.js \
  -e BASE_URL=https://med-link-claims-vlad218.replit.app

# Run with more verbose output
k6 run scripts/k6-smoke.js --verbose
```

## GitHub Actions Integration

The test runs automatically via GitHub Actions:
- **Schedule**: Daily at 03:30 UTC
- **Manual trigger**: Via workflow dispatch
- **Workflow**: `.github/workflows/nightly-k6.yml`

### Workflow Features
- Automatic SLO validation
- Performance metrics tracking
- Issue creation on SLO violations
- Artifact storage (30 days retention)

## Output Formats

### Console Output
```
📊 Performance Test Results
==============================
🎯 Key Metrics:
  📈 Response Times:
     • P95 Latency: 235.67ms ✅ (target: <400ms)
     • P50 Latency: 125.34ms
     • Average: 142.89ms
  
  ❌ Error Rate: 0.00% ✅ (target: <1%)
  
  ✅ Checks Passed: 100.00% ✅ (target: >95%)
```

### JSON Output (summary.json)
The test exports comprehensive metrics in JSON format for:
- Automated CI/CD processing
- Historical trend analysis
- SLO monitoring dashboards

## Troubleshooting

### Common Issues

1. **Connection refused**
   - Verify the BASE_URL is correct
   - Check if the staging server is running
   - Ensure network connectivity

2. **High error rates**
   - Check server logs for errors
   - Verify authentication endpoints if testing auth flows
   - Review rate limiting settings

3. **Performance degradation**
   - Monitor server resources
   - Check database query performance
   - Review application logs for bottlenecks

## Metrics Explained

- **http_req_duration**: Total time for HTTP request/response cycle
- **http_req_failed**: Percentage of failed requests (non-2xx/3xx status)
- **checks**: Percentage of successful validation checks
- **errors**: Custom error rate metric
- **api_latency**: Custom API response time tracking

## Contributing

When modifying the test:
1. Keep smoke tests lightweight (< 1 minute total runtime)
2. Focus on critical user paths
3. Update thresholds based on actual SLOs
4. Document any new endpoints or checks added