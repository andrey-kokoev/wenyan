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
- `packages/cli` (`@wenyan/cli`) - `wenyan` CLI for `--init`, `draft`, `submit`, `status`, `query`, `stream`
- `packages/tests` - shared fixtures used by server tests

## Storage adapters

- `sqlite` adapter (local Dang'an)
- `cloudflare` adapter (D1-backed Dang'an)
- `memory` adapter (test fallback)

## Law In Dang'an

- Runtime law/config for admission/appointment/classification/routing/protocol/regulation is resolved from archived `genre: "edict"` documents.
- Genre schema registry is archived as sealed `genre: "ti_definition"` documents.
- Static filesystem config is bootstrap-only (`wenyan.toml`): archive engine/path, genesis identity/key, gateway bind, and optional law cache tuning.
- Default mode is `compat`: missing/ambiguous/invalid law can fall back to legacy behavior with emitted fallback events.
- `strict` mode fails closed when required law cannot be resolved.

## Runtime endpoints

- `POST /api/wenyan/messages`
- `GET /api/wenyan/messages/:id`
- `GET /api/wenyan/messages?state=...`
- `GET /api/wenyan/stream`

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
mode = "compat"
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
