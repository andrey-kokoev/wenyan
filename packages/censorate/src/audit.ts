import { createHash, createHmac } from 'node:crypto'
import type { Seal0Receipt } from '@andrey-kokoev/wenyan-core'

export interface Seal0WriteInput {
  documentId?: string
  actorId: string
  genre?: string
  queryParameters: Record<string, unknown>
  result: unknown
  resultStatus: 'allowed' | 'denied'
  reason?: string
  traceId?: string
  nodeId?: string
  atIso?: string
}

export interface Seal0Repository {
  appendSeal0Receipt(receipt: Seal0Receipt): void | Promise<void>
}

function digest(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function sign(input: string, secret: string): string {
  return createHmac('sha256', secret).update(input).digest('hex')
}

export class AuditService {
  constructor(
    private readonly repository: Seal0Repository,
    private readonly secret: string,
  ) {}

  async createReadReceipt(input: Seal0WriteInput): Promise<Seal0Receipt> {
    if (!input.actorId) {
      throw new Error('seal0-actor-required')
    }

    const at = input.atIso ?? new Date().toISOString()
    const queryHash = digest(JSON.stringify(input.queryParameters))
    const resultHash = digest(JSON.stringify(input.result ?? null))
    const id = `seal0:${input.documentId ?? 'none'}:${input.actorId}:${Date.now()}`
    const signature = sign(
      JSON.stringify({
        id,
        document_id: input.documentId ?? null,
        actor_id: input.actorId,
        query_timestamp: at,
        query_parameters_hash: queryHash,
        result_hash: resultHash,
        result_status: input.resultStatus,
        reason: input.reason,
        trace_id: input.traceId,
        node_id: input.nodeId,
      }),
      this.secret,
    )

    const receipt: Seal0Receipt = {
      id,
      document_id: input.documentId ?? null,
      actor_id: input.actorId,
      genre: input.genre,
      query_timestamp: at,
      query_parameters_hash: queryHash,
      result_hash: resultHash,
      result_status: input.resultStatus,
      reason: input.reason,
      signature,
      trace_id: input.traceId,
      node_id: input.nodeId,
    }

    await this.repository.appendSeal0Receipt(receipt)
    return receipt
  }

  verifySeal0(receipt: Seal0Receipt): boolean {
    const expected = sign(
      JSON.stringify({
        id: receipt.id,
        document_id: receipt.document_id,
        actor_id: receipt.actor_id,
        query_timestamp: receipt.query_timestamp,
        query_parameters_hash: receipt.query_parameters_hash,
        result_hash: receipt.result_hash,
        result_status: receipt.result_status,
        reason: receipt.reason,
        trace_id: receipt.trace_id,
        node_id: receipt.node_id,
      }),
      this.secret,
    )
    return receipt.signature === expected
  }
}
