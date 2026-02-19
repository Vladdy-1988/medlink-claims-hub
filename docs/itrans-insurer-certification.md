# iTrans + MedLink Insurer Integration Certification Packet

| Field         | Value                                  |
|---------------|----------------------------------------|
| **Version**   | 1.0                                    |
| **Date**      | 2026-02-19                             |
| **Status**    | Draft - Pending Insurer Review         |
| **Authors**   | MedLink Integration Engineering        |
| **Audience**  | Insurer technical integration team     |

---

## 1. Integration Overview

MedLink Claims Hub is the provider-facing system that creates and tracks healthcare claims. Claims submitted through MedLink are forwarded to **modern-itrans-core**, an event-sourced claim lifecycle ledger with on-chain blockchain anchoring.

The end-to-end data flow is:

```
Provider --> MedLink (create claim)
               |
               v
         iTrans Core (submit on-chain workflow transaction)
               |
               v
         EVM Smart Contract (RequestSubmitted event emitted)
               |
               v
         Workflow Event Relay (polls chain, detects event)
               |
               v
         Signed Webhook POST --> Insurer Endpoint (you)
               |
               v
         Insurer processes, acknowledges/adjudicates via iTrans API
               |
               v
         On-chain adjudication event --> Relay --> MedLink callback
```

**What the insurer's system needs to support:**

- An HTTPS endpoint capable of receiving signed JSON webhook payloads.
- HMAC-SHA256 signature verification logic to authenticate incoming webhooks.
- Idempotent event processing (the relay guarantees at-least-once delivery).
- Correct HTTP response codes so the relay can distinguish success from permanent failure from transient failure.

**What goes on-chain:**

Only SHA-256 hashes of claim payloads and decision data are written to the blockchain. No Protected Health Information (PHI) is ever stored or transmitted on-chain.

---

## 2. Webhook Contract Specification

### 2.1 Endpoint Requirements

| Requirement      | Detail                                                      |
|------------------|-------------------------------------------------------------|
| Protocol         | HTTPS (TLS 1.2 or higher required)                         |
| Method           | POST                                                        |
| Content-Type     | `application/json`                                          |
| Availability     | Endpoint must be reachable from iTrans relay infrastructure |
| Response timeout | The relay enforces an **8-second** timeout per delivery attempt (configurable via `RELAY_WEBHOOK_TIMEOUT_MS`) |

### 2.2 Request Headers

Every webhook delivery includes the following headers:

| Header                        | Description                                                                 |
|-------------------------------|-----------------------------------------------------------------------------|
| `content-type`                | Always `application/json`                                                   |
| `idempotency-key`             | Unique event identifier, identical to `eventId` in the payload body         |
| `x-itrans-relay-event-id`     | Unique event identifier (format: `{chainId}:{txHash}:{logIndex}:{destinationType}`) |
| `x-itrans-relay-event-type`   | One of: `REQUEST_SUBMITTED`, `REQUEST_ACKNOWLEDGED`, `REQUEST_ADJUDICATED`  |
| `x-itrans-relay-timestamp`    | Unix epoch milliseconds when the webhook was signed and dispatched          |
| `x-itrans-relay-signature`    | HMAC-SHA256 signature in the format `hmac-sha256={hex_digest}`              |

### 2.3 Payload Format

```json
{
  "eventId": "31337:0xabc123...def:0:INSURER",
  "eventType": "REQUEST_SUBMITTED",
  "chainId": 31337,
  "contractAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "blockNumber": 42,
  "blockHash": "0x...",
  "txHash": "0xabc123...def",
  "logIndex": 0,
  "requestIdHash": "0x...",
  "occurredAt": 1740000000,
  "data": {
    "payloadHash": "0x...",
    "submitter": "0x...",
    "insurer": "0x...",
    "requestType": "CLAIM"
  }
}
```

**Payload fields by event type:**

| Field            | `REQUEST_SUBMITTED` | `REQUEST_ACKNOWLEDGED` | `REQUEST_ADJUDICATED` |
|------------------|:-------------------:|:----------------------:|:---------------------:|
| `eventId`        | Yes                 | Yes                    | Yes                   |
| `eventType`      | Yes                 | Yes                    | Yes                   |
| `chainId`        | Yes                 | Yes                    | Yes                   |
| `contractAddress`| Yes                 | Yes                    | Yes                   |
| `blockNumber`    | Yes                 | Yes                    | Yes                   |
| `blockHash`      | Yes                 | Yes                    | Yes                   |
| `txHash`         | Yes                 | Yes                    | Yes                   |
| `logIndex`       | Yes                 | Yes                    | Yes                   |
| `requestIdHash`  | Yes                 | Yes                    | Yes                   |
| `occurredAt`     | Yes                 | Yes                    | Yes                   |
| `data.payloadHash` | Yes               | --                     | --                    |
| `data.submitter` | Yes                 | --                     | --                    |
| `data.insurer`   | Yes                 | Yes                    | Yes                   |
| `data.requestType` | Yes (`CLAIM` / `PREAUTH`) | --             | --                    |
| `data.decisionHash` | --              | --                     | Yes                   |
| `data.decision`  | --                  | --                     | Yes (`APPROVED` / `DENIED` / `NEEDS_INFO`) |

