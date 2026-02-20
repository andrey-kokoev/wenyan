import { describe, expect, it } from 'vitest'
import { BootstrapConfigSchema, canTransition, EdictSchema, parseBootstrapConfigToml, validateEnvelope } from './index'

describe('core', () => {
  it('validates envelope', () => {
    const msg = validateEnvelope({
      id: 'm1',
      genre: 'memo',
      payload: { a: 1 },
      actor: { id: 'u1', role: 'admin' },
      submittedAt: new Date().toISOString(),
      metadata: {},
    })
    expect(msg.id).toBe('m1')
  })

  it('enforces transitions', () => {
    expect(canTransition('pending', 'validated')).toBe(true)
    expect(canTransition('pending', 'archived')).toBe(false)
  })

  it('validates edict documents', () => {
    const edict = EdictSchema.parse({
      id: 'e1',
      genre: 'edict',
      payload: {
        law_type: 'admission',
        version: '1.0.0',
        content: { allowed_genres: ['petition'] },
        precedence: 0,
        effective_date: new Date().toISOString(),
      },
      actor: { id: 'u1', role: 'admin' },
      submittedAt: new Date().toISOString(),
      metadata: {},
    })

    expect(edict.payload.law_type).toBe('admission')
  })

  it('parses bootstrap toml', () => {
    const cfg = parseBootstrapConfigToml(`
[archive]
engine = "sqlite"
path = "./wenyan.dang'an"

[genesis]
node_id = "11111111-1111-4111-8111-111111111111"
genesis_key = "Zm9v"

[gateway.listen]
host = "127.0.0.1"
port = 8787

[law]
mode = "strict"
`)
    expect(BootstrapConfigSchema.parse(cfg).archive.engine).toBe('sqlite')
    expect(cfg.gateway.listen.port).toBe(8787)
  })
})
