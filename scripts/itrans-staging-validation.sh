#!/usr/bin/env bash
set -euo pipefail

MEDLINK_DIR="${MEDLINK_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
ITRANS_DIR="${ITRANS_DIR:-$(cd "$MEDLINK_DIR/../../modern-itrans-core" 2>/dev/null && pwd || true)}"
ARTIFACT_DIR="${VALIDATION_ARTIFACT_DIR:-$MEDLINK_DIR/.local/itrans-staging-validation}"

RUN_FUNCTIONAL_E2E="${RUN_FUNCTIONAL_E2E:-true}"
RUN_FAILURE_INJECTION_TESTS="${RUN_FAILURE_INJECTION_TESTS:-true}"
RUN_LOAD_TESTS="${RUN_LOAD_TESTS:-false}"

STAGING_BASE_URL="${STAGING_BASE_URL:-}"
LOAD_DURATION="${LOAD_DURATION:-5m}"
SOAK_DURATION="${SOAK_DURATION:-30m}"
LOAD_TARGET_VUS="${LOAD_TARGET_VUS:-100}"
SOAK_VUS="${SOAK_VUS:-50}"
SLO_P95_MAX_MS="${SLO_P95_MAX_MS:-400}"
SLO_P99_MAX_MS="${SLO_P99_MAX_MS:-1000}"
SLO_ERROR_RATE_MAX="${SLO_ERROR_RATE_MAX:-0.01}"
SLO_CHECK_RATE_MIN="${SLO_CHECK_RATE_MIN:-0.95}"
SLO_MIN_REQUESTS_LOAD="${SLO_MIN_REQUESTS_LOAD:-200}"
SLO_MIN_REQUESTS_SOAK="${SLO_MIN_REQUESTS_SOAK:-500}"

mkdir -p "$ARTIFACT_DIR"

if [[ -z "${ITRANS_DIR}" || ! -d "${ITRANS_DIR}" ]]; then
  echo "ITRANS_DIR is not set or not found. Set ITRANS_DIR to your modern-itrans-core path." >&2
  exit 1
fi

