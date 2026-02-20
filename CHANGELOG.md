# Changelog

All notable changes to this project are documented in this file.

## [0.3.0] - Unreleased

### Added
- **Constitutional Stratification**: Distinguished `ti_definition` (constitutional) from `edict` (legislative) with elevated seal thresholds—`ti_definition` defaults to 3 imperial signatures, while standard `edict` defaults to 1.
- **Pre-validation at Tongzheng Si**: Gateway now queries archive for active `ti_definition` before accepting documents; rejects undefined genres with 503 "Schema Undefined" rather than accepting into pipeline.
- **Cross-Reference Integrity**: Shenfu stage validates that `edict.target_genre` references existing `ti_definition` document; rejects dangling references with 422 "Invalid Constitutional Reference".
- **Package Separation**: Split monorepo into `@wenyan/core` (empty Wenyan—categorical structure without genesis) and `@wenyan/genesis` (bootstrap schemas and `--init` command), enforcing architectural boundary between empty structure and seed content.
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
- Bootstrap config schema and parser (`archive/genesis/gateway/law_cache`) with strict typing in `@wenyan/core`.
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

[0.2.0]: https://github.com/andrey-kokoev/wenyan/releases/tag/v0.2.0
[0.3.0]: https://github.com/andrey-kokoev/wenyan/releases/tag/v0.3.0
