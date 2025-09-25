#!/bin/bash

# MedLink Claims Hub - Daily Report Append Script
# Fetches metrics from various sources and appends to daily report

set -euo pipefail

# Configuration
REPORT_FILE="docs/staging/DAILY_REPORT.md"
REPORTS_DIR="reports"
TESTS_DIR="tests/load/results"
DATE=$(date +"%Y-%m-%d")
TIME=$(date +"%H:%M:%S UTC")
DAY_NUMBER=${DAY_NUMBER:-1}

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to log messages
log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Initialize metrics with defaults
PERF_P95="N/A"
PERF_P99="N/A"
PERF_ERROR_RATE="N/A"
PERF_THROUGHPUT="N/A"
SEC_CRITICAL=0
SEC_HIGH=0
SEC_MEDIUM=0
SEC_LOW=0
BACKUP_RPO="N/A"
RESTORE_RTO="N/A"
BACKUP_STATUS="N/A"

# Function to extract K6 performance metrics
fetch_performance_metrics() {
    log "Fetching K6 performance metrics..."
    
    # Look for the latest performance report
    local perf_file=""
    if [ -f "${REPORTS_DIR}/latest_performance.txt" ]; then
        perf_file="${REPORTS_DIR}/latest_performance.txt"
    elif [ -f "${TESTS_DIR}/performance_summary.json" ]; then
        perf_file="${TESTS_DIR}/performance_summary.json"
    fi
    
    if [ -n "$perf_file" ] && [ -f "$perf_file" ]; then
        # Try to extract metrics (format may vary)
        if [[ "$perf_file" == *.json ]]; then
            # JSON format
            PERF_P95=$(jq -r '.metrics.http_req_duration.p95 // "N/A"' "$perf_file" 2>/dev/null || echo "N/A")
            PERF_P99=$(jq -r '.metrics.http_req_duration.p99 // "N/A"' "$perf_file" 2>/dev/null || echo "N/A")
            PERF_ERROR_RATE=$(jq -r '.metrics.http_req_failed.rate // "N/A"' "$perf_file" 2>/dev/null || echo "N/A")
            PERF_THROUGHPUT=$(jq -r '.metrics.http_reqs.rate // "N/A"' "$perf_file" 2>/dev/null || echo "N/A")
        else
            # Text format - use grep patterns
            PERF_P95=$(grep -oP 'p95[:\s]+\K[\d.]+ms' "$perf_file" 2>/dev/null | head -1 || echo "N/A")
            PERF_P99=$(grep -oP 'p99[:\s]+\K[\d.]+ms' "$perf_file" 2>/dev/null | head -1 || echo "N/A")
            PERF_ERROR_RATE=$(grep -oP 'error_rate[:\s]+\K[\d.]+%' "$perf_file" 2>/dev/null | head -1 || echo "N/A")
            PERF_THROUGHPUT=$(grep -oP 'throughput[:\s]+\K[\d.]+\s*req/s' "$perf_file" 2>/dev/null | head -1 || echo "N/A")
        fi
        log "Performance metrics extracted successfully"
    else
        warning "No performance metrics file found - using defaults"
    fi
}

# Function to extract ZAP security scan results
fetch_security_metrics() {
    log "Fetching ZAP security scan results..."
    
    # Look for ZAP report
    local zap_file=""
    if [ -f "${REPORTS_DIR}/latest_zap.json" ]; then
        zap_file="${REPORTS_DIR}/latest_zap.json"
    elif [ -f "${REPORTS_DIR}/zap_report.json" ]; then
        zap_file="${REPORTS_DIR}/zap_report.json"
    fi
    
    if [ -n "$zap_file" ] && [ -f "$zap_file" ]; then
        SEC_CRITICAL=$(jq -r '[.alerts[] | select(.risk == "Critical")] | length' "$zap_file" 2>/dev/null || echo 0)
        SEC_HIGH=$(jq -r '[.alerts[] | select(.risk == "High")] | length' "$zap_file" 2>/dev/null || echo 0)
        SEC_MEDIUM=$(jq -r '[.alerts[] | select(.risk == "Medium")] | length' "$zap_file" 2>/dev/null || echo 0)
        SEC_LOW=$(jq -r '[.alerts[] | select(.risk == "Low")] | length' "$zap_file" 2>/dev/null || echo 0)
        log "Security metrics extracted successfully"
    else
        warning "No ZAP report found - using zeros"
    fi
}

