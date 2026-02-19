# iTrans + MedLink Claims Integration: Go-Live & Hypercare Checklist

| Field        | Value                                        |
|--------------|----------------------------------------------|
| **Version**  | 1.0                                          |
| **Date**     | 2026-02-19                                   |
| **Authors**  | [NAME], [NAME]                               |
| **Status**   | DRAFT                                        |
| **Approver** | [ENGINEERING LEAD NAME]                      |

---

## 1. Pre-Cutover Checklist (T-48h to T-0)

Complete **all** items before proceeding to cutover. Each item requires a sign-off.

### T-48h: Readiness Verification

- [ ] All gates G0 through G6 in `DONE.md` are marked **PASS**
- [ ] Final integration test suite passes in staging environment
- [ ] Load/stress test results reviewed and within acceptable thresholds
- [ ] Staging environment mirrors production configuration

### T-24h: Security & Infrastructure

- [ ] All secrets (API keys, HMAC secrets, blockchain wallet keys) rotated
- [ ] Rotated secrets deployed to production secret manager (not committed to repo)
- [ ] TLS certificates verified and not expiring within 90 days
- [ ] Network security groups / firewall rules reviewed for production
- [ ] `ITRANS_AUTO_SUBMIT_ENABLED` is set to `false` in production MedLink config

### T-12h: Backup & Recovery

- [ ] Ledger backup taken using `backupLedgerSnapshot.sh`
- [ ] Backup verified using `restoreAndVerifyLedgerSnapshot.sh` against a disposable instance
- [ ] PostgreSQL database backup taken for MedLink
- [ ] Backup restoration procedure tested end-to-end
- [ ] Backup artifacts stored in designated off-site location: `[BACKUP LOCATION]`

### T-6h: Monitoring & Alerting

