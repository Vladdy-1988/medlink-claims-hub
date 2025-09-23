#!/bin/bash

# MedLink Claims Hub - Load Testing Script
# This script runs k6 load tests with different scenarios and generates reports

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:5000}"
TEST_ENV="${TEST_ENV:-development}"
REPORTS_DIR="reports"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Print colored message
print_msg() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

# Create reports directory if it doesn't exist
create_reports_dir() {
    if [ ! -d "$REPORTS_DIR" ]; then
        print_msg $BLUE "Creating reports directory..."
        mkdir -p "$REPORTS_DIR"
    fi
}

# Check if k6 is installed
check_k6() {
    if ! command -v k6 &> /dev/null; then
        print_msg $RED "Error: k6 is not installed!"
        print_msg $YELLOW "Please install k6 first: https://k6.io/docs/getting-started/installation/"
        exit 1
    fi
    print_msg $GREEN "✓ k6 is installed: $(k6 version)"
}

# Check if the application is running
check_application() {
    print_msg $BLUE "Checking if application is running at $BASE_URL..."
    
    if curl -f -s -o /dev/null -w "%{http_code}" "$BASE_URL/health" | grep -q "200\|304"; then
        print_msg $GREEN "✓ Application is running"
    else
        print_msg $YELLOW "⚠ Warning: Application may not be running at $BASE_URL"
        print_msg $YELLOW "Continue anyway? (y/n)"
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Run smoke test
run_smoke_test() {
    print_msg $BLUE "\n=== Running Smoke Test ==="
    print_msg $YELLOW "Testing basic functionality with minimal load (1 user, 1 minute)..."
    
    k6 run \
        --scenario smoke_test \
        -e BASE_URL="$BASE_URL" \
        -e TEST_ENV="$TEST_ENV" \
        -e K6_SCENARIO="smoke" \
        --out json="$REPORTS_DIR/smoke_${TIMESTAMP}.json" \
        --summary-export="$REPORTS_DIR/smoke_summary_${TIMESTAMP}.json" \
        tests/load/scenarios.js
    
    if [ $? -eq 0 ]; then
        print_msg $GREEN "✓ Smoke test completed successfully"
        return 0
    else
        print_msg $RED "✗ Smoke test failed"
        return 1
    fi
}

# Run load test
run_load_test() {
    print_msg $BLUE "\n=== Running Load Test ==="
    print_msg $YELLOW "Testing normal load conditions (100 users, 5 minutes)..."
    
    k6 run \
        --scenario load_test \
        -e BASE_URL="$BASE_URL" \
        -e TEST_ENV="$TEST_ENV" \
        -e K6_SCENARIO="load" \
        --out json="$REPORTS_DIR/load_${TIMESTAMP}.json" \
        --summary-export="$REPORTS_DIR/load_summary_${TIMESTAMP}.json" \
        tests/load/scenarios.js
    
    if [ $? -eq 0 ]; then
        print_msg $GREEN "✓ Load test completed successfully"
        return 0
    else
        print_msg $RED "✗ Load test failed"
        return 1
    fi
}

# Run stress test
run_stress_test() {
    print_msg $BLUE "\n=== Running Stress Test ==="
    print_msg $YELLOW "Testing peak load conditions (300 users, 10 minutes)..."
    print_msg $YELLOW "⚠ This test may impact application performance!"
    
    k6 run \
        --scenario stress_test \
        -e BASE_URL="$BASE_URL" \
        -e TEST_ENV="$TEST_ENV" \
        -e K6_SCENARIO="stress" \
        --out json="$REPORTS_DIR/stress_${TIMESTAMP}.json" \
        --summary-export="$REPORTS_DIR/stress_summary_${TIMESTAMP}.json" \
        tests/load/scenarios.js
    
    if [ $? -eq 0 ]; then
        print_msg $GREEN "✓ Stress test completed successfully"
        return 0
    else
        print_msg $RED "✗ Stress test failed"
        return 1
    fi
}

# Run spike test
run_spike_test() {
    print_msg $BLUE "\n=== Running Spike Test ==="
    print_msg $YELLOW "Testing sudden traffic surge (0→500 users in 30s)..."
    print_msg $YELLOW "⚠ This test will create a sudden load spike!"
    
    k6 run \
        --scenario spike_test \
        -e BASE_URL="$BASE_URL" \
        -e TEST_ENV="$TEST_ENV" \
        -e K6_SCENARIO="spike" \
        --out json="$REPORTS_DIR/spike_${TIMESTAMP}.json" \
        --summary-export="$REPORTS_DIR/spike_summary_${TIMESTAMP}.json" \
        tests/load/scenarios.js
    
    if [ $? -eq 0 ]; then
        print_msg $GREEN "✓ Spike test completed successfully"
        return 0
    else
        print_msg $RED "✗ Spike test failed"
        return 1
    fi
}

# Run all scenarios
run_all_scenarios() {
    print_msg $BLUE "\n=== Running All Test Scenarios ==="
    print_msg $YELLOW "This will run all test scenarios in sequence..."
    
    k6 run \
        -e BASE_URL="$BASE_URL" \
        -e TEST_ENV="$TEST_ENV" \
        --out json="$REPORTS_DIR/full_test_${TIMESTAMP}.json" \
        --summary-export="$REPORTS_DIR/full_summary_${TIMESTAMP}.json" \
        tests/load/scenarios.js
    
    if [ $? -eq 0 ]; then
        print_msg $GREEN "✓ All tests completed successfully"
        return 0
    else
        print_msg $RED "✗ Some tests failed - check reports for details"
        return 1
    fi
}

# Run specific endpoint tests
run_endpoint_test() {
    local endpoint=$1
    print_msg $BLUE "\n=== Running Endpoint Test: $endpoint ==="
    
    k6 run \
        -e BASE_URL="$BASE_URL" \
        -e TEST_ENV="$TEST_ENV" \
        -e TEST_ENDPOINT="$endpoint" \
        --vus 10 \
        --duration 1m \
        --out json="$REPORTS_DIR/endpoint_${endpoint//\//_}_${TIMESTAMP}.json" \
        tests/load/endpoints.js
    
    if [ $? -eq 0 ]; then
        print_msg $GREEN "✓ Endpoint test completed"
        return 0
    else
        print_msg $RED "✗ Endpoint test failed"
        return 1
    fi
}

# Generate HTML report from JSON results
generate_html_report() {
    local json_file=$1
    local html_file="${json_file%.json}.html"
    
    print_msg $BLUE "Generating HTML report..."
    
    # k6 doesn't have built-in HTML generation, so we'll create a simple summary
    if [ -f "$json_file" ]; then
        # Extract key metrics from JSON (requires jq)
        if command -v jq &> /dev/null; then
            jq -r '
                "<!DOCTYPE html>
                <html>
                <head>
                    <title>Load Test Report</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 40px; }
                        h1 { color: #333; }
                        .metric { margin: 20px 0; padding: 10px; background: #f5f5f5; }
                        .pass { color: green; }
                        .fail { color: red; }
                        table { border-collapse: collapse; width: 100%; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #4CAF50; color: white; }
                    </style>
                </head>
                <body>
                    <h1>MedLink Claims Hub - Load Test Report</h1>
                    <p>Generated: " + (now | strftime("%Y-%m-%d %H:%M:%S")) + "</p>
                    <div class=\"summary\">
                        <h2>Summary</h2>
                        <div class=\"metric\">
                            <strong>Total Requests:</strong> " + (.metrics.http_reqs.count | tostring) + "
                        </div>
                        <div class=\"metric\">
                            <strong>Failed Requests:</strong> " + (.metrics.http_req_failed.values.passes | tostring) + "
                        </div>
                        <div class=\"metric\">
                            <strong>Average Response Time:</strong> " + (.metrics.http_req_duration.values.avg | tostring) + "ms
                        </div>
                        <div class=\"metric\">
                            <strong>P95 Response Time:</strong> " + (.metrics.http_req_duration.values["p(95)"] | tostring) + "ms
                        </div>
                    </div>
                </body>
                </html>"
            ' "$json_file" > "$html_file"
            
            print_msg $GREEN "✓ HTML report generated: $html_file"
        else
            print_msg $YELLOW "⚠ jq not installed - skipping HTML report generation"
        fi
    fi
}

# Generate summary report
generate_summary() {
    local test_type=$1
    local summary_file="$REPORTS_DIR/${test_type}_summary_${TIMESTAMP}.txt"
    
    print_msg $BLUE "Generating summary report..."
    
    {
        echo "=== MedLink Claims Hub Load Test Summary ==="
        echo "Test Type: $test_type"
        echo "Timestamp: $(date)"
        echo "Base URL: $BASE_URL"
        echo "Environment: $TEST_ENV"
        echo ""
        echo "=== Results ==="
        
        # Add specific results based on test output
        if [ -f "$REPORTS_DIR/latest_performance.txt" ]; then
            cat "$REPORTS_DIR/latest_performance.txt"
        fi
        
        echo ""
        echo "=== SLO Compliance ==="
        echo "✓ p95 < 400ms: Check reports for actual value"
        echo "✓ p99 < 1000ms: Check reports for actual value"
        echo "✓ Error rate < 1%: Check reports for actual value"
        echo "✓ Claims list < 200ms: Check reports for actual value"
        echo "✓ File upload < 5s: Check reports for actual value"
        
    } > "$summary_file"
    
    print_msg $GREEN "✓ Summary saved to: $summary_file"
    
    # Display summary
    cat "$summary_file"
}

# Clean old reports
clean_old_reports() {
    print_msg $BLUE "Cleaning old reports (keeping last 10)..."
    
    # Keep only the 10 most recent reports of each type
    for type in smoke load stress spike full endpoint; do
        ls -t "$REPORTS_DIR"/${type}_*.json 2>/dev/null | tail -n +11 | xargs -r rm
        ls -t "$REPORTS_DIR"/${type}_*.html 2>/dev/null | tail -n +11 | xargs -r rm
        ls -t "$REPORTS_DIR"/${type}_*.txt 2>/dev/null | tail -n +11 | xargs -r rm
    done
    
    print_msg $GREEN "✓ Old reports cleaned"
}

# Main menu
show_menu() {
    echo ""
    print_msg $BLUE "==================================="
    print_msg $BLUE "  MedLink Claims Hub Load Testing"
    print_msg $BLUE "==================================="
    echo ""
    echo "1) Smoke Test (1 user, 1 min) - Quick validation"
    echo "2) Load Test (100 users, 5 min) - Normal conditions"
    echo "3) Stress Test (300 users, 10 min) - Peak load"
    echo "4) Spike Test (500 users spike) - Sudden traffic"
    echo "5) Run All Scenarios"
    echo "6) Test Specific Endpoint"
    echo "7) Clean Old Reports"
    echo "8) Exit"
    echo ""
    print_msg $YELLOW "Select option (1-8): "
}

# Main execution
main() {
    print_msg $BLUE "MedLink Claims Hub - Load Testing Suite"
    print_msg $BLUE "========================================"
    
    # Initial checks
    check_k6
    create_reports_dir
    check_application
    
    # Parse command line arguments
    if [ $# -gt 0 ]; then
        case "$1" in
            smoke)
                run_smoke_test
                generate_summary "smoke"
                ;;
            load)
                run_load_test
                generate_summary "load"
                ;;
            stress)
                run_stress_test
                generate_summary "stress"
                ;;
            spike)
                run_spike_test
                generate_summary "spike"
                ;;
            all)
                run_all_scenarios
                generate_summary "all"
                ;;
            endpoint)
                if [ -z "$2" ]; then
                    print_msg $RED "Error: Endpoint path required"
                    exit 1
                fi
                run_endpoint_test "$2"
                ;;
            clean)
                clean_old_reports
                ;;
            *)
                print_msg $RED "Unknown option: $1"
                echo "Usage: $0 [smoke|load|stress|spike|all|endpoint <path>|clean]"
                exit 1
                ;;
        esac
    else
        # Interactive menu
        while true; do
            show_menu
            read -r option
            
            case $option in
                1)
                    run_smoke_test
                    generate_summary "smoke"
                    ;;
                2)
                    run_load_test
                    generate_summary "load"
                    ;;
                3)
                    run_stress_test
                    generate_summary "stress"
                    ;;
                4)
                    run_spike_test
                    generate_summary "spike"
                    ;;
                5)
                    run_all_scenarios
                    generate_summary "all"
                    ;;
                6)
                    print_msg $YELLOW "Enter endpoint path (e.g., /api/claims): "
                    read -r endpoint
                    run_endpoint_test "$endpoint"
                    ;;
                7)
                    clean_old_reports
                    ;;
                8)
                    print_msg $GREEN "Goodbye!"
                    exit 0
                    ;;
                *)
                    print_msg $RED "Invalid option. Please select 1-8."
                    ;;
            esac
        done
    fi
}

# Run main function
main "$@"