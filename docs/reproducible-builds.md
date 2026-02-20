# Reproducible Builds

## Toolchain
- Node: pinned by CI image
- pnpm: pinned by `packageManager`

## Procedure
1. Install with lockfile.
2. Run typecheck/test/build in clean environment.
3. Generate SBOM artifact.

Record CI image digest and run metadata with each release tag.
