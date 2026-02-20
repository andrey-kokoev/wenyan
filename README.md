# Wenyan

Wenyan is monorepo implementing the Wenyan runtime architecture.

## Genesis Docs

If you want to understand the architectural rationale and design principles behind Wenyan, start with the genesis docs:

- [`genesis/wenyan.md`](genesis/wenyan.md) - architectural genesis and model
- [`genesis/criteria-of-completeness.md`](genesis/criteria-of-completeness.md) - completion criteria and invariants
- [`genesis/out-of-scope.md`](genesis/out-of-scope.md) - explicit non-goals and boundaries
- [`sequence-graph.md`](sequence-graph.md) - end-to-end sequencing graph of the Wenyan flow

## Packages

- `packages/server` (`@wenyan/server`) - Cloudflare Hono server
- `packages/shared` (`@wenyan/shared`) - compatibility/shared facade
- `packages/core` (`@wenyan/core`) - schemas, envelope types, state transitions, bootstrap/law schemas
- `packages/actor` (`@wenyan/actor`) - law-driven actor permission helpers
- `packages/seal` (`@wenyan/seal`) - seal chain primitives and verification
- `packages/archive` (`@wenyan/archive`) - append-only archive repository API + law/genre lookup
- `packages/pipeline` (`@wenyan/pipeline`) - Caoni/Shenfu/Pizhun stages + law resolver
- `packages/gateway` (`@wenyan/gateway`) - gateway routes and Tongzheng Si input filter
- `packages/channel` (`@wenyan/channel`) - reliable local broadcast channel
- `packages/gossip` (`@wenyan/gossip`) - SWIM/Plumtree-style consort gossip primitives
- `packages/crdt` (`@wenyan/crdt`) - CRDT reconciliation for legislative conflicts
- `packages/consensus` (`@wenyan/consensus`) - PBFT lifecycle for constitutional consensus
- `packages/bridge` (`@wenyan/bridge`) - foreign protocol bridge runtime (standalone Node)
- `packages/imperial-works` (`@wenyan/imperial-works`) - role hierarchy, emergency routing, and construction anomaly rules
- `packages/mobile-foreman` (`@wenyan/mobile-foreman`) - PWA offline foreman queue and sync primitives
- `packages/genesis` (`@wenyan/genesis`) - explicit genesis bootstrap (`createEmptyOffice`, `applyGenesis`)
- `packages/cli` (`@wenyan/cli`) - `wenyan` CLI for `--init`, `draft`, `submit`, `status`, `query`, `stream`, `imperialworks`, `mobile sync`
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

- `POST /api/wenyan/messages`
- `GET /api/wenyan/messages/:id`
- `GET /api/wenyan/messages?state=...`
- `GET /api/wenyan/stream`
- `GET /api/wenyan/mesh/status`
- `POST /api/wenyan/mesh/join`
- `POST /api/wenyan/mesh/sync`
- `GET /api/wenyan/mesh/merkle-root`

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
- `wenyan --join gossip://seed:7946`
- `wenyan sync --peer gossip://seed:7946`
- `wenyan mesh status`
- `wenyan bridge run --config wenyan.toml`
- `wenyan imperialworks init|status|ceremony --workers <n> --days <n>`
- `wenyan imperialworks emergency --site <id> --severity <level>`
- `wenyan mobile sync --node <minister-node>`

## Installation From GitHub Packages

Authenticate npm for the `@wenyan` scope:

```bash
export GITHUB_TOKEN=YOUR_GITHUB_TOKEN
cat > ~/.npmrc <<'EOF'
@wenyan:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
EOF
```

Install packages:

```bash
npm install @wenyan/core @wenyan/cli @wenyan/gateway
```

Published packages in v0.3.x:

- `@wenyan/core`
- `@wenyan/actor`
- `@wenyan/seal`
- `@wenyan/archive`
- `@wenyan/pipeline`
- `@wenyan/gateway`
- `@wenyan/channel`
- `@wenyan/gossip`
- `@wenyan/crdt`
- `@wenyan/consensus`
- `@wenyan/bridge`
- `@wenyan/genesis`
- `@wenyan/cli`

## Release Runbook (GitHub Packages)

1. Bump versions as needed in workspace package manifests.
2. Push changes to `main`.
3. Create and push tag: `vX.Y.Z`.
4. Verify `.github/workflows/release.yml` succeeds.
5. Confirm packages appear in GitHub repository **Packages** section.
