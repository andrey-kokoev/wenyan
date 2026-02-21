# Changelog

All notable changes to this project are documented in this file.

## [1.0.1] - 2026-02-21

### Security
- Gateway no longer accepts spoofable `x-wenyan-actor-*` identity headers in normal runtime paths; header actor mode is limited to explicit test/debug opt-in.
- Read access remains fail-closed when `access_control` law is missing, invalid, or ambiguous, with denial receipts persisted through Seal 0 audit logging.
- Runtime no longer relies on permissive defaults for seal context in server/gateway composition; startup now derives cryptographic context from bootstrap/env and rejects placeholder genesis keys.

### Changed
- `POST /api/wenyan/messages` remains enqueue-first and returns `202 Accepted`; request paths no longer perform synchronous pipeline completion.
- Docket worker now converts processing exceptions into explicit rejected transitions (`invalid-seal-chain`, `insufficient-imperial-authority`, or error reason) instead of leaving messages stranded mid-pipeline.
- Streaming contract is explicit:
  - `GET /api/wenyan/stream` uses SSE.
  - `GET /api/wenyan/stream/replay` returns JSON replay.
- Bridge outbound capture now reads replay JSON (`/stream/replay`) and uses authenticated reads when fetching archived messages.
- Audit export payloads no longer present `bundle_digest`; exported bundles now declare `verification_scope: checkpoint-digest-only` and `cryptographic_completeness: partial`.

### Disabled
- `distributed.mode = "consort"` is hard-disabled at server startup in v1.0.1 (`Feature Disabled` startup error).
- `consensus.kind = "pbft"` is hard-disabled at server startup in v1.0.1 (`Feature Disabled` startup error).
- Mesh join/sync/status/root routes return `503 mesh-not-configured` unless explicitly wired by future releases.

### Notes
- `v1.0.0` is withdrawn. Use `>= v1.0.1`.
- Hotfix scope and follow-on work tracking are documented in `REMEDIATION_PLAN.md`.

## [1.0.0] - 2026-02-20

### Added
- Production-hardening security/process artifacts: `SECURITY.md`, `audit/`, fuzz harness scaffolds, SBOM tooling, and reproducible build documentation.
- Formal specification set under `spec/` with protocol and paper drafts for v1.0.
- Benchmark package `@andrey-kokoev/wenyan-benchmark` with deterministic toy-profile regression checks and stress-profile reporting.
- Infrastructure delivery under `infra/`: Terraform module/example, Helm chart, Go operator stub, and monitoring assets.
- Deployment runbooks under `docs/deploy/` (`quickstart`, `production`, `enterprise`) for local, 3-node, and enterprise setup paths.
- Changesets-based release/versioning setup and release-checklist updates for v1.0.

### Changed
- Seal internals split into dedicated crypto/chain modules while preserving public exports.
- Gateway and bridge boundary hardening (payload/header limits and ingress sanitization) without endpoint contract changes.
- Server runtime includes optional Prometheus-compatible `/metrics` endpoint with Wenyan counters/histograms.
- Public API stability policy formalized for `@andrey-kokoev/wenyan-core`, `@andrey-kokoev/wenyan-gossip`, and `@andrey-kokoev/wenyan-bridge`.

### Deferred External Gates
- External security firm sign-off, long burn-in, and external registry publication are tracked but not blocking for in-repo v1.0 implementation.

## [0.7.0] - 2026-02-20

### Added
- New `@andrey-kokoev/wenyan-imperial-works` package with role hierarchy enforcement helpers, `EmergencyRouter`, and construction-specific anomaly detectors.
- New `@andrey-kokoev/wenyan-mobile-foreman` package (PWA-first primitives) with offline review queueing and deterministic sync helpers.
- New bridge adapter contracts for imperial works domains: `erp`, `payroll`, and `regulatory` protocols in `@andrey-kokoev/wenyan-bridge`.
- New archive v8 runtime tables in sqlite/cloudflare adapters: `bridge_dead_letter` and `site_runtime_state`.
- New gateway emergency endpoint: `POST /api/wenyan/emergency/safety-incident`.
- New imperial-works examples suite (`examples/imperial-works`) and executable v0.7.0 ritual e2e coverage (`packages/tests/e2e/examples/rituals-0.7.0.e2e.test.ts`).