### 2.4 HMAC-SHA256 Signature Verification

The relay signs every webhook using a shared signing secret. The insurer **must** verify this signature before processing the payload.

**Signature construction:**

```
canonical_payload = "{timestamp_ms}.{json_body}"
signature = HMAC-SHA256(signing_secret, canonical_payload)
header_value = "hmac-sha256={hex_encoded_signature}"
```

Where:
- `{timestamp_ms}` is the value from the `x-itrans-relay-timestamp` header.
- `{json_body}` is the raw HTTP request body (do not re-serialize; use the raw bytes).
- The signing secret is shared during onboarding (minimum 32 characters).

**Reference implementation (Node.js):**

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(signingSecret, timestampMs, rawBody, signatureHeader) {
  const canonicalPayload = `${timestampMs}.${rawBody}`;
  const expected = crypto.createHmac('sha256', signingSecret)
    .update(canonicalPayload)
    .digest('hex');

  const provided = signatureHeader.replace(/^hmac-sha256=/, '');

  // Use timing-safe comparison to prevent timing attacks
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}
```

**Important:** Always use constant-time (timing-safe) comparison when validating signatures to prevent timing side-channel attacks.

### 2.5 Expected HTTP Response Codes

| Status Code | Interpretation                | Relay Behavior                          |
|-------------|-------------------------------|-----------------------------------------|
| 200         | Success                       | Delivery marked complete                |
| 201         | Success                       | Delivery marked complete                |
| 202         | Accepted (async processing)   | Delivery marked complete                |
| 204         | Success (no content)          | Delivery marked complete                |
| 400         | Bad request (permanent)       | **No retry** -- moved to dead letter    |
| 401         | Unauthorized (permanent)      | **No retry** -- moved to dead letter    |
| 403         | Forbidden (permanent)         | **No retry** -- moved to dead letter    |
| 404         | Not found (permanent)         | **No retry** -- moved to dead letter    |
| 408         | Request timeout (transient)   | **Retry** with exponential backoff      |
| 429         | Rate limited (transient)      | **Retry** with exponential backoff      |
| 500         | Server error (transient)      | **Retry** with exponential backoff      |
| 502         | Bad gateway (transient)       | **Retry** with exponential backoff      |
| 503         | Service unavailable (transient) | **Retry** with exponential backoff    |
| 504         | Gateway timeout (transient)   | **Retry** with exponential backoff      |

General rule: status codes in the 2xx range are treated as success. Codes 408, 429, and 5xx are retryable. All other 4xx codes are permanent failures.

### 2.6 Retry Policy

| Parameter              | Default Value | Environment Variable             |
|------------------------|---------------|----------------------------------|
| Max retry attempts     | 8             | `RELAY_MAX_RETRIES`              |
| Initial backoff        | 1,000 ms      | `RELAY_INITIAL_BACKOFF_MS`       |
| Maximum backoff        | 60,000 ms     | `RELAY_MAX_BACKOFF_MS`           |
| Backoff strategy       | Exponential (2^n) | --                            |
| Webhook timeout        | 8,000 ms      | `RELAY_WEBHOOK_TIMEOUT_MS`       |

After all retry attempts are exhausted, the event is moved to the **dead-letter queue**. Dead-lettered events are retained for 30 days and can be inspected via the relay status API.

### 2.7 Idempotency Requirements

The relay provides **at-least-once delivery**. In edge cases (network partitions, timeout races, relay restarts), the same event may be delivered more than once.

**The insurer must implement idempotent processing.** Use the `eventId` field (also sent as the `idempotency-key` header) to deduplicate:

- `eventId` format: `{chainId}:{transactionHash}:{logIndex}:{destinationType}`
- This value is globally unique and stable across retries.
- Store processed `eventId` values and skip reprocessing when a duplicate is received.
- Return `200 OK` for duplicate events (do not return an error).

---

## 3. Security Controls Summary

### 3.1 API Key Authentication

All iTrans API endpoints require API key authentication via the `x-api-key` header or `Authorization: Bearer {key}` header.

- Keys are validated using **timing-safe comparison** (`crypto.timingSafeEqual`).
- In production, API keys must be at least 16 characters and must not be placeholder values.
- Separate API keys are enforced for the claims subsystem (`CLAIMS_API_KEY`) and the workflow subsystem (`WORKFLOW_API_KEY`). These keys must be distinct in production.

### 3.2 HMAC Signature Verification

- All webhook payloads are signed with HMAC-SHA256 using a shared signing secret.
- The signing secret must be at least 32 characters.
- The canonical signing input includes the timestamp to prevent replay attacks.
- Signature verification must use constant-time comparison.

### 3.3 On-Chain Data Privacy

- **No PHI is stored on-chain.** Only SHA-256 hashes of claim payloads and decision data are written to the smart contract.
- On-chain fields: `requestIdHash`, `payloadHash`, `decisionHash` (all SHA-256 hashes).
- The raw claim data (patient identifiers, service codes, amounts) remains off-chain in the iTrans ledger and MedLink systems.

### 3.4 Transport Security

- All webhook deliveries are made over HTTPS.
- The insurer's endpoint must support TLS 1.2 or higher.
- Self-signed certificates are not accepted in production.

### 3.5 Rate Limiting

iTrans enforces rate limiting on all authenticated API endpoints:

| Parameter            | Default Value | Environment Variable                |
|----------------------|---------------|-------------------------------------|
| Window duration      | 60,000 ms     | `API_RATE_LIMIT_WINDOW_MS`          |
| Max requests/window  | 120           | `API_RATE_LIMIT_MAX_REQUESTS`       |

### 3.6 Webhook Signing Secret Rotation

To rotate the webhook signing secret without downtime:

1. Configure the new signing secret on the iTrans relay side.
2. During the transition window, the insurer should accept webhooks signed with **either** the old or the new secret.
3. Once all in-flight deliveries using the old secret have completed (allow at least 24 hours), the insurer can remove the old secret.
4. Coordinate rotation timing with the MedLink integration team. A minimum 48-hour notice is recommended.

---

## 4. PHI Handling Guarantees

### 4.1 Data Transmitted via Webhook

| Category                 | Fields                                                    | Contains PHI? |
|--------------------------|-----------------------------------------------------------|:-------------:|
| Event metadata           | `eventId`, `eventType`, `chainId`, `contractAddress`      | No            |
| Blockchain references    | `blockNumber`, `blockHash`, `txHash`, `logIndex`          | No            |
| Hashed identifiers       | `requestIdHash`, `data.payloadHash`, `data.decisionHash`  | No            |
| Ethereum addresses       | `data.submitter`, `data.insurer`                          | No            |
| Workflow metadata        | `data.requestType`, `data.decision`, `occurredAt`         | No            |

### 4.2 Data NOT Transmitted

The following data is **never** included in webhook payloads or on-chain transactions:

- Patient identifiers (name, date of birth, SSN, member ID)
- Provider identifiers (NPI, name, address)
- Diagnosis codes (ICD-10)
- Procedure codes (CPT, HCPCS)
- Service descriptions and quantities
- Billed or approved amounts
- Clinical notes or attachments

### 4.3 Data Retention and Deletion

| System        | Retention Policy                                                                 |
|---------------|----------------------------------------------------------------------------------|
| iTrans ledger | Append-only event log; retention governed by MedLink data retention policy       |
| On-chain      | Permanent and immutable (hashes only)                                            |
| Relay state   | Delivered events pruned after 7 days; dead letters pruned after 30 days          |
| **Insurer**   | **The insurer is solely responsible for the retention and deletion of any data received via webhook. The insurer must comply with all applicable regulations (HIPAA, state law).** |

---

## 5. Conformance Checklist

### 5.1 Technical Readiness

- [ ] HTTPS endpoint provisioned and reachable from iTrans relay infrastructure
- [ ] TLS 1.2 or higher enabled on the webhook endpoint
- [ ] HMAC-SHA256 signature verification implemented and tested
- [ ] Timing-safe comparison used for signature validation
- [ ] Idempotent event processing implemented (deduplication by `eventId`)
- [ ] Correct HTTP status codes returned (2xx for success, 4xx for permanent failure, 5xx for transient failure)
- [ ] Duplicate event delivery returns 200 OK (not an error)
- [ ] Webhook signing secret securely stored (not in source code, not in logs)

### 5.2 Staging Validation

- [ ] Test webhook received and signature verified in staging environment
- [ ] `REQUEST_SUBMITTED` event processed successfully
- [ ] `REQUEST_ADJUDICATED` event processed successfully
- [ ] Duplicate event delivery handled correctly (idempotency verified)
- [ ] Invalid signature rejected (negative test)
- [ ] Response time consistently under 8 seconds

### 5.3 Operational Readiness

- [ ] Load test completed at expected throughput
- [ ] Monitoring and alerting configured for webhook endpoint
- [ ] On-call runbook includes iTrans webhook failure scenarios
- [ ] Signing secret rotation procedure documented and tested
- [ ] Contact information provided to MedLink integration team

---

## 6. Staging Certification

### 6.1 Staging Environment

| Parameter                  | Value                                         |
|----------------------------|-----------------------------------------------|
| Staging relay base URL     | `[TO BE PROVIDED]`                            |
| Staging chain ID           | `[TO BE PROVIDED]`                            |
| Staging contract address   | `[TO BE PROVIDED]`                            |
| Staging signing secret     | *(provided securely during onboarding)*       |
| Staging API key            | *(provided securely during onboarding)*       |

### 6.2 Required Test Scenarios

| # | Scenario                                       | Expected Result                          | Pass/Fail | Date       |
|---|------------------------------------------------|------------------------------------------|-----------|------------|
| 1 | Receive `REQUEST_SUBMITTED` webhook            | 200 OK returned, event logged            |           |            |
| 2 | Verify HMAC signature on received webhook      | Signature matches computed value         |           |            |
| 3 | Receive duplicate `REQUEST_SUBMITTED` event    | 200 OK returned, no duplicate processing |           |            |
| 4 | Receive webhook with invalid signature         | Rejected (logged, not processed)         |           |            |
| 5 | Acknowledge request via iTrans API             | `REQUEST_ACKNOWLEDGED` event emitted     |           |            |
| 6 | Adjudicate request via iTrans API (APPROVED)   | `REQUEST_ADJUDICATED` event emitted      |           |            |
| 7 | Adjudicate request via iTrans API (DENIED)     | `REQUEST_ADJUDICATED` event emitted      |           |            |
| 8 | Simulate endpoint downtime (return 503)        | Relay retries with exponential backoff   |           |            |
| 9 | Sustained load test (target TPS for 10 min)    | No errors, p99 latency under 5 s         |           |            |

### 6.3 Sign-Off

| Role                          | Name               | Email              | Date       | Signature  |
|-------------------------------|--------------------|--------------------|------------|------------|
| Insurer Integration Lead      |                    |                    |            |            |
| Insurer Security Reviewer     |                    |                    |            |            |
| MedLink Integration Engineer  |                    |                    |            |            |
| iTrans Operations Lead        |                    |                    |            |            |

---

## 7. Sample Notification Email

> **Subject:** iTrans + MedLink Webhook Integration -- Certification Request
>
> Dear `[INSURER_CONTACT_NAME]`,
>
> We are writing to initiate the technical certification process for the iTrans + MedLink healthcare claims webhook integration with `[INSURER_ORG_NAME]`.
>
> **What this involves:**
>
> Your team will need to provision an HTTPS endpoint to receive signed webhook notifications for claim lifecycle events (submissions, acknowledgments, adjudications). We will provide a staging environment and shared signing secret for testing.
>
> **Proposed timeline:**
>
> | Milestone                        | Target Date              |
> |----------------------------------|--------------------------|
> | Onboarding call and secret exchange | `[ONBOARDING_DATE]`   |
> | Staging endpoint provisioned     | `[STAGING_READY_DATE]`   |
> | Staging test scenarios completed | `[STAGING_COMPLETE_DATE]`|
> | Production certification sign-off | `[PROD_CERT_DATE]`      |
>
> **Attached:** iTrans Insurer Integration Certification Packet (this document), which contains the full webhook contract specification, security requirements, and conformance checklist.
>
> Please review the attached packet and confirm your availability for the onboarding call.
>
> Best regards,
> `[SENDER_NAME]`
> `[SENDER_TITLE]`
> MedLink Claims Hub Integration Team

---

## Appendix A: Glossary

| Term                | Definition                                                                                      |
|---------------------|-------------------------------------------------------------------------------------------------|
| **iTrans Core**     | The event-sourced claim lifecycle ledger with blockchain anchoring                               |
| **MedLink**         | The provider-facing claims hub that creates and tracks claims                                    |
| **Workflow Relay**  | The iTrans component that polls the blockchain for workflow events and delivers webhooks          |
| **Dead Letter**     | A webhook delivery that has exhausted all retry attempts and requires manual intervention         |
| **Anchor**          | The act of writing a SHA-256 hash of claim data to the blockchain for tamper-evident auditability |
| **PHI**             | Protected Health Information as defined by HIPAA                                                 |
| **Signing Secret**  | The shared HMAC-SHA256 key used to sign and verify webhook payloads                              |
| **Event ID**        | A globally unique identifier for each webhook delivery (`{chainId}:{txHash}:{logIndex}:{dest}`) |

---

*End of document. For questions or clarifications, contact the MedLink Integration Engineering team.*
