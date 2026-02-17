#!/usr/bin/env bash
set -euo pipefail

MEDLINK_DIR="${MEDLINK_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
ITRANS_DIR="${ITRANS_DIR:-$(cd "$MEDLINK_DIR/../../modern-itrans-core" 2>/dev/null && pwd || true)}"
ARTIFACT_DIR="${E2E_ARTIFACT_DIR:-$MEDLINK_DIR/.local/itrans-cross-repo-e2e}"
RUN_STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
SUMMARY_JSON="$ARTIFACT_DIR/result.json"

GANACHE_LOG="$ARTIFACT_DIR/ganache.log"
ITRANS_LOG="$ARTIFACT_DIR/itrans-core.log"
RELAY_LOG="$ARTIFACT_DIR/itrans-relay.log"
MEDLINK_LOG="$ARTIFACT_DIR/medlink.log"
CONTRACT_LOG="$ARTIFACT_DIR/deploy-workflow-contract.log"

E2E_FAILURE_REASON=""
CLAIM_ID=""
REQUEST_ID=""
DELIVERED_COUNT=""
WORKFLOW_CONTRACT_ADDRESS=""

mkdir -p "$ARTIFACT_DIR"

command -v node >/dev/null 2>&1 || { echo "node is required" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required" >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "curl is required" >&2; exit 1; }

GANACHE_PORT="${GANACHE_PORT:-8545}"
ITRANS_PORT="${ITRANS_PORT:-3002}"
MEDLINK_PORT="${MEDLINK_PORT:-5000}"

CLAIMS_API_KEY="${CLAIMS_API_KEY:-itrans-claims-e2e-key-0001}"
WORKFLOW_API_KEY="${WORKFLOW_API_KEY:-itrans-workflow-e2e-key-0001}"
PROVIDER_SIGNATURE_HMAC_SECRET="${PROVIDER_SIGNATURE_HMAC_SECRET:-itrans-provider-signature-e2e-secret-1234567890}"
RELAY_WEBHOOK_SIGNING_SECRET="${RELAY_WEBHOOK_SIGNING_SECRET:-itrans-relay-signing-e2e-secret-1234567890}"

EVM_PRIVATE_KEY="${EVM_PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"
INSURER_ADDRESS="${INSURER_ADDRESS:-0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266}"

GANACHE_PID=""
ITRANS_PID=""
RELAY_PID=""
MEDLINK_PID=""

fail() {
  E2E_FAILURE_REASON="$1"
  echo "$1" >&2
  exit 1
}

json_get() {
  local json_input="$1"
  local path="$2"
  JSON_PATH="$path" node -e '
const fs = require("fs");

const pathExpr = String(process.env.JSON_PATH || ".");
const input = fs.readFileSync(0, "utf8");
const parsed = JSON.parse(input);

let current = parsed;
const normalized = pathExpr === "." ? "" : pathExpr.replace(/^\./, "");
const tokens = normalized
  .replace(/\[(\d+)\]/g, ".$1")
  .split(".")
  .filter(Boolean);

for (const token of tokens) {
  if (current === null || current === undefined) {
    current = null;
    break;
  }
  const key = /^[0-9]+$/.test(token) ? Number(token) : token;
  current = current[key];
}

if (current === undefined || current === null) {
  process.stdout.write("null");
} else if (typeof current === "object") {
  process.stdout.write(JSON.stringify(current));
} else {
  process.stdout.write(String(current));
}
' <<<"$json_input"
}

write_summary() {
  local status="$1"
  local finished_at="$2"
  local failure_reason="${3:-}"

  SUMMARY_STATUS="$status" \
  SUMMARY_STARTED_AT="$RUN_STARTED_AT" \
  SUMMARY_FINISHED_AT="$finished_at" \
  SUMMARY_CLAIM_ID="$CLAIM_ID" \
  SUMMARY_REQUEST_ID="$REQUEST_ID" \
  SUMMARY_WORKFLOW_CONTRACT_ADDRESS="$WORKFLOW_CONTRACT_ADDRESS" \
  SUMMARY_INSURER_ADDRESS="$INSURER_ADDRESS" \
  SUMMARY_DELIVERED_COUNT="$DELIVERED_COUNT" \
  SUMMARY_ARTIFACT_DIR="$ARTIFACT_DIR" \
  SUMMARY_FAILURE_REASON="$failure_reason" \
  SUMMARY_OUTPUT_FILE="$SUMMARY_JSON" \
  node <<'NODE'
const fs = require('fs');

const deliveredRaw = process.env.SUMMARY_DELIVERED_COUNT || '';
const deliveredCount = deliveredRaw === '' ? null : Number(deliveredRaw);
const summary = {
  status: process.env.SUMMARY_STATUS,
  startedAt: process.env.SUMMARY_STARTED_AT,
  finishedAt: process.env.SUMMARY_FINISHED_AT,
  claimId: process.env.SUMMARY_CLAIM_ID || null,
  requestId: process.env.SUMMARY_REQUEST_ID || null,
  workflowContractAddress: process.env.SUMMARY_WORKFLOW_CONTRACT_ADDRESS || null,
  insurerAddress: process.env.SUMMARY_INSURER_ADDRESS || null,
  deliveredCount: Number.isFinite(deliveredCount) ? deliveredCount : null,
  artifacts: process.env.SUMMARY_ARTIFACT_DIR || null,
};

const failureReason = process.env.SUMMARY_FAILURE_REASON || '';
if (failureReason.length > 0) {
  summary.failureReason = failureReason;
}

fs.writeFileSync(process.env.SUMMARY_OUTPUT_FILE, `${JSON.stringify(summary, null, 2)}\n`, 'utf-8');
NODE
}

cleanup() {
  set +e
  [[ -n "$MEDLINK_PID" ]] && kill "$MEDLINK_PID" >/dev/null 2>&1 || true
  [[ -n "$RELAY_PID" ]] && kill "$RELAY_PID" >/dev/null 2>&1 || true
  [[ -n "$ITRANS_PID" ]] && kill "$ITRANS_PID" >/dev/null 2>&1 || true
  [[ -n "$GANACHE_PID" ]] && kill "$GANACHE_PID" >/dev/null 2>&1 || true
}

on_exit() {
  local exit_code=$?
  local run_finished_at
  run_finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  if [[ $exit_code -eq 0 ]]; then
    write_summary "pass" "$run_finished_at"
  else
    local reason="${E2E_FAILURE_REASON:-Cross-repo E2E failed; inspect logs under ${ARTIFACT_DIR}}"
    write_summary "fail" "$run_finished_at" "$reason"
  fi

  cleanup
}
trap on_exit EXIT

if [[ -z "${ITRANS_DIR}" || ! -d "${ITRANS_DIR}" ]]; then
  fail "ITRANS_DIR is not set or not found. Set ITRANS_DIR to your modern-itrans-core path."
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  fail "DATABASE_URL must be set"
fi

wait_for_http() {
  local url="$1"
  local timeout_sec="${2:-60}"
  local start_ts
  start_ts="$(date +%s)"
  while true; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    if [[ $(( "$(date +%s)" - start_ts )) -ge "$timeout_sec" ]]; then
      echo "Timed out waiting for $url" >&2
      return 1
    fi
    sleep 1
  done
}

poll_claim_status() {
  local claim_id="$1"
  local target_status="$2"
  local timeout_sec="${3:-90}"
  local start_ts
  start_ts="$(date +%s)"
  while true; do
    local claim_json
    claim_json="$(curl -fsS "http://127.0.0.1:${MEDLINK_PORT}/api/claims/${claim_id}")"
    local current_status
    current_status="$(json_get "$claim_json" '.status')"
    if [[ "$current_status" == "$target_status" ]]; then
      return 0
    fi
    if [[ $(( "$(date +%s)" - start_ts )) -ge "$timeout_sec" ]]; then
      echo "Timed out waiting for claim ${claim_id} to reach status ${target_status}" >&2
      echo "Last claim payload: $claim_json" >&2
      return 1
    fi
    sleep 2
  done
}

echo "[E2E] Starting Ganache on port ${GANACHE_PORT}"
(
  cd "$ITRANS_DIR"
  npx ganache \
    --server.port "$GANACHE_PORT" \
    --chain.chainId 31337 \
    --wallet.totalAccounts 5 \
    --wallet.mnemonic "test test test test test test test test test test test junk" \
    >"$GANACHE_LOG" 2>&1
) &
GANACHE_PID="$!"
sleep 2

echo "[E2E] Deploying workflow contract"
(
  cd "$ITRANS_DIR"
  EVM_RPC_URL="http://127.0.0.1:${GANACHE_PORT}" \
  EVM_PRIVATE_KEY="$EVM_PRIVATE_KEY" \
  npx ts-node scripts/deployClaimWorkflowRegistry.ts
) | tee "$CONTRACT_LOG"

WORKFLOW_CONTRACT_ADDRESS="$(awk '/Contract address:/ {print $3}' "$CONTRACT_LOG" | tail -n1)"
if [[ -z "$WORKFLOW_CONTRACT_ADDRESS" ]]; then
  fail "Failed to parse workflow contract address from deployment output"
fi

echo "[E2E] Running MedLink DB migrations"
(
  cd "$MEDLINK_DIR"
  DATABASE_URL="$DATABASE_URL" npm run db:push >/dev/null
)

echo "[E2E] Starting modern-itrans-core on port ${ITRANS_PORT}"
(
  cd "$ITRANS_DIR"
  PORT="$ITRANS_PORT" \
  LEDGER_DIR="$ARTIFACT_DIR/itrans-ledger" \
  WORKFLOW_ENABLED=true \
  CLAIMS_API_KEY="$CLAIMS_API_KEY" \
  WORKFLOW_API_KEY="$WORKFLOW_API_KEY" \
  PROVIDER_SIGNATURE_HMAC_SECRET="$PROVIDER_SIGNATURE_HMAC_SECRET" \
  EVM_RPC_URL="http://127.0.0.1:${GANACHE_PORT}" \
  EVM_PRIVATE_KEY="$EVM_PRIVATE_KEY" \
  EVM_WORKFLOW_CONTRACT_ADDRESS="$WORKFLOW_CONTRACT_ADDRESS" \
  npm run dev >"$ITRANS_LOG" 2>&1
) &
ITRANS_PID="$!"

wait_for_http "http://127.0.0.1:${ITRANS_PORT}/ledger/verify" 60

echo "[E2E] Starting workflow relay worker"
(
  cd "$ITRANS_DIR"
  EVM_RPC_URL="http://127.0.0.1:${GANACHE_PORT}" \
  EVM_WORKFLOW_CONTRACT_ADDRESS="$WORKFLOW_CONTRACT_ADDRESS" \
  RELAY_WEBHOOK_SIGNING_SECRET="$RELAY_WEBHOOK_SIGNING_SECRET" \
  RELAY_MEDLINK_WEBHOOK_URL="http://127.0.0.1:${MEDLINK_PORT}/api/itrans/webhooks/workflow" \
  RELAY_STATE_FILE="$ARTIFACT_DIR/workflow-relay-state.json" \
  RELAY_START_BLOCK=0 \
  npm run relay:workflow >"$RELAY_LOG" 2>&1
) &
RELAY_PID="$!"

echo "[E2E] Starting MedLink on port ${MEDLINK_PORT}"
(
  cd "$MEDLINK_DIR"
  PORT="$MEDLINK_PORT" \
  NODE_ENV=development \
  ALLOW_DEV_AUTH_BYPASS=true \
  DEV_AUTH_USER_ID="test-user-001" \
  ENABLE_TEST_LOGIN=true \
  TEST_LOGIN_EMAIL="test@staging.local" \
  TEST_LOGIN_PASSWORD="test-pass" \
  SESSION_SECRET="session-secret-for-e2e-tests-only-1234567890" \
  ENCRYPTION_KEY="encryption-key-for-e2e-tests-only-1234567890" \
  HASH_KEY="hash-key-for-e2e-tests-only-1234567890" \
  DATABASE_URL="$DATABASE_URL" \
  ITRANS_API_URL="http://127.0.0.1:${ITRANS_PORT}" \
  ITRANS_AUTO_SUBMIT_ENABLED=true \
  ITRANS_WORKFLOW_INSURER_ADDRESS="$INSURER_ADDRESS" \
  ITRANS_CLAIMS_API_KEY="$CLAIMS_API_KEY" \
  ITRANS_WORKFLOW_API_KEY="$WORKFLOW_API_KEY" \
  ITRANS_PROVIDER_SIGNATURE_HMAC_SECRET="$PROVIDER_SIGNATURE_HMAC_SECRET" \
  ITRANS_WEBHOOK_SIGNING_SECRET="$RELAY_WEBHOOK_SIGNING_SECRET" \
  ITRANS_WEBHOOK_STATE_FILE="$ARTIFACT_DIR/itrans-webhook-state.json" \
  npm run dev >"$MEDLINK_LOG" 2>&1
) &
MEDLINK_PID="$!"

wait_for_http "http://127.0.0.1:${MEDLINK_PORT}/api/health" 90

echo "[E2E] Bootstrapping test org/user via /api/auth/login"
curl -fsS -X POST "http://127.0.0.1:${MEDLINK_PORT}/api/auth/login" \
  -H "content-type: application/json" \
  -d '{"email":"test@staging.local","password":"test-pass"}' >/dev/null

PATIENT_ID="$(json_get "$(curl -fsS "http://127.0.0.1:${MEDLINK_PORT}/api/patients")" '.[0].id')"
PROVIDER_ID="$(json_get "$(curl -fsS "http://127.0.0.1:${MEDLINK_PORT}/api/providers")" '.[0].id')"
INSURER_ID="$(json_get "$(curl -fsS "http://127.0.0.1:${MEDLINK_PORT}/api/insurers")" '.[0].id')"

if [[ -z "$PATIENT_ID" || "$PATIENT_ID" == "null" || -z "$PROVIDER_ID" || "$PROVIDER_ID" == "null" || -z "$INSURER_ID" || "$INSURER_ID" == "null" ]]; then
  fail "Failed to resolve patient/provider/insurer IDs from MedLink APIs"
fi

echo "[E2E] Creating claim through MedLink"
CLAIM_RESPONSE="$(
  curl -fsS -X POST "http://127.0.0.1:${MEDLINK_PORT}/api/claims" \
    -H "content-type: application/json" \
    -d "{
      \"patientId\":\"${PATIENT_ID}\",
      \"providerId\":\"${PROVIDER_ID}\",
      \"insurerId\":\"${INSURER_ID}\",
      \"type\":\"claim\",
      \"amount\":\"120.00\",
      \"currency\":\"CAD\",
      \"codes\":[{\"code\":\"99213\",\"description\":\"Office visit\",\"quantity\":1,\"unitPrice\":120}],
      \"notes\":\"Cross-repo E2E submission\"
    }"
)"

