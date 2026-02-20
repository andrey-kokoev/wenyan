## [0.7.0] - Unreleased

### Added
- `@wenyan/imperial-works` package with hierarchy, emergency routing, and construction anomaly detection helpers.
- `@wenyan/mobile-foreman` package with PWA-first offline queue and sync primitives.
- Bridge adapter modules for `erp`, `payroll`, and `regulatory` protocols (simulator-backed contracts).
- Archive adapter runtime support for `bridge_dead_letter` and `site_runtime_state`.
- Imperial works example scaffold under `examples/imperial-works/`.
- v0.7.0 ritual e2e suite scaffold in `packages/tests/e2e/examples/rituals-0.7.0.e2e.test.ts`.

### Changed
- Gateway now enforces hierarchy violations at boundary and applies quarantine-aware submit handling.
- Pipeline now checks imperial hierarchy permissions during review/authorization paths.
- Bridge failure handling writes dead-letter records for retry control.

### Out of Scope
- React Native mobile runtime.
- Mandatory live external ERP/banking integrations in CI.
