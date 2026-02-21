# Wenyan

Wenyan is monorepo implementing the Wenyan runtime architecture.

## Genesis Docs

If you want to understand the architectural rationale and design principles behind Wenyan, start with the genesis docs:

- [`genesis/wenyan.md`](genesis/wenyan.md) - architectural genesis and model
- [`genesis/criteria-of-completeness.md`](genesis/criteria-of-completeness.md) - completion criteria and invariants
- [`genesis/out-of-scope.md`](genesis/out-of-scope.md) - explicit non-goals and boundaries
- [`sequence-graph.md`](sequence-graph.md) - end-to-end sequencing graph of the Wenyan flow

## Packages

- `packages/server` (`@andrey-kokoev/wenyan-server`) - Cloudflare Hono server
- `packages/shared` (`@andrey-kokoev/wenyan-shared`) - compatibility/shared facade
- `packages/core` (`@andrey-kokoev/wenyan-core`) - schemas, envelope types, state transitions, bootstrap/law schemas
- `packages/actor` (`@andrey-kokoev/wenyan-actor`) - law-driven actor permission helpers
- `packages/seal` (`@andrey-kokoev/wenyan-seal`) - seal chain primitives and verification
- `packages/archive` (`@andrey-kokoev/wenyan-archive`) - append-only archive repository API + law/genre lookup
- `packages/pipeline` (`@andrey-kokoev/wenyan-pipeline`) - Caoni/Shenfu/Pizhun stages + law resolver
- `packages/gateway` (`@andrey-kokoev/wenyan-gateway`) - gateway routes and Tongzheng Si input filter
- `packages/channel` (`@andrey-kokoev/wenyan-channel`) - reliable local broadcast channel
- `packages/gossip` (`@andrey-kokoev/wenyan-gossip`) - SWIM/Plumtree-style consort gossip primitives
- `packages/crdt` (`@andrey-kokoev/wenyan-crdt`) - CRDT reconciliation for legislative conflicts
- `packages/consensus` (`@andrey-kokoev/wenyan-consensus`) - PBFT lifecycle for constitutional consensus
- `packages/bridge` (`@andrey-kokoev/wenyan-bridge`) - foreign protocol bridge runtime (standalone Node)
- `packages/imperial-works` (`@andrey-kokoev/wenyan-imperial-works`) - role hierarchy, emergency routing, and construction anomaly rules
- `packages/mobile-foreman` (`@andrey-kokoev/wenyan-mobile-foreman`) - PWA offline foreman queue and sync primitives
- `packages/benchmark` (`@andrey-kokoev/wenyan-benchmark`) - deterministic toy/stress benchmark harness
- `packages/genesis` (`@andrey-kokoev/wenyan-genesis`) - explicit genesis bootstrap (`createEmptyOffice`, `applyGenesis`)
- `packages/cli` (`@andrey-kokoev/wenyan-cli`) - `wenyan` CLI for `--init`, `draft`, `submit`, `status`, `query`, `stream`, `imperialworks`, `mobile sync`
- `packages/tests` - shared fixtures used by server tests

## Storage adapters

