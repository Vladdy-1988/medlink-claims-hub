#!/bin/bash

# Health check script for the application
# Calls the /healthz endpoint and returns appropriate exit codes
# Exit code 0: Service is healthy (HTTP 200)
# Exit code 1: Service is unhealthy or unreachable

# Configuration
SERVICE_URL="${SERVICE_URL:-http://localhost:5000}"
HEALTH_ENDPOINT="/healthz"
TIMEOUT_SECONDS=10

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Performing health check on ${SERVICE_URL}${HEALTH_ENDPOINT}..."

# Perform the health check using curl
# -s: Silent mode (no progress bar)
# -o /dev/null: Discard response body
# -w "%{http_code}": Write out the HTTP status code
# --connect-timeout: Connection timeout in seconds
# -I: HEAD request (faster for health checks)
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout ${TIMEOUT_SECONDS} "${SERVICE_URL}${HEALTH_ENDPOINT}" 2>/dev/null)

# Check curl exit code
CURL_EXIT_CODE=$?

if [ ${CURL_EXIT_CODE} -ne 0 ]; then
    echo -e "${RED}❌ ERROR: Failed to connect to service${NC}"
    echo "Service URL: ${SERVICE_URL}${HEALTH_ENDPOINT}"
    echo "Curl exit code: ${CURL_EXIT_CODE}"
    
    case ${CURL_EXIT_CODE} in
        6)
            echo "Error: Could not resolve host"
            ;;
        7)
            echo "Error: Failed to connect to host"
            ;;
        28)
            echo "Error: Connection timed out after ${TIMEOUT_SECONDS} seconds"
            ;;
        *)
            echo "Error: Unknown connection error"
            ;;
    esac
    
    exit 1
fi

# Check HTTP status code
if [ "${HTTP_STATUS}" == "200" ]; then
    echo -e "${GREEN}✅ SUCCESS: Service is healthy${NC}"
    echo "HTTP Status: ${HTTP_STATUS}"
    echo "Endpoint: ${SERVICE_URL}${HEALTH_ENDPOINT}"
    exit 0
elif [ "${HTTP_STATUS}" == "000" ]; then
    echo -e "${RED}❌ ERROR: Service is unreachable${NC}"
    echo "The service did not respond or connection failed"
    echo "Endpoint: ${SERVICE_URL}${HEALTH_ENDPOINT}"
    exit 1
else
    echo -e "${YELLOW}⚠️  WARNING: Service returned non-200 status${NC}"
    echo "HTTP Status: ${HTTP_STATUS}"
    echo "Endpoint: ${SERVICE_URL}${HEALTH_ENDPOINT}"
    
    # Treat any non-200 status as unhealthy
    exit 1
fi