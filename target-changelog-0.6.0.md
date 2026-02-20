## [0.6.0] - 2026-02-20

### Added
- New package `@wenyan/censorate` with:
  - `WenyanTracer` (OpenTelemetry API wrapper)
  - `AuditService` (Seal 0 receipt creation and verification)
  - `AnomalyDetector` (deterministic velocity/temporal/geographic/coalition rules)
  - `CheckpointService` (audit checkpoint creation and export verification helpers)
- Core schemas for Censorate runtime and audit payloads:
  - `Seal0ReceiptSchema`, `AuditQuerySchema`, `AnomalyRuleSchema`, `AnomalyAlertSchema`, `CensorateRuntimeConfigSchema`.
- Edict law type vocabulary extended with:
  - `access_control`
  - `detection_rule`
- Archive migration v7 in sqlite/cloudflare adapters:
  - `seal_0_log`
  - `censorate_alerts`
  - `audit_checkpoints`
  - new audit indexes for query and time-window access.
- Archive repository APIs:
  - `appendSeal0Receipt`, `querySeal0ByDocument`, `querySeal0ByGenre`
  - `appendCensorateAlert`, `queryCensorateAlerts`
  - `appendAuditCheckpoint`, `exportAuditBundle`
- Gateway audit endpoints:
  - `GET /api/wenyan/audit/who-read`
  - `GET /api/wenyan/audit/trace/:id`
  - `GET /api/wenyan/audit/anomaly`
  - `GET /api/wenyan/audit/export`
  - `POST /api/wenyan/audit/checkpoint`
- CLI audit commands:
  - `wenyan audit who-read`
  - `wenyan audit trace`
  - `wenyan audit anomaly`
  - `wenyan audit export`
  - `wenyan audit verify`
  - plus `wenyan token --local` for local bearer use.
- E2E suite `packages/tests/e2e/rituals-0.6.0.e2e.test.ts` implementing the nine v0.6.0 ritual scenarios.

### Changed
- Gateway read paths now emit Seal 0 receipts for allowed reads and denied reads.
- Merkle root computation for `scope=all` now incorporates audit/system leaves from:
  - `seal_0_log`
  - `censorate_alerts`
  - `audit_checkpoints`.
- Channel and gossip message envelopes now allow trace context fields (`traceparent`, `tracestate`).

### Security
- Unauthorized reads can be denied by `access_control` law and are still audited.
- High-velocity constitutional activity can trigger anomaly alerts and actor quarantine.
- Temporal and geographic anomalies are detected and logged.

### Deferred (Not in 0.6.0)
- No `@wenyan/censorate-ui` package.
- No Prometheus endpoint/dashboard productization.
- No ML-based anomaly models in this release.