- `sqlite` adapter (local Dang'an)
- `cloudflare` adapter (D1-backed Dang'an)

## Law In Dang'an

- Runtime law/config for admission/appointment/classification/routing/protocol/regulation is resolved from archived `genre: "edict"` documents.
- Genre schema registry is archived as sealed `genre: "ti_definition"` documents.
- Static filesystem config is bootstrap-only (`wenyan.toml`): archive engine/path, genesis identity/key, gateway bind, and optional law cache tuning.
- Runtime is strict fail-closed: missing/ambiguous/invalid law and undefined genres are rejected.

## Runtime endpoints

- `POST /api/wenyan/messages` (enqueue-only, returns `202 Accepted`)
- `GET /api/wenyan/messages/:id`
- `GET /api/wenyan/messages?state=...`
- `GET /api/wenyan/stream` (SSE)
- `GET /api/wenyan/stream/replay?since=...` (JSON polling replay)
- `GET /api/wenyan/mesh/status`
- `POST /api/wenyan/mesh/join`
- `POST /api/wenyan/mesh/sync`
- `GET /api/wenyan/mesh/merkle-root`

Read endpoints enforce JWT actor authentication when `access_control` law requires it. Header spoofing via `x-wenyan-actor-*` is disabled by default.

Bridge runtime (standalone):

- `wenyan bridge run [--config wenyan.toml]`
- `wenyan bridge status [--config wenyan.toml]`
- `wenyan bridge sync --adapter <id> [--config wenyan.toml]`
- `wenyan bridge dry-run --adapter <id> --file payload.json [--config wenyan.toml]`

## Configuration

- `wenyan.toml`
- `wenyan.toml.example`

Minimal shape:

```toml
[archive]
engine = "sqlite"
path = "./wenyan.dang'an"

[genesis]
node_id = "11111111-1111-4111-8111-111111111111"
genesis_key = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="

[gateway.listen]
host = "127.0.0.1"
port = 8787

[auth]
jwt_issuer = "wenyan.local"
jwt_audience = "wenyan-gateway"
jwt_alg = "HS256"
jwt_secret = "change-this-secret"
allow_header_actor = false

[law]
mode = "strict"

[distributed]
mode = "single"
node_id = "node-a"
bind_gossip = "127.0.0.1:7946"
seeds = []
fanout = 3
suspicion_timeout_ms = 5000

[consensus]
kind = "none"
replica_set = []
constitutional_threshold = 3
view_change_timeout_ms = 5000
allow_single_replica = false

[bridge]
enabled = false
mode = "standalone"

[bridge.sync]
mode = "hybrid"
poll_interval_ms = 1000
batch_size = 100
```

## Commands

- `pnpm install`
- `pnpm dev` (server local on `8787`)
- `pnpm dev:remote` (remote Worker preview)
- `pnpm dev:server:local` (server only, local wrangler)
- `pnpm dev:server:remote` (server only, remote wrangler)
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm security:audit`
- `pnpm security:fuzz`
- `pnpm sbom:generate`
- `pnpm docs:api`
- `pnpm benchmark:toy:check`
- `pnpm benchmark:stress`
- `wenyan --join gossip://seed:7946`
- `wenyan sync --peer gossip://seed:7946`
- `wenyan mesh status`
- `wenyan bridge run --config wenyan.toml`
- `wenyan imperialworks init|status|ceremony --workers <n> --days <n>`
- `wenyan imperialworks emergency --site <id> --severity <level>`
- `wenyan mobile sync --node <minister-node>`

## Installation From GitHub Packages

Authenticate npm for the `@andrey-kokoev` scope:

```bash
export GITHUB_TOKEN=YOUR_GITHUB_TOKEN
cat > ~/.npmrc <<'EOF'
@andrey-kokoev:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
EOF
```

Install packages:

```bash
npm install @andrey-kokoev/wenyan-core @andrey-kokoev/wenyan-cli @andrey-kokoev/wenyan-gateway
```

## Installation From npmjs

Install public npmjs packages:

```bash
npm install @wenyan2/wenyan-core @wenyan2/wenyan-cli @wenyan2/wenyan-gateway
```

Published packages in v1.x (both registries, different scopes):

- `@andrey-kokoev/wenyan-core`
- `@andrey-kokoev/wenyan-actor`
- `@andrey-kokoev/wenyan-seal`
- `@andrey-kokoev/wenyan-archive`
- `@andrey-kokoev/wenyan-pipeline`
- `@andrey-kokoev/wenyan-gateway`
- `@andrey-kokoev/wenyan-channel`
- `@andrey-kokoev/wenyan-gossip`
- `@andrey-kokoev/wenyan-crdt`
- `@andrey-kokoev/wenyan-consensus`
- `@andrey-kokoev/wenyan-bridge`
- `@andrey-kokoev/wenyan-genesis`
- `@andrey-kokoev/wenyan-cli`
- `@wenyan2/wenyan-core`
- `@wenyan2/wenyan-actor`
- `@wenyan2/wenyan-seal`
- `@wenyan2/wenyan-archive`
- `@wenyan2/wenyan-pipeline`
- `@wenyan2/wenyan-gateway`
- `@wenyan2/wenyan-channel`
- `@wenyan2/wenyan-gossip`
- `@wenyan2/wenyan-crdt`
- `@wenyan2/wenyan-consensus`
- `@wenyan2/wenyan-bridge`
- `@wenyan2/wenyan-genesis`
- `@wenyan2/wenyan-cli`

## Release Runbook (GitHub Packages)

1. Bump versions as needed in workspace package manifests.
2. Push changes to `main`.
3. Create and push tag: `vX.Y.Z`.
4. Verify deploy docs are current:
   - `docs/deploy/quickstart.md`
   - `docs/deploy/production.md`
   - `docs/deploy/enterprise.md`
5. Verify release validation commands pass locally (`pnpm -r typecheck`, `pnpm -r test`, `pnpm -r build`, `pnpm security:audit`, `pnpm benchmark:toy:check`).
6. Publish to GitHub Packages: `pnpm publish:github` (or `pnpm publish:github:dry-run`).
7. Publish npmjs mirror scope: `pnpm publish:npmjs` (or `pnpm publish:npmjs:dry-run`).
8. Confirm packages appear in GitHub repository **Packages** section and npmjs for `@wenyan2`.
