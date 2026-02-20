# Changelog

All notable changes to this project are documented in this file.

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
