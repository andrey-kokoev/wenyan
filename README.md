# Wenyan

Wenyan is a CF Hono + Vite monorepo with a Wenyan runtime architecture.

## Packages

- `packages/app` (`@wenyan/app`) - Vue + Vite client
- `packages/server` (`@wenyan/server`) - Cloudflare Hono server
- `packages/shared` (`@wenyan/shared`) - compatibility/shared facade
- `packages/core` (`@wenyan/core`) - schemas, envelope types, state transitions
- `packages/actor` (`@wenyan/actor`) - role and permission matrix
- `packages/seal` (`@wenyan/seal`) - seal chain primitives and verification
- `packages/archive` (`@wenyan/archive`) - append-only archive repository API
- `packages/pipeline` (`@wenyan/pipeline`) - Caoni/Shenfu/Pizhun stages
- `packages/gateway` (`@wenyan/gateway`) - gateway routes and input filter
- `packages/channel` (`@wenyan/channel`) - reliable local broadcast channel
- `packages/cli` (`@wenyan/cli`) - `wenyan` CLI for submit/status/stream/query
- `packages/tests` - shared fixtures used by server tests

## Runtime endpoints

- `POST /api/wenyan/messages`
- `GET /api/wenyan/messages/:id`
- `GET /api/wenyan/messages?state=...`
- `GET /api/wenyan/stream`

## Configuration

- `wenyan.toml`
- `wenyan.toml.example`

## Commands

- `pnpm install`
- `pnpm dev` (app + server local: Vite on `5175`, Wrangler local on `8787`)
- `pnpm dev:remote` (app + server remote Worker preview)
- `pnpm dev:server:local` (server only, local wrangler)
- `pnpm dev:server:remote` (server only, remote wrangler)
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
