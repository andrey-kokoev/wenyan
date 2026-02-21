import { expect } from 'vitest'

type AppLike = {
  request: (path: string, init?: RequestInit) => Response | Promise<Response>
}

export interface MessageStatusResponse {
  state: string
  transitions: Array<{ reason?: string }>
  message: {
    id: string
    genre: string
    payload: Record<string, unknown>
    actor: { id: string; role: string }
    submittedAt: string
    metadata: Record<string, unknown>
  }
  seals: unknown[]
}
import { createHmac } from 'node:crypto'

export function issueToken (subject: string, role: string): string {
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({
      iss: 'wenyan.local',
      aud: 'wenyan-gateway',
      sub: subject,
      role,
      iat: now,
      exp: now + 3600,
    }),
  ).toString('base64url')
  const sig = createHmac('sha256', 'wenyan-local-jwt-secret')
    .update(`${header}.${payload}`)
    .digest('base64url')
  return `${header}.${payload}.${sig}`
}
export function withAuth<T extends AppLike> (app: T, subject = 'ritual-actor', role = 'genesis_admin'): T {
  const originalRequest = app.request.bind(app)
  app.request = async (path: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    if (!headers.has('authorization')) {
      headers.set('authorization', `Bearer ${issueToken(subject, role)}`)
    }
    return originalRequest(path, { ...init, headers })
  }
  return app
}

export async function sleep (ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export async function waitForState (
  app: AppLike,
  id: string,
  expected: string | string[],
  timeoutMs = 5000,
  pollMs = 50,
  init?: RequestInit,
): Promise<MessageStatusResponse> {
  const expectedStates = new Set(Array.isArray(expected) ? expected : [expected])
  const deadline = Date.now() + timeoutMs
  let last: MessageStatusResponse | undefined
  const requestInit = init ?? { headers: { authorization: `Bearer ${issueToken('ritual-actor', 'genesis_admin')}` } }
  while (Date.now() < deadline) {
    const res = await app.request(`/messages/${id}`, requestInit)
    if (res.status === 200) {
      const json = (await res.json()) as MessageStatusResponse
      last = json
      if (expectedStates.has(json.state)) return json
    }
    await sleep(pollMs)
  }
  expect(last?.state).toBe(Array.from(expectedStates).join('|'))
  throw new Error('unreachable')
}

export async function waitForReplayEvent (
  app: AppLike,
  messageId: string,
  timeoutMs = 5000,
  pollMs = 50,
): Promise<{ messageId: string; at: string; type: string }> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const replay = await app.request('/stream/replay')
    if (replay.status === 200) {
      const body = (await replay.json()) as {
        events: Array<{ messageId: string; at: string; type: string }>
      }
      const found = body.events.find((event) => event.messageId === messageId)
      if (found) return found
    }
    await sleep(pollMs)
  }
  throw new Error(`replay event not found for ${messageId}`)
}