CLAIM_ID="$(json_get "$CLAIM_RESPONSE" '.id')"
SUBMISSION_STATE="$(json_get "$CLAIM_RESPONSE" '.itransSubmission.status')"

if [[ -z "$CLAIM_ID" || "$CLAIM_ID" == "null" ]]; then
  fail "Claim creation failed: $CLAIM_RESPONSE"
fi
if [[ "$SUBMISSION_STATE" != "queued" && "$SUBMISSION_STATE" != "running" && "$SUBMISSION_STATE" != "retrying" ]]; then
  fail "Unexpected auto-submit state: $SUBMISSION_STATE"
fi

echo "[E2E] Waiting for claim to reach submitted state"
poll_claim_status "$CLAIM_ID" "submitted" 120

REQUEST_ID="$(json_get "$(curl -fsS "http://127.0.0.1:${MEDLINK_PORT}/api/claims/${CLAIM_ID}")" '.externalId')"
if [[ -z "$REQUEST_ID" || "$REQUEST_ID" == "null" ]]; then
  fail "Claim externalId/requestId not found after submission"
fi

echo "[E2E] Adjudicating request ${REQUEST_ID} on iTrans"
curl -fsS -X POST "http://127.0.0.1:${ITRANS_PORT}/workflow/requests/${REQUEST_ID}/adjudicate" \
  -H "x-api-key: ${WORKFLOW_API_KEY}" \
  -H "content-type: application/json" \
  -d '{"decision":"APPROVED","notes":"approved by e2e test"}' >/dev/null

echo "[E2E] Waiting for relay callback to update MedLink claim to paid"
poll_claim_status "$CLAIM_ID" "paid" 120

RELAY_STATUS="$(
  curl -fsS "http://127.0.0.1:${ITRANS_PORT}/relay/workflow/status" \
    -H "x-api-key: ${WORKFLOW_API_KEY}"
)"
DELIVERED_COUNT="$(json_get "$RELAY_STATUS" '.deliveredCount')"
if [[ "${DELIVERED_COUNT}" == "null" || ! "${DELIVERED_COUNT}" =~ ^[0-9]+$ || "${DELIVERED_COUNT}" -lt 1 ]]; then
  fail "Relay delivered count is not >= 1: $RELAY_STATUS"
fi

echo "[E2E] Cross-repo workflow succeeded"
echo "  Claim ID: ${CLAIM_ID}"
echo "  Request ID: ${REQUEST_ID}"
echo "  Relay delivered count: ${DELIVERED_COUNT}"
echo "  Logs: ${ARTIFACT_DIR}"
echo "[E2E] Wrote summary: ${SUMMARY_JSON}"
