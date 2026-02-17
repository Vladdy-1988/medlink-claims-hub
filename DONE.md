# iTrans + MedLink Scope Lock and Launch Gates

Last updated: 2026-02-17
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
| G2 | Cross-repo E2E CI green with strict summary gate | PENDING | workflow run URL + `.local/itrans-cross-repo-e2e/result.json` |
| G3 | Staging validation green (functional + failure-injection + load + soak) | PENDING | workflow run URL + `.local/itrans-staging-validation/summary.json` + k6 summaries |
| G4 | Backup/restore drill green with checksum + manifest verification | PENDING | drill report + restore output |
| G5 | Secrets/security launch checklist signed off | PENDING | runbook checklist + rotation evidence |
| G6 | Insurer contract and conformance certification complete | BLOCKED | signed contract + conformance report |
| G7 | Go-live + hypercare checklist complete | PENDING | cutover checklist + hypercare report |

## Evidence checklist

Record exact links and artifact paths here before launch approval:

1. G2 Cross-repo E2E:
- Workflow run:
- Commit SHA:
- Artifact:
- Summary file (`status=pass`, `claimId`, `requestId`, `deliveredCount>=1`):

2. G3 Staging validation:
- Workflow run:
- Commit SHA:
- Artifact:
- Summary file (`status=pass`, `functionalE2E=pass`, `failureInjection=pass`, `load=pass`, `soak=pass` for launch run):
- k6 load summary:
- k6 soak summary:

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