### Changed
- Gateway now applies hierarchy boundary checks and quarantine-aware admission for non-emergency traffic.
- Pipeline integrates imperial-works role helpers to reject hierarchical violations (`hierarchy_violation`).
- Bridge outbound failure path now writes dead-letter entries for retry orchestration.

### Notes
- v0.7.0 integrations are simulator-backed (no mandatory live SAP/banking sandboxes).
- Mobile delivery target is PWA-first; React Native remains out of scope for 0.7.0.

## [0.6.0] - 2026-02-20

### Added
- New `@andrey-kokoev/wenyan-censorate` package with `WenyanTracer`, `AuditService`, `AnomalyDetector`, and `CheckpointService`.
- Censorate schemas/types in `@andrey-kokoev/wenyan-core`:
  `Seal0ReceiptSchema`, `AuditQuerySchema`, `AnomalyRuleSchema`, `AnomalyAlertSchema`, and `CensorateRuntimeConfigSchema`.
- New edict law types: `access_control` and `detection_rule`.
- Archive migration v7 (SQLite + Cloudflare) with new tables:
  `seal_0_log`, `censorate_alerts`, and `audit_checkpoints`.
- Archive APIs for audit operations:
  `appendSeal0Receipt`, `querySeal0ByDocument`, `querySeal0ByGenre`,
  `appendCensorateAlert`, `queryCensorateAlerts`,
  `appendAuditCheckpoint`, `exportAuditBundle`.
- Gateway audit endpoints:
  `GET /api/wenyan/audit/who-read`,
  `GET /api/wenyan/audit/trace/:id`,
  `GET /api/wenyan/audit/anomaly`,
  `GET /api/wenyan/audit/export`,
  `POST /api/wenyan/audit/checkpoint`.
- CLI audit commands:
  `wenyan audit who-read`, `wenyan audit trace`, `wenyan audit anomaly`,
  `wenyan audit export`, `wenyan audit verify`, and `wenyan token --local`.
- New e2e suite: `packages/tests/e2e/rituals-0.6.0.e2e.test.ts`.

### Changed
- Gateway read flow now emits Seal 0 receipts for both successful reads and denied attempts.
- Merkle root computation (`scope=all`) now includes audit/system leaves from read logs, alerts, and checkpoints.
- Channel and gossip envelopes now support trace context fields (`traceparent`, `tracestate`).

### Security
- Optional read authorization via `access_control` law with immutable denial audit logging.
- Deterministic anomaly detection and quarantine signaling for velocity/temporal/geographic/coalition patterns.

### Deferred
- `@andrey-kokoev/wenyan-censorate-ui` remains out of scope for 0.6.0.
- Prometheus dashboard productization remains out of scope for 0.6.0.

## [0.5.0] - 2026-02-20

### Added
- **Bridge Runtime Package**: Added `@andrey-kokoev/wenyan-bridge` as a standalone Node bridge runtime (`wenyan-bridge`) with `IntoWenyan`/`FromWenyan` adapter contracts and sync orchestration primitives.
- **Adapter Delivery (Staged)**: Added production NATS adapter plus staged Kafka/MQTT adapters with contract-complete lifecycle and deterministic test harness hooks.
- **Bridge Archive Persistence (v6)**: Added `foreign_sync_state`, `foreign_rejected`, and `bridge_outbound_queue` tables and repository APIs in both SQLite and Cloudflare adapters.
- **Bridge CLI Commands**: Added `wenyan bridge run`, `wenyan bridge status`, `wenyan bridge sync`, and `wenyan bridge dry-run`.
- **v0.5 Ritual Tests**: Added bridge e2e tests and ritual harness files for v0.5.0 scenarios.

