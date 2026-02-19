# iTrans + MedLink Scope Lock and Launch Gates

Last updated: 2026-02-19
Owner: MedLink + iTrans integration team

## Scope lock

In-scope for launch:
- MedLink off-chain claim/preauth creation and tracking.
- iTrans immutable claim lifecycle ledger (append-only + hash chain verification).
- On-chain workflow/anchor transactions with hashed references only (no PHI on-chain).
- Relay delivery to MedLink and insurer endpoints with signature verification, retry, idempotency, and dead-letter visibility.
- Cross-repo E2E verification and staging validation gates with machine-readable artifacts.
- Backup/restore drill and on-chain correction policy documentation.

Out-of-scope for launch:
- PHI storage on-chain.
- Full smart-contract claim logic model.
- Any insurer-specific capability not covered by signed webhook contract/certification.

## Insurer dependency decision

Go-live policy:
- Production go-live is blocked until insurer webhook contract conformance and staging certification are complete.
- No partial production launch with an uncertified insurer endpoint.

## Launch gates

Status legend:
- `PASS`: gate complete with evidence link.
- `PENDING`: work not yet proven.
- `BLOCKED`: waiting on external dependency.

| Gate | Description | Status | Evidence |
|---|---|---|---|
| G0 | Scope lock approved (this file) | PASS | `DONE.md` |
| G1 | Internal code/test baseline green (MedLink + iTrans) | PASS | command logs + CI artifacts |
| G2 | Cross-repo E2E CI green with strict summary gate | PASS | [PR run](https://github.com/Vladdy-1988/medlink-claims-hub/actions/runs/22102683623) + [scheduled run](https://github.com/Vladdy-1988/medlink-claims-hub/actions/runs/22170767318) |
| G3 | Staging validation green (functional + failure-injection + load + soak + explicit SLO gate files) | PENDING | workflow run URL + `.local/itrans-staging-validation/summary.json` + `k6-load-gate.json` + `k6-soak-gate.json` |
| G4 | Backup/restore drill green with checksum + manifest verification | PENDING | drill report + restore output |
| G5 | Secrets/security launch checklist signed off | PENDING | runbook checklist + rotation evidence |
| G6 | Insurer contract and conformance certification complete | BLOCKED | signed contract + conformance report |
| G7 | Go-live + hypercare checklist complete | PENDING | cutover checklist + hypercare report |

## Evidence checklist

Record exact links and artifact paths here before launch approval:

1. G2 Cross-repo E2E:
- Workflow run (PR): https://github.com/Vladdy-1988/medlink-claims-hub/actions/runs/22102683623
- Workflow run (scheduled, latest): https://github.com/Vladdy-1988/medlink-claims-hub/actions/runs/22170767318
- Commit SHA (PR): `68e2cc5` (demo-fix branch)
- Commit SHA (main merge): per merge commit on main
- Artifact: `itrans-e2e-logs` uploaded by workflow
- Summary file (`status=pass`, `claimId`, `requestId`, `deliveredCount>=1`): verified via CI summary gate step

2. G3 Staging validation:
- Workflow run:
- Commit SHA:
- Artifact:
- Summary file (`status=pass`, `functionalE2E=pass`, `failureInjection=pass`, `load=pass`, `soak=pass` for launch run):
- k6 load summary:
- k6 soak summary:
- k6 load SLO gate (`pass=true`):
- k6 soak SLO gate (`pass=true`):

### G3 SLO definition (load + soak)

All of the following must pass in both `k6-load-gate.json` and `k6-soak-gate.json`:
- `http_reqs.count` >= gate minimum sample (`minRequestsLoad=200`, `minRequestsSoak=500` by default)
- `http_req_duration p(95)` <= `400ms`
- `http_req_duration p(99)` <= `1000ms`
- `http_req_failed.rate` <= `0.01`
- `checks.rate` >= `0.95`
- No failing k6 metric thresholds in the exported summary (`failedThresholds` must be empty)

3. G4 Backup/restore drill:
- Environment:
- Backup archive:
- Checksum verification output:
- Manifest verification output:
- Restore verification output:
- Recovery time:

4. G5 Security/secrets:
- Secrets rotation completed at:
- Distinct API keys verified:
- Production non-default secret checks verified:

5. G6 Insurer certification:
- Contract version:
- Signature and idempotency conformance report:
- Staging certification date:

6. G7 Go-live/hypercare:
- Cutover date:
- Synthetic transaction check:
- Hypercare window:
- Post-launch incident summary:

## Execution order to completion

1. Close G2 (cross-repo E2E CI proof).
2. Close G3 (staging validation with load/soak enabled).
3. Close G4 and G5 (resilience + security launch evidence).
4. Close G6 with insurer.
5. Execute G7 go-live and hypercare.
