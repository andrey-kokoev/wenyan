# Wenyan v1.0.0 Remediation Plan

## Incident Context
`v1.0.0` was released with gaps between documented claims and runtime behavior in distributed/consensus/auth/audit paths. This plan defines immediate containment, transparent correction, and a safe hotfix release (`v1.0.1`).

## Goals
1. Protect users immediately by forcing safe runtime behavior.
2. Correct public release claims and package metadata.
3. Ship `v1.0.1` with fail-closed behavior for incomplete paths.
4. Add release controls so this cannot recur.

## Non-Goals
1. Full distributed feature completion in the hotfix.
2. New product features.
3. Rewriting architecture during incident response.

## Guiding Rules
1. Prefer fail-closed over permissive fallback.
2. Do not claim functionality without passing tests and runtime evidence.
3. Use minimal, auditable changes in hotfix branch.

## Phase 0: Containment (Immediate)
1. Stop promoting `v1.0.0` as stable.
2. If deployed, enforce safe configuration:
   - `distributed.mode = "single"`
   - `consensus.kind = "none"`
   - `bridge.enabled = false`
   - `auth.allow_header_actor = false`
3. Freeze new release tags until hotfix validation completes.

## Phase 1: Public Correction
1. Edit GitHub release notes for `v1.0.0`:
   - Mark release as withdrawn/unsafe for production.
   - Link to this remediation plan.
2. Add repository notice:
   - README warning banner until `v1.0.1` is published.
3. Deprecate `1.0.0` packages with explicit install warning:
   - `npm deprecate <pkg>@1.0.0 "Critical defects in runtime behavior; upgrade to >=1.0.1"`

## Phase 2: Hotfix v1.0.1 (Scope Locked)
Create branch `hotfix/1.0.1` from tag `v1.0.0`. Only include the following:

### A) Auth and Access Hardening
1. Remove production trust of spoofable actor headers.
2. Require verified token identity for protected endpoints.
3. Missing/invalid/ambiguous `access_control` law must deny (`403`) and log audit receipt.

### B) Distributed/Consensus Safety
1. Disable non-functional PBFT network flow by default.
2. Remove dummy CRDT merge calls on hardcoded objects. If `syncWithPeer` detects divergence, halt sync and log a critical error (`divergence-detected-manual-intervention-required`).
3. Disable fake gossip fanout paths or make them explicit no-op with hard errors when enabled without transport.
4. Fix synchronous Docket queue by spawning a background `processDocketLoop` to prevent blocking HTTP responses.

### C) Sync/Audit Correctness
1. Ensure sync either applies fetched transitions correctly or fails explicitly.
2. Ensure audit export is documented as partial unless proofs are fully verifiable. Remove the fake `bundle_digest` (simple SHA256 hash) entirely until real Merkle proofs are implemented.
3. Remove wording implying cryptographic completeness where absent.

### D) Runtime Defaults
1. Runtime startup must reject dev placeholder keys in non-test mode.
2. Unsafe compatibility flags must default to strict mode.
3. If a user configures `consensus.kind = "pbft"` or `distributed.mode = "consort"`, the server must immediately crash on startup with a clear "Feature Disabled" error, rather than silently falling back to single-node mode.

## Phase 3: Test and Validation Gates (Blocking)
Hotfix cannot ship unless all pass:
1. `pnpm -r typecheck`
2. `pnpm -r test`
3. `pnpm -r build`
4. New targeted tests:
   - spoofed header denied
   - invalid token denied
   - missing `access_control` law denied
   - disabled consensus/gossip paths fail safely (server crashes on startup if configured)
   - sync path applies or fails with explicit error

## Phase 4: Release Operations
1. Bump versions to `1.0.1`.
2. Update `CHANGELOG.md` with factual `1.0.1` hotfix section.
3. Tag and publish `v1.0.1`.
4. Verify package availability and installation from registries.
5. Remove README warning banner only after publish verification.

## Phase 5: Post-Incident Prevention
1. Add release checklist gate:
   - every changelog claim must map to test + code reference.
2. Add “no overclaim” CI validation task for release PRs.
3. Add explicit feature maturity labels:
   - `production`, `experimental`, `stub-disabled`.
4. Require incident-style signoff for major tags.

## Owners and Timeline
1. Incident lead: repository maintainer.
2. Containment + public correction: same day.
3. Hotfix implementation + validation: 24-48 hours.
4. Post-incident controls: within 7 days of `v1.0.1`.

## Exit Criteria
1. `v1.0.0` is clearly marked unsafe/deprecated.
2. `v1.0.1` released with strict/fail-closed behavior.
3. All blocking tests pass and claims match implementation.
4. Preventive release controls merged.
