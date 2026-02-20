## [1.0.0] - Unreleased

### Added
- Security process assets (`SECURITY.md`, `audit/`, fuzz harnesses, SBOM tooling).
- Formal protocol/spec drafts under `spec/`.
- Benchmark package `@wenyan/benchmark` with toy and stress profiles.
- Infrastructure scaffolding: Terraform, Helm chart, Go operator stub, monitoring dashboards/rules.
- Changesets configuration and CI/release/security workflows.

### Changed
- Seal implementation split into `crypto.ts`, `chain.ts`, `merkle.ts` with stable public exports.
- Gateway/bridge input hardening with payload/header limits and metadata sanitization.
- Server adds optional Prometheus `/metrics` endpoint.
- API stability policy documented for frozen v1 packages.

### Deferred
- External audit firm sign-off, long burn-in, and external registry publication remain out-of-repo gates.