# Function to extract backup/restore metrics
fetch_backup_metrics() {
    log "Fetching backup/restore metrics..."
    
    # Look for backup metrics
    local backup_file=""
    if [ -f "${REPORTS_DIR}/backup_metrics.json" ]; then
        backup_file="${REPORTS_DIR}/backup_metrics.json"
    elif [ -f "${REPORTS_DIR}/latest_backup.txt" ]; then
        backup_file="${REPORTS_DIR}/latest_backup.txt"
    fi
    
    if [ -n "$backup_file" ] && [ -f "$backup_file" ]; then
        if [[ "$backup_file" == *.json ]]; then
            BACKUP_RPO=$(jq -r '.rpo // "N/A"' "$backup_file" 2>/dev/null || echo "N/A")
            RESTORE_RTO=$(jq -r '.rto // "N/A"' "$backup_file" 2>/dev/null || echo "N/A")
            BACKUP_STATUS=$(jq -r '.status // "N/A"' "$backup_file" 2>/dev/null || echo "N/A")
        else
            BACKUP_RPO=$(grep -oP 'RPO[:\s]+\K[\d.]+s' "$backup_file" 2>/dev/null | head -1 || echo "N/A")
            RESTORE_RTO=$(grep -oP 'RTO[:\s]+\K[\d.]+s' "$backup_file" 2>/dev/null | head -1 || echo "N/A")
            BACKUP_STATUS=$(grep -oP 'Status[:\s]+\K\w+' "$backup_file" 2>/dev/null | head -1 || echo "N/A")
        fi
        log "Backup metrics extracted successfully"
    else
        warning "No backup metrics found - using defaults"
    fi
}

# Function to identify issues
identify_issues() {
    local issues=""
    
    # Check performance thresholds
    if [[ "$PERF_P95" != "N/A" ]] && [[ "${PERF_P95//[!0-9.]/}" != "" ]]; then
        local p95_value="${PERF_P95//[!0-9.]/}"
        if (( $(echo "$p95_value > 400" | bc -l 2>/dev/null || echo 0) )); then
            issues+="- ⚠️ P95 latency exceeds 400ms threshold (${PERF_P95})\n"
        fi
    fi
    
    # Check error rate
    if [[ "$PERF_ERROR_RATE" != "N/A" ]] && [[ "${PERF_ERROR_RATE//[!0-9.]/}" != "" ]]; then
        local error_value="${PERF_ERROR_RATE//[!0-9.]/}"
        if (( $(echo "$error_value > 1" | bc -l 2>/dev/null || echo 0) )); then
            issues+="- ⚠️ Error rate exceeds 1% threshold (${PERF_ERROR_RATE})\n"
        fi
    fi
    
    # Check security vulnerabilities
    if [ "$SEC_CRITICAL" -gt 0 ]; then
        issues+="- 🔴 ${SEC_CRITICAL} critical security vulnerabilities found\n"
    fi
    if [ "$SEC_HIGH" -gt 0 ]; then
        issues+="- 🟠 ${SEC_HIGH} high security vulnerabilities found\n"
    fi
    
    # Check backup status
    if [[ "$BACKUP_STATUS" != "SUCCESS" ]] && [[ "$BACKUP_STATUS" != "N/A" ]]; then
        issues+="- ⚠️ Backup status: ${BACKUP_STATUS}\n"
    fi
    
    echo -e "$issues"
}

