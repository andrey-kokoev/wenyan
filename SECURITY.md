# Security Policy

## Supported Versions

- `1.0.x`: security and reliability fixes only.
- `0.x`: best-effort, no guaranteed SLA.

## Reporting a Vulnerability

1. Email maintainers with reproduction steps, impact, and affected versions.
2. Do not open public issues for unpatched critical vulnerabilities.
3. We acknowledge within 3 business days and provide a remediation timeline.

## Coordinated Disclosure

- Default disclosure window: 90 days.
- Critical infrastructure-impact issues may be disclosed sooner after patch publication.

## Security Build Gates

- `pnpm security:audit`
- `pnpm security:fuzz`
- `pnpm sbom:generate`

External audit and long burn-in validation are tracked separately from in-repo gates.
