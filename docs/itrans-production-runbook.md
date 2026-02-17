# iTrans Integration Production Runbook

This runbook covers MedLink + modern-itrans-core operational readiness for deployment, recovery, and incident response.

## 1. Preconditions

- `modern-itrans-core` build/tests are green:
  - `npm run build`
  - `npm test`
- MedLink type baseline is green:
  - `npm run check`
- Cross-repo integration harness passes:
  - `bash scripts/itrans-cross-repo-e2e.sh`
- Staging gate harness passes:
  - `bash scripts/itrans-staging-validation.sh`

## 2. Required Secrets

Use distinct, high-entropy values (minimum 32 chars where applicable):

- MedLink:
  - `SESSION_SECRET`
  - `ENCRYPTION_KEY`
  - `HASH_KEY`
  - `ITRANS_WORKFLOW_API_KEY`
  - `ITRANS_CLAIMS_API_KEY`
  - `ITRANS_PROVIDER_SIGNATURE_HMAC_SECRET`
  - `ITRANS_WEBHOOK_SIGNING_SECRET`
- modern-itrans-core:
  - `WORKFLOW_API_KEY`
  - `CLAIMS_API_KEY`
  - `PROVIDER_SIGNATURE_HMAC_SECRET`
  - `RELAY_WEBHOOK_SIGNING_SECRET`
  - `EVM_PRIVATE_KEY`

Rotation policy:

- Rotate webhook/signature/API keys at least every 90 days.
- Rotate immediately after suspected disclosure.
- Deploy iTrans first, then MedLink, while accepting both old/new secrets during overlap window.

## 3. Ledger Backup and Restore (modern-itrans-core)

### Backup cadence

- Nightly full backup of:
  - `LEDGER_DIR`
  - Relay state file (`RELAY_STATE_FILE` or `<LEDGER_DIR>/workflow-relay-state.json`)
- Keep at least:
  - 30 daily
  - 12 monthly snapshots

### Backup command example

```bash
cd /opt/itrans
BACKUP_DIR=/secure-backups/itrans \
bash scripts/backupLedgerSnapshot.sh
```

### Restore validation

1. Stop iTrans and relay processes.
2. Restore snapshot into a clean directory and verify integrity:
```bash
cd /opt/itrans
bash scripts/restoreAndVerifyLedgerSnapshot.sh /secure-backups/itrans/itrans-ledger-<timestamp>.tar.gz
```
   - If `<archive>.sha256` exists, checksum validation runs before extraction.
   - Manifest hash values (`manifest.json`) are verified against restored files.
3. Start iTrans with restored `LEDGER_DIR`.
4. Verify API integrity:
```bash
curl -s http://127.0.0.1:3002/ledger/verify | jq
```
5. Verify relay state API:
```bash
curl -s -H "x-api-key: $WORKFLOW_API_KEY" http://127.0.0.1:3002/relay/workflow/status | jq
```
6. Resume relay worker only after both checks pass.

## 4. On-Chain “Rollback” Policy

On-chain transactions are immutable. Do not attempt rollback by chain reorg assumptions.

Correction strategy:

1. Mark affected claim in MedLink with corrective audit note.
2. Submit a corrective workflow request referencing the original request ID/hash in notes/metadata.
3. Keep both original and corrective records; reconciliation/reporting must treat correction as superseding event, not deletion.
4. Track incident ticket ID in:
   - MedLink audit event
   - iTrans ledger metadata (where available)

## 5. Auto-Submit Queue Operations (MedLink)

- Queue endpoint:
  - `GET /api/itrans/auto-submit/queue?limit=50`
- Key controls:
  - `ITRANS_AUTO_SUBMIT_MAX_ATTEMPTS`
  - `ITRANS_AUTO_SUBMIT_BASE_DELAY_MS`
  - `ITRANS_AUTO_SUBMIT_MAX_DELAY_MS`
  - `ITRANS_AUTO_SUBMIT_QUEUE_LIMIT`

Incident checks:

1. Verify queue `failed` count is stable.
2. Correlate with iTrans workflow endpoint errors.
3. If persistent failures: pause new traffic, fix upstream/auth/secrets, then resume.

## 6. Relay Operations

From modern-itrans-core:

- Relay status:
  - `GET /relay/workflow/status`
- Dead letters:
  - `GET /relay/workflow/dead-letters?limit=50`

If dead letters increase:

1. Confirm MedLink callback endpoint reachability.
2. Validate HMAC secret alignment.
3. Replay unresolved items via manual adjudication/correction workflow.

## 7. Load and Soak Gate

Minimum production gate:

- 30-minute sustained run with target concurrency and realistic payload mix.
- No unbounded growth in:
  - MedLink auto-submit queue
  - Relay dead-letter count
- P95 latency and error rate within agreed SLO.

Recommended command hooks:

- Existing load harness:
  - `./run-load-tests.sh`
- Cross-repo functional harness:
  - `bash scripts/itrans-cross-repo-e2e.sh`
- Full staging gate harness (functional + failure-injection + optional load/soak):
  - `bash scripts/itrans-staging-validation.sh`
  - Output: `.local/itrans-staging-validation/summary.json`
  - Tunables: `LOAD_DURATION`, `SOAK_DURATION`, `LOAD_TARGET_VUS`, `SOAK_VUS`

## 8. Deployment Checklist

1. Verify secrets present and rotated where required.
2. Run pre-deploy backup for iTrans ledger + relay state.
3. Deploy modern-itrans-core.
4. Deploy relay worker.
5. Deploy MedLink.
6. Run smoke checks:
   - MedLink `/api/health`
   - iTrans `/ledger/verify`
   - iTrans `/relay/workflow/status`
7. Execute one synthetic claim through full adjudication callback.
8. Confirm claim status reaches expected terminal state in MedLink UI/API.

## 9. Post-Deploy Monitors

- Alert on:
  - iTrans 5xx spikes
  - MedLink `/api/itrans/webhooks/workflow` 401/5xx spikes
  - Relay dead-letter growth
  - Auto-submit queue failed growth
- Review first 24h:
  - queue stats
  - relay dead letters
  - adjudication callback latency