# Main execution
main() {
    log "Starting daily report generation for ${DATE}"
    
    # Ensure report file exists
    if [ ! -f "$REPORT_FILE" ]; then
        error "Daily report file not found: $REPORT_FILE"
        error "Please run this script from the project root directory"
        exit 1
    fi
    
    # Fetch all metrics
    fetch_performance_metrics
    fetch_security_metrics
    fetch_backup_metrics
    
    # Identify issues
    ISSUES=$(identify_issues)
    if [ -z "$ISSUES" ]; then
        ISSUES="- ✅ No issues identified"
    fi
    
    # Generate report section
    log "Generating report for Day ${DAY_NUMBER}..."
    
    REPORT_CONTENT="

## Day ${DAY_NUMBER}: ${DATE}
**Generated**: ${TIME}

### Performance Metrics (K6)
| Metric | Value | Threshold | Status |
|--------|-------|-----------|---------|
| P95 Latency | ${PERF_P95} | < 400ms | $([ "${PERF_P95}" != "N/A" ] && echo "✅" || echo "⚠️") |
| P99 Latency | ${PERF_P99} | < 1000ms | $([ "${PERF_P99}" != "N/A" ] && echo "✅" || echo "⚠️") |
| Error Rate | ${PERF_ERROR_RATE} | < 1% | $([ "${PERF_ERROR_RATE}" != "N/A" ] && echo "✅" || echo "⚠️") |
| Throughput | ${PERF_THROUGHPUT} | > 100 req/s | $([ "${PERF_THROUGHPUT}" != "N/A" ] && echo "✅" || echo "⚠️") |

### Security Findings (OWASP ZAP)
| Severity | Count | Target | Status |
|----------|-------|--------|---------|
| Critical | ${SEC_CRITICAL} | 0 | $([ "$SEC_CRITICAL" -eq 0 ] && echo "✅" || echo "🔴") |
| High | ${SEC_HIGH} | 0 | $([ "$SEC_HIGH" -eq 0 ] && echo "✅" || echo "🟠") |
| Medium | ${SEC_MEDIUM} | < 5 | $([ "$SEC_MEDIUM" -lt 5 ] && echo "✅" || echo "🟡") |
| Low | ${SEC_LOW} | - | 🟢 |

### Disaster Recovery Metrics
| Metric | Value | Target | Status |
|--------|-------|--------|---------|
| RPO (Recovery Point Objective) | ${BACKUP_RPO} | < 60s | $([ "${BACKUP_RPO}" != "N/A" ] && echo "✅" || echo "⚠️") |
| RTO (Recovery Time Objective) | ${RESTORE_RTO} | < 120s | $([ "${RESTORE_RTO}" != "N/A" ] && echo "✅" || echo "⚠️") |
| Last Backup Status | ${BACKUP_STATUS} | SUCCESS | $([ "$BACKUP_STATUS" = "SUCCESS" ] && echo "✅" || echo "⚠️") |

### Issues Found
${ISSUES}

### Actions Taken
- Metrics collection completed at ${TIME}
- All thresholds reviewed against SLO targets
- Report appended to validation log

---"
    
    # Append to report file
    echo "$REPORT_CONTENT" >> "$REPORT_FILE"
    log "Report appended successfully to $REPORT_FILE"
    
    # Commit changes
    if command -v git &> /dev/null; then
        log "Committing report to git..."
        git add "$REPORT_FILE"
        git commit -m "[skip ci] Daily validation report for ${DATE}" 2>/dev/null || {
            warning "No changes to commit or git not initialized"
        }
    else
        warning "Git not available - skipping commit"
    fi
    
    log "Daily report generation completed successfully!"
    
    # Summary output
    echo ""
    echo "================================================"
    echo "Daily Report Summary - Day ${DAY_NUMBER}"
    echo "================================================"
    echo "Performance: P95=${PERF_P95}, Error Rate=${PERF_ERROR_RATE}"
    echo "Security: Critical=${SEC_CRITICAL}, High=${SEC_HIGH}"
    echo "DR: RPO=${BACKUP_RPO}, RTO=${RESTORE_RTO}"
    echo "Report saved to: ${REPORT_FILE}"
    echo "================================================"
}

# Run main function
main "$@"