- [ ] All monitoring dashboards deployed (see [Section 5](#5-monitoring-dashboard-checklist))
- [ ] Alert rules configured and verified with test alerts
- [ ] PagerDuty / on-call tool integration confirmed
- [ ] Log aggregation pipeline verified (structured logs flowing from all services)

### T-2h: Team & Communications

- [ ] Rollback plan reviewed by at least two engineers
- [ ] On-call schedule confirmed for hypercare window (see [Section 4](#4-hypercare-plan-72-hours))
- [ ] War room / incident channel created: `[CHANNEL NAME]`
- [ ] Stakeholder communication sent (go-live window, expected downtime, contact info)

### T-0: Final Go / No-Go

- [ ] **Go / No-Go decision** made by: [ENGINEERING LEAD NAME]
- [ ] All pre-cutover items above checked and signed off
- [ ] On-call engineers present and acknowledged

---

## 2. Cutover Steps

Execute these steps **sequentially**. Do not skip ahead. Record the timestamp for each step.

| Step | Action | Owner | Timestamp | Status |
|------|--------|-------|-----------|--------|
| 1 | Take pre-cutover backup | | | |
| 2 | Deploy modern-itrans-core | | | |
| 3 | Verify iTrans health | | | |
| 4 | Deploy relay worker | | | |
| 5 | Verify relay status | | | |
| 6 | Deploy MedLink | | | |
| 7 | Verify MedLink health | | | |
| 8 | Run synthetic claim | | | |
| 9 | Verify callback and claim update | | | |
| 10 | Enable auto-submit | | | |
| 11 | Monitor first 10 organic claims | | | |

### Step Details

**Step 1 -- Take pre-cutover backup**

```bash
./backupLedgerSnapshot.sh --env production --tag "pre-cutover-$(date +%Y%m%dT%H%M%S)"
```
- [ ] Backup file written and checksum recorded
- [ ] PostgreSQL backup of MedLink database taken

**Step 2 -- Deploy modern-itrans-core**

- [ ] Deploy the approved iTrans release tag: `[RELEASE TAG]`
- [ ] Confirm deployment target matches approved artifact (SHA match)
- [ ] Wait for service to report healthy

**Step 3 -- Verify iTrans health**

```
GET /ledger/verify
```
- [ ] Response status: `200 OK`
- [ ] Response body indicates ledger integrity: no hash mismatches
- [ ] Response time under 500ms

**Step 4 -- Deploy relay worker**

- [ ] Deploy workflow relay worker release tag: `[RELEASE TAG]`
- [ ] Confirm worker process is running
- [ ] Verify worker picks up configuration (retry policy, webhook targets)

**Step 5 -- Verify relay status**

```
GET /relay/workflow/status
```
- [ ] Response status: `200 OK`
- [ ] Worker reports connected and idle (no backlog)
- [ ] Dead-letter queue is empty: `GET /relay/workflow/dead-letters` returns count = 0

**Step 6 -- Deploy MedLink**

- [ ] Deploy MedLink release tag: `[RELEASE TAG]`
- [ ] Confirm `ITRANS_AUTO_SUBMIT_ENABLED=false` (auto-submit still disabled)
- [ ] Wait for service to report healthy

**Step 7 -- Verify MedLink health**

```
GET /api/health
```
- [ ] Response status: `200 OK`
- [ ] Database connectivity confirmed
- [ ] iTrans connectivity confirmed (MedLink can reach iTrans endpoints)

**Step 8 -- Run synthetic claim through full lifecycle**

- [ ] Submit a synthetic/test claim via MedLink API
- [ ] Verify claim appears in iTrans ledger with correct event-sourced state
- [ ] Verify blockchain anchor transaction is submitted and confirmed on-chain

**Step 9 -- Verify callback received and claim updated**

- [ ] MedLink received the status callback from iTrans relay
- [ ] Claim record in MedLink PostgreSQL updated to reflect adjudicated status
- [ ] End-to-end latency recorded: `[VALUE]` ms

**Step 10 -- Enable auto-submit**

- [ ] Set `ITRANS_AUTO_SUBMIT_ENABLED=true` in MedLink production config
- [ ] Restart or hot-reload MedLink to pick up the configuration change
- [ ] Confirm auto-submit queue is active and draining

**Step 11 -- Monitor first 10 organic claims**

- [ ] Watch the first 10 real claims flow through the full lifecycle
- [ ] Verify each claim: submitted, ledger event created, anchored, callback received
- [ ] Confirm no errors in logs for any of the 10 claims
- [ ] Record success rate: `___/10`
- [ ] If any claim fails, stop and evaluate before proceeding (see [Rollback Procedure](#3-rollback-procedure))

---

## 3. Rollback Procedure

### 3.1 Decision Criteria

Initiate rollback if **any** of the following occur during cutover or within the first 4 hours:

| Trigger | Threshold |
|---------|-----------|
| Synthetic claim fails to complete lifecycle | Immediate rollback |
| More than 2 of the first 10 organic claims fail | Immediate rollback |
| 5xx error rate exceeds 5% for 5 consecutive minutes | Immediate rollback |
| Dead-letter queue count exceeds 10 within first hour | Evaluate; rollback if not resolvable in 15 min |
| iTrans `/ledger/verify` reports integrity failure | Immediate rollback |
| MedLink `/api/health` returns unhealthy for > 2 minutes | Immediate rollback |

**Decision authority:** [ENGINEERING LEAD NAME] or designated on-call lead.

### 3.2 Rollback MedLink

1. **Disable auto-submit immediately:**
   - Set `ITRANS_AUTO_SUBMIT_ENABLED=false`
   - Restart MedLink to apply
2. **Redeploy previous MedLink version:**
   - Deploy tag: `[PREVIOUS MEDLINK RELEASE TAG]`
   - Verify `/api/health` returns `200 OK`
3. **Verify auto-submit queue:**
   - Claims queued during the failed window are durably persisted
   - They will be retried after the next successful go-live

### 3.3 Rollback iTrans

1. **Stop relay worker** to prevent further event processing
2. **Restore ledger from backup:**
   ```bash
   ./restoreAndVerifyLedgerSnapshot.sh --env production --snapshot "pre-cutover-[TIMESTAMP]"
   ```
3. **Verify restored ledger integrity:** `GET /ledger/verify` -- confirm `200 OK`
4. **Redeploy previous iTrans version:** `[PREVIOUS ITRANS RELEASE TAG]`
5. **Restart relay worker** with previous version if needed

### 3.4 On-Chain Data

On-chain anchor data is **immutable** and cannot be rolled back. Any anchor transactions confirmed on-chain during the failed deployment remain permanent.

- Apply the **correction policy** as documented in [itrans-production-runbook.md](itrans-production-runbook.md), Section 4
- Correction events will be appended to the ledger to supersede any invalid anchors
- Do **not** attempt to "undo" blockchain transactions

### 3.5 Rollback Communication Template

> **Subject:** [ACTION REQUIRED] iTrans + MedLink Integration -- Rollback Initiated
>
> Team,
>
> We have initiated a rollback of the iTrans + MedLink claims integration deployment at **[TIME]** on **[DATE]**.
>
> **Reason:** [BRIEF DESCRIPTION OF FAILURE]
>
> **Impact:** Claims submitted between [START TIME] and [END TIME] may require reprocessing. The auto-submit queue has been disabled. No claim data has been lost.
>
> **Next steps:**
> - Root cause analysis will begin immediately
> - A revised go-live timeline will be communicated within [TIMEFRAME]
> - Affected claims will be reconciled per the correction policy
>
> **Point of contact:** [NAME] ([PHONE] / [EMAIL])

---

## 4. Hypercare Plan (72 Hours)

### 4.1 Phase Breakdown

| Phase | Window | Staffing | Activities |
|-------|--------|----------|------------|
| **Active Watch** | Hour 0 -- 4 | Full cutover team on standby | Continuous dashboard monitoring, immediate response to any anomaly |
| **Elevated Watch** | Hour 4 -- 24 | Reduced team, on-call rotation active | Monitor dashboards every 15 minutes, respond to alerts within 5 minutes |
| **Steady State** | Hour 24 -- 72 | Normal on-call rotation | Daily status check at 09:00 and 17:00, respond to alerts per SLA |

### 4.2 Metrics to Watch

| Metric | Source | Normal Range | Warning Threshold | Critical Threshold |
|--------|--------|-------------|-------------------|-------------------|
| Queue failed count | MedLink auto-submit queue | 0 | >= 3 in 15 min | >= 10 in 15 min |
| Dead-letter count | `GET /relay/workflow/dead-letters` | 0 | >= 1 | >= 5 |
| 5xx error rate | Load balancer / APM | < 0.1% | >= 1% for 5 min | >= 5% for 2 min |
| p95 latency (claim lifecycle) | APM / custom metric | < 2000ms | > 3000ms for 5 min | > 5000ms for 2 min |
| Callback success rate | MedLink callback handler | > 99.5% | < 99% for 15 min | < 95% for 5 min |
| Ledger event throughput | iTrans metrics | Baseline +/- 20% | < 50% of baseline for 10 min | 0 events for 5 min |

### 4.3 Hypercare On-Call Schedule

| Shift | Start | End | Primary | Secondary |
|-------|-------|-----|---------|-----------|
| Shift 1 | Hour 0 | Hour 4 | [NAME] / [PHONE] | [NAME] / [PHONE] |
| Shift 2 | Hour 4 | Hour 12 | [NAME] / [PHONE] | [NAME] / [PHONE] |
| Shift 3 | Hour 12 | Hour 24 | [NAME] / [PHONE] | [NAME] / [PHONE] |
| Shift 4 | Hour 24 | Hour 48 | [NAME] / [PHONE] | [NAME] / [PHONE] |
| Shift 5 | Hour 48 | Hour 72 | [NAME] / [PHONE] | [NAME] / [PHONE] |

### 4.4 Daily Status Check Template (Hour 24 -- 72)

```
Date: [DATE]
Time: [TIME]
Reported by: [NAME]

Claims processed (last 24h): ___
Failed claims: ___
Dead letters: ___
5xx count: ___
p95 latency: ___ ms
Callback success rate: ___%
Open issues: ___
Action items: ___
```

---

## 5. Monitoring Dashboard Checklist

### 5.1 Required Dashboards

- [ ] **System Overview** -- Health of all three components (MedLink, iTrans core, relay worker)
- [ ] **Claim Lifecycle** -- End-to-end claim flow visualization (submitted, anchored, callback)
- [ ] **Queue & Dead Letters** -- Auto-submit queue depth, relay dead-letter count over time
- [ ] **Error Rate & Latency** -- 5xx rate, p95/p99 latency, request throughput
- [ ] **Blockchain Anchoring** -- Anchor submission rate, confirmation latency, failed anchors

### 5.2 Alert Rules

| Alert Name | Condition | Severity | Notification |
|------------|-----------|----------|-------------|
| MedLink unhealthy | `/api/health` non-200 for > 1 min | Critical | PagerDuty + Slack |
| iTrans ledger integrity failure | `/ledger/verify` non-200 | Critical | PagerDuty + Slack |
| Relay worker down | `/relay/workflow/status` non-200 for > 2 min | Critical | PagerDuty + Slack |
| Dead letters detected | Dead-letter count > 0 | Warning | Slack |
| Dead letters accumulating | Dead-letter count > 5 in 15 min | Critical | PagerDuty + Slack |
| High 5xx rate | 5xx rate > 1% for 5 min | Warning | Slack |
| Critical 5xx rate | 5xx rate > 5% for 2 min | Critical | PagerDuty + Slack |
| High latency | p95 > 3000ms for 5 min | Warning | Slack |
| Queue backlog | Auto-submit queue depth > 100 for 10 min | Warning | Slack |

### 5.3 On-Call Contact Table

| Role | Name | Phone | Email | Slack Handle |
|------|------|-------|-------|-------------|
| Engineering Lead | [NAME] | [PHONE] | [EMAIL] | @[HANDLE] |
| On-Call Primary | [NAME] | [PHONE] | [EMAIL] | @[HANDLE] |
| On-Call Secondary | [NAME] | [PHONE] | [EMAIL] | @[HANDLE] |
| Product Owner | [NAME] | [PHONE] | [EMAIL] | @[HANDLE] |
| DevOps / Infra | [NAME] | [PHONE] | [EMAIL] | @[HANDLE] |
| Database Admin | [NAME] | [PHONE] | [EMAIL] | @[HANDLE] |

---

## 6. Incident Escalation Matrix

### 6.1 Severity Levels

| Severity | Definition | Examples |
|----------|-----------|----------|
| **S1 -- Critical** | Complete service outage or data integrity failure | iTrans ledger corruption, MedLink down, blockchain anchor producing invalid proofs |
| **S2 -- Major** | Significant degradation, claims processing impaired | High 5xx rate, dead letters accumulating, auto-submit queue stalled |
| **S3 -- Minor** | Limited impact, subset of claims affected | Intermittent latency spikes, single claim stuck, dashboard not loading |
| **S4 -- Low** | Cosmetic or informational, no claim processing impact | Log formatting issues, non-critical monitoring gap |

### 6.2 Response Times

| Severity | Acknowledge | Begin Investigation | Status Update Cadence | Resolution Target |
|----------|-------------|--------------------|-----------------------|-------------------|
| **S1** | 5 minutes | 10 minutes | Every 15 minutes | 1 hour |
| **S2** | 15 minutes | 30 minutes | Every 30 minutes | 4 hours |
| **S3** | 1 hour | 2 hours | Every 2 hours | 24 hours |
| **S4** | 4 hours | Next business day | Daily | 1 week |

### 6.3 Escalation Path

```
S4:  On-Call Primary
      |
S3:  On-Call Primary --> On-Call Secondary (if unresolved in 2h)
      |
S2:  On-Call Primary --> On-Call Secondary --> Engineering Lead (if unresolved in 1h)
      |
S1:  On-Call Primary --> Engineering Lead (immediately) --> VP Engineering (if unresolved in 30 min)
                         + Product Owner notified
                         + Stakeholder communication initiated
```

---

## 7. Post-Launch Review (T+72h)

Schedule the post-launch review meeting for **[DATE]** at **[TIME]**.

### 7.1 Metrics Summary

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Total claims processed | | | |
| Successful claims (%) | > 99.5% | | |
| Failed claims | 0 | | |
| Dead letters generated | 0 | | |
| 5xx errors (total) | 0 | | |
| p95 claim lifecycle latency | < 2000ms | | |
| Callback success rate | > 99.5% | | |
| Rollbacks initiated | 0 | | |
| Incidents (S1/S2) | 0 | | |

### 7.2 Issues Encountered

| # | Description | Severity | Time Detected | Time Resolved | Root Cause | Preventive Action |
|---|------------|----------|---------------|---------------|------------|-------------------|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |

### 7.3 Lessons Learned

| # | Category | Observation | Recommendation |
|---|----------|-------------|----------------|
| 1 | What went well | | |
| 2 | What went well | | |
| 3 | What could improve | | |
| 4 | What could improve | | |

### 7.4 Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Engineering Lead | [NAME] | | [DATE] |
| Product Owner | [NAME] | | [DATE] |
| On-Call Lead | [NAME] | | [DATE] |

---

*End of document. Update the version number for any material changes.*
