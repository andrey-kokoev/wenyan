#!/usr/bin/env node
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { readFileSync } from 'node:fs'

type Config = {
  upstream: string
  port: number
}

function parseArgs(argv: string[]): { configPath: string; port?: number } {
  const configIdx = argv.findIndex((a) => a === '--config')
  const portIdx = argv.findIndex((a) => a === '--port')
  return {
    configPath: configIdx >= 0 ? argv[configIdx + 1] : 'wenyan.toml',
    port: portIdx >= 0 ? Number(argv[portIdx + 1]) : undefined,
  }
}

function parseToml(configPath: string): Config {
  const text = readFileSync(configPath, 'utf8')
  const upstreamMatch = text.match(/upstream\s*=\s*"([^"]+)"/)
  const gatewayPortMatch = text.match(/gateway_port\s*=\s*(\d+)/)

  return {
    upstream: upstreamMatch?.[1] ?? process.env.WENYAN_UPSTREAM ?? 'http://127.0.0.1:8787',
    port: gatewayPortMatch ? Number(gatewayPortMatch[1]) : 8080,
  }
}

const args = parseArgs(process.argv.slice(2))
const cfg = parseToml(args.configPath)
const port = args.port ?? cfg.port

const app = new Hono()

async function proxyToUpstream(c: Context) {
  const incoming = new URL(c.req.url)
  const target = new URL(`${cfg.upstream}${incoming.pathname}${incoming.search}`)

  const headers = new Headers()
  for (const [k, v] of c.req.raw.headers.entries()) {
    if (k.toLowerCase() === 'host') continue
    headers.set(k, v)
  }

  const body = c.req.method === 'GET' || c.req.method === 'HEAD' ? undefined : await c.req.text()
  const upstreamRes = await fetch(target, {
    method: c.req.method,
    headers,
    body,
  })

  return new Response(await upstreamRes.text(), {
    status: upstreamRes.status,
    headers: {
      'content-type': upstreamRes.headers.get('content-type') ?? 'application/json',
      ...(upstreamRes.headers.get('location') ? { location: upstreamRes.headers.get('location')! } : {}),
    },
  })
}

app.all('/api/wenyan/*', proxyToUpstream)
app.get('/health', (c) => c.json({ service: 'tongzheng-si', upstream: cfg.upstream, ok: true }))

serve({ fetch: app.fetch, port }, () => {
  console.log(`tongzheng-si running on :${port}, forwarding to ${cfg.upstream}`)
})
