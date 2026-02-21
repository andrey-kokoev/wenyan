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

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export async function waitForState(
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
  while (Date.now() < deadline) {
    const res = await app.request(`/messages/${id}`, init)
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

export async function waitForReplayEvent(
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