command -v node >/dev/null 2>&1 || { echo "node is required" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required" >&2; exit 1; }

RUN_STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
functional_status="skipped"
failure_injection_status="skipped"
load_status="skipped"
soak_status="skipped"
overall_status="pass"
load_gate_file="$ARTIFACT_DIR/k6-load-gate.json"
soak_gate_file="$ARTIFACT_DIR/k6-soak-gate.json"

echo "[validation] artifacts: $ARTIFACT_DIR"

if [[ "$RUN_FUNCTIONAL_E2E" == "true" ]]; then
  : "${DATABASE_URL:?DATABASE_URL must be set when RUN_FUNCTIONAL_E2E=true}"
  echo "[validation] Running cross-repo functional E2E"
  if (
    cd "$MEDLINK_DIR"
    DATABASE_URL="$DATABASE_URL" \
    ITRANS_DIR="$ITRANS_DIR" \
    E2E_ARTIFACT_DIR="$ARTIFACT_DIR/cross-repo-e2e" \
    bash scripts/itrans-cross-repo-e2e.sh
  ) >"$ARTIFACT_DIR/functional-e2e.log" 2>&1; then
    functional_status="pass"
  else
    functional_status="fail"
    overall_status="fail"
  fi
fi

if [[ "$RUN_FAILURE_INJECTION_TESTS" == "true" ]]; then
  echo "[validation] Running relay failure-injection test suite"
  if (
    cd "$ITRANS_DIR"
    node --test --test-concurrency=1 --require ts-node/register \
      tests/relay/workflowRelayState.test.ts \
      tests/relay/workflowEventRelay.test.ts
  ) >"$ARTIFACT_DIR/failure-injection.log" 2>&1; then
    failure_injection_status="pass"
  else
    failure_injection_status="fail"
    overall_status="fail"
  fi
fi

if [[ "$RUN_LOAD_TESTS" == "true" ]]; then
  : "${STAGING_BASE_URL:?STAGING_BASE_URL must be set when RUN_LOAD_TESTS=true}"
  if ! command -v k6 >/dev/null 2>&1; then
    echo "k6 is required when RUN_LOAD_TESTS=true" >&2
    exit 1
  fi

  echo "[validation] Running load test (${LOAD_DURATION}) against ${STAGING_BASE_URL}"
  if (
    cd "$MEDLINK_DIR"
    k6 run \
      --out json="$ARTIFACT_DIR/k6-load.json" \
      --summary-export="$ARTIFACT_DIR/k6-load-summary.json" \
      tests/load/scenarios.js \
      -e BASE_URL="$STAGING_BASE_URL" \
      -e TEST_ENV=staging \
      -e K6_SCENARIO=load \
      -e K6_LOAD_HOLD_DURATION="$LOAD_DURATION" \
      -e K6_LOAD_TARGET_VUS="$LOAD_TARGET_VUS"
  ) >"$ARTIFACT_DIR/load-test.log" 2>&1; then
    if (
      cd "$MEDLINK_DIR"
      node scripts/validate-k6-summary.mjs \
        --summary "$ARTIFACT_DIR/k6-load-summary.json" \
        --out "$load_gate_file" \
        --gate load \
        --min-requests "$SLO_MIN_REQUESTS_LOAD" \
        --p95-max-ms "$SLO_P95_MAX_MS" \
        --p99-max-ms "$SLO_P99_MAX_MS" \
        --error-rate-max "$SLO_ERROR_RATE_MAX" \
        --check-rate-min "$SLO_CHECK_RATE_MIN"
    ) >"$ARTIFACT_DIR/load-slo-gate.log" 2>&1; then
      load_status="pass"
    else
      load_status="fail"
      overall_status="fail"
    fi
  else
    load_status="fail"
    overall_status="fail"
  fi

  echo "[validation] Running soak test (${SOAK_DURATION}) against ${STAGING_BASE_URL}"
  if (
    cd "$MEDLINK_DIR"
    k6 run \
      --out json="$ARTIFACT_DIR/k6-soak.json" \
      --summary-export="$ARTIFACT_DIR/k6-soak-summary.json" \
      tests/load/scenarios.js \
      -e BASE_URL="$STAGING_BASE_URL" \
      -e TEST_ENV=staging \
      -e K6_SCENARIO=soak \
      -e K6_ENABLE_SOAK=true \
      -e K6_SOAK_DURATION="$SOAK_DURATION" \
      -e K6_SOAK_VUS="$SOAK_VUS"
  ) >"$ARTIFACT_DIR/soak-test.log" 2>&1; then
    if (
      cd "$MEDLINK_DIR"
      node scripts/validate-k6-summary.mjs \
        --summary "$ARTIFACT_DIR/k6-soak-summary.json" \
        --out "$soak_gate_file" \
        --gate soak \
        --min-requests "$SLO_MIN_REQUESTS_SOAK" \
        --p95-max-ms "$SLO_P95_MAX_MS" \
        --p99-max-ms "$SLO_P99_MAX_MS" \
        --error-rate-max "$SLO_ERROR_RATE_MAX" \
        --check-rate-min "$SLO_CHECK_RATE_MIN"
    ) >"$ARTIFACT_DIR/soak-slo-gate.log" 2>&1; then
      soak_status="pass"
    else
      soak_status="fail"
      overall_status="fail"
    fi
  else
    soak_status="fail"
    overall_status="fail"
  fi
fi

RUN_FINISHED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
SUMMARY_FILE="$ARTIFACT_DIR/summary.json"

cat > "$SUMMARY_FILE" <<EOF
{
  "status": "${overall_status}",
  "startedAt": "${RUN_STARTED_AT}",
  "finishedAt": "${RUN_FINISHED_AT}",
  "gates": {
    "functionalE2E": "${functional_status}",
    "failureInjection": "${failure_injection_status}",
    "load": "${load_status}",
    "soak": "${soak_status}"
  },
  "slo": {
    "p95MaxMs": ${SLO_P95_MAX_MS},
    "p99MaxMs": ${SLO_P99_MAX_MS},
    "errorRateMax": ${SLO_ERROR_RATE_MAX},
    "checkRateMin": ${SLO_CHECK_RATE_MIN},
    "minRequestsLoad": ${SLO_MIN_REQUESTS_LOAD},
    "minRequestsSoak": ${SLO_MIN_REQUESTS_SOAK},
    "loadGateFile": "${load_gate_file}",
    "soakGateFile": "${soak_gate_file}"
  },
  "artifacts": "${ARTIFACT_DIR}"
}
EOF

echo "[validation] Summary written: $SUMMARY_FILE"
cat "$SUMMARY_FILE"

if [[ "$overall_status" != "pass" ]]; then
  exit 1
fi
