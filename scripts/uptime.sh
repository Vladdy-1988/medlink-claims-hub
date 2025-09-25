#!/bin/bash

# Health check script for the application
# Calls the /api/health endpoint and checks db.ok field
# Exit code 0: Service is healthy (HTTP 200 and db.ok is true)
# Exit code 1: Service is unhealthy or unreachable

# Configuration
SERVICE_URL="${SERVICE_URL:-http://localhost:5000}"
HEALTH_ENDPOINT="/api/health"
TIMEOUT_SECONDS=10

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Performing health check on ${SERVICE_URL}${HEALTH_ENDPOINT}..."

# Perform the health check using curl and capture the full response
RESPONSE=$(curl -s -w '\n%{http_code}' --connect-timeout ${TIMEOUT_SECONDS} "${SERVICE_URL}${HEALTH_ENDPOINT}" 2>/dev/null)

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

# Extract HTTP status code from the last line
HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)

# Extract JSON response body (everything except the last line)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '$d')

# Check if we got an HTTP response
if [ -z "${HTTP_STATUS}" ] || [ "${HTTP_STATUS}" == "000" ]; then
    echo -e "${RED}❌ ERROR: Service is unreachable${NC}"
    echo "The service did not respond or connection failed"
    echo "Endpoint: ${SERVICE_URL}${HEALTH_ENDPOINT}"
    exit 1
fi

# Check HTTP status code and db.ok field
if [ "${HTTP_STATUS}" == "200" ] || [ "${HTTP_STATUS}" == "503" ]; then
    # Parse db.ok field using jq
    DB_OK=$(echo "$RESPONSE_BODY" | jq -r '.db.ok' 2>/dev/null)
    STATUS=$(echo "$RESPONSE_BODY" | jq -r '.status' 2>/dev/null)
    VERSION=$(echo "$RESPONSE_BODY" | jq -r '.version' 2>/dev/null)
    UPTIME=$(echo "$RESPONSE_BODY" | jq -r '.uptimeSec' 2>/dev/null)
    DB_LATENCY=$(echo "$RESPONSE_BODY" | jq -r '.db.latencyMs' 2>/dev/null)
    
    if [ "$DB_OK" == "true" ] && [ "${HTTP_STATUS}" == "200" ]; then
        echo -e "${GREEN}✅ SUCCESS: Service is healthy${NC}"
        echo "HTTP Status: ${HTTP_STATUS}"
        echo "Status: ${STATUS}"
        echo "Version: ${VERSION}"
        echo "Uptime: ${UPTIME} seconds"
        echo "Database: OK (latency: ${DB_LATENCY}ms)"
        exit 0
    elif [ "$DB_OK" == "false" ]; then
        echo -e "${RED}❌ ERROR: Database is not healthy${NC}"
        echo "HTTP Status: ${HTTP_STATUS}"
        echo "Status: ${STATUS}"
        echo "Database: NOT OK"
        exit 1
    else
        echo -e "${YELLOW}⚠️  WARNING: Could not parse health response${NC}"
        echo "HTTP Status: ${HTTP_STATUS}"
        echo "Response: $RESPONSE_BODY"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  WARNING: Service returned unexpected status${NC}"
    echo "HTTP Status: ${HTTP_STATUS}"
    echo "Response: $RESPONSE_BODY"
    exit 1
fi