### Changed
- **Bootstrap Config**: Extended `wenyan.toml` schema with `[bridge]`, `[bridge.sync]`, `[bridge.circuit_breaker]`, and `[[bridge.adapters]]`.
- **Server Hook**: Added optional embedded bridge hook in server runtime, disabled by default; single-node API flow remains unchanged.
- **Bridge Conflict Policy**: Added deterministic cross-system conflict resolution primitives (`lww`, `merge`, `schism`) with Imperial Seal priority for verified Wenyan state.

### Security
- **Fail-Closed Bridge Startup**: Adapter startup now rejects undefined `target_genre` (no active `ti_definition`).
- **Forgetting Boundary**: Bridge sanitization keeps only mapped Wenyan fields and drops protocol-native metadata by default.

### Documentation
- Updated docs/config examples to reflect staged v0.5.0 delivery (NATS production, Kafka/MQTT staged).

## [0.4.0] - 2026-02-20

### Added
- **Consort Scaffolding**: Added `@andrey-kokoev/wenyan-gossip`, `@andrey-kokoev/wenyan-crdt`, and `@andrey-kokoev/wenyan-consensus` packages with SWIM/Plumtree-style membership+broadcast primitives, CRDT merge helpers, and PBFT lifecycle APIs.
- **Distributed Runtime Config**: Added bootstrap config sections for `[distributed]`, `[consensus]`, and `[sync]` with safe defaults (`mode = single`, `consensus = none`).
- **Archive v5 Foundations**: Added content-addressed storage metadata, gossip log table, archive state roots, sync-range API, and Merkle root/proof interfaces in SQLite and Cloudflare adapters.
- **Mesh API/CLI Surface**: Added gateway mesh endpoints (mounted at `/api/wenyan/mesh/*` in server runtime: `/join`, `/sync`, `/status`, `/merkle-root`) and CLI commands (`sync --peer`, `mesh status`, `--join gossip://...` support).
- **Consort E2E Harness**: Added `packages/tests/e2e/consort.test.ts` for single-mode compatibility, mesh endpoint behavior, and PBFT gating behavior.

### Changed
- **Pipeline Gate (Feature-flagged)**: In consort+pbft mode, `ti_definition` documents can remain pending until PBFT threshold is reached.
- **Gateway/Server Wiring**: Distributed mode remains opt-in; single-node strict behavior remains default and backward-compatible.

## [0.3.0] - Unreleased

### Added
- **Constitutional Stratification**: Distinguished `ti_definition` (constitutional) from `edict` (legislative) with elevated seal thresholds—`ti_definition` defaults to 3 imperial signatures, while standard `edict` defaults to 1.
- **Pre-validation at Tongzheng Si**: Gateway now queries archive for active `ti_definition` before accepting documents; rejects undefined genres with 503 "Schema Undefined" rather than accepting into pipeline.
- **Cross-Reference Integrity**: Shenfu stage validates that `edict.target_genre` references existing `ti_definition` document; rejects dangling references with 422 "Invalid Constitutional Reference".
- **Package Separation**: Split monorepo into `@andrey-kokoev/wenyan-core` (empty Wenyan—categorical structure without genesis) and `@andrey-kokoev/wenyan-genesis` (bootstrap schemas and `--init` command), enforcing architectural boundary between empty structure and seed content.
- **Merkle Verification for Mesh Join**: CLI join flow now verifies constitutional Merkle root parity before writing the local join marker.
- **Deterministic Replay Engine**: Formalized `replay: Log → State` in the archive layer as a pure fold over transitions.
- **Strict Mode Enforcement**: Removed legacy compat fallback paths; system now fails-closed on missing law or undefined genre with no silent downgrade to in-memory or default behaviors.

### Changed
- **Genesis Bootstrap**: `--init` now creates truly empty Dang'an (no auto-seeded documents); requires explicit `wenyan genesis apply` to archive bootstrap `ti_definition` and `edict`, making genesis an explicit act rather than side effect.
- **Protocol Transition Semantics**: In-flight documents complete under previous quorum rules; new submissions use updated `protocol` edict parameters—achieved via pipeline snapshotting law version at entry rather than dynamic lookup.
- **Role Authorization**: Actor capabilities now pure functions of archived `appointment` edicts read at seal-time; removed runtime role caching that could drift from Dang'an state.
- **Archive Schema**: Added `superseded_by` foreign key constraints and `constitutional` boolean flag to the `messages` table for constitutional and temporal lookups.

### Fixed
- **Category Error**: Documents no longer accepted before their genre's `ti_definition` is archived (resolves v0.2.0 acceptance-then-rejection behavior).
- **Initiality Demonstration**: NATS bridge adapter drops non-Wenyan metadata before validation, preserving the forgetful morphism boundary.
- **State Machine Purity**: Law checks now fail closed when runtime law is missing instead of silently falling back.

### Removed
- **In-Memory Archive Fallback**: System no longer silently falls back to `InMemoryArchiveRepository` on SQLite connection failure; requires explicit archive configuration or exits with error.
- **Static Configuration Enums**: Removed remaining static role matrices and routing tables from codebase; all authority now flows from archived edicts only.

## [0.2.0] - 2026-02-20

### Added
- Law-in-Dang'an runtime model with archived `edict` documents for runtime law and archived `ti_definition` documents for schema evolution.
- Bootstrap config schema and parser (`archive/genesis/gateway/law_cache`) with strict typing in `@andrey-kokoev/wenyan-core`.
- Law resolver service with cache, preload, ambiguity handling, and fallback events.
- Archive law query APIs (`getCurrentLaw`, `getLawSet`) and deterministic law resolution semantics.
- SQLite and Cloudflare archive indexing/backfill for `edict_index` and `ti_definition_index`.
- Gateway and pipeline tests covering strict/compat law behavior and immediate law update effects.

### Changed
- Gateway admission/protocol checks now resolve law from archive instead of static config.
- Pipeline stage enforcement now consumes appointment/classification/routing/protocol law.
- Actor role authorization helpers are law-driven in the primary path, with legacy fallback behavior retained for compat mode.
- `wenyan.toml` and `wenyan.toml.example` are bootstrap-only.
- Server runtime no longer silently downgrades to in-memory archive on adapter init failure.
- Release version bumped from `0.1.0` to `0.2.0` across workspace packages.

### Fixed
- Immediate law application after archived edict updates via resolver cache invalidation.
- Removed manual transition hash threading in pipeline flow; archive adapters own chain linkage.
- Reduced duplicated strict/compat fallback logic by centralizing law content load handling.

## [0.1.0] - 2026-02-19

### Added
- Initial Wenyan monorepo structure with core runtime packages and API-only server flow.
- Seal chain, archive, gateway, pipeline, channel, actor, CLI, and e2e test scaffolding.

[1.0.1]: https://github.com/andrey-kokoev/wenyan/releases/tag/v1.0.1
[1.0.0]: https://github.com/andrey-kokoev/wenyan/releases/tag/v1.0.0
[0.2.0]: https://github.com/andrey-kokoev/wenyan/releases/tag/v0.2.0
[0.3.0]: https://github.com/andrey-kokoev/wenyan/releases/tag/v0.3.0
[0.4.0]: https://github.com/andrey-kokoev/wenyan/releases/tag/v0.4.0

[0.5.0]: https://github.com/andrey-kokoev/wenyan/releases/tag/v0.5.0

[0.6.0]: https://github.com/andrey-kokoev/wenyan/releases/tag/v0.6.0
