import { describe, expect, it } from 'vitest'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import { getPublicKeyAsync } from '@noble/ed25519'
import { PbftConsensus, signPbftMessage, type PbftMessageToSign } from './index'

async function keysFor(nodes: string[]): Promise<{ pub: Record<string, string>; priv: Record<string, string> }> {
  const priv: Record<string, string> = {}
  const pub: Record<string, string> = {}
  for (const [idx, node] of nodes.entries()) {
    const sk = `${(idx + 1).toString(16)}`.repeat(64).slice(0, 64)
    priv[node] = sk
    pub[node] = bytesToHex(await getPublicKeyAsync(hexToBytes(sk)))
  }
  return { pub, priv }
}

async function signed(
  base: PbftMessageToSign,
  privateKeyHex: string,
): Promise<PbftMessageToSign & { signature: string }> {
  return {
    ...base,
    signature: await signPbftMessage(base, privateKeyHex),
  }
}

describe('pbft consensus', () => {
  it('commits only after prepare+commit threshold', async () => {
    const replicaSet = ['n1', 'n2', 'n3']
    const { pub, priv } = await keysFor(replicaSet)
    const pbft = new PbftConsensus({
      replicaSet,
      threshold: 2,
      replicaPublicKeys: pub,
      replicaPrivateKeys: priv,
    })
    const proposal = await pbft.proposeTiDefinition('p1', 'n1')
    const at = new Date().toISOString()
    await pbft.onPrepare(await signed({ proposalId: proposal.proposalId, viewNo: proposal.viewNo, nodeId: 'n1', phase: 'prepare', at }, priv.n1))
    await pbft.onPrepare(await signed({ proposalId: proposal.proposalId, viewNo: proposal.viewNo, nodeId: 'n2', phase: 'prepare', at }, priv.n2))
    expect(pbft.commitIfThreshold('p1')).toBe(false)
    await pbft.onCommit(await signed({ proposalId: proposal.proposalId, viewNo: proposal.viewNo, nodeId: 'n1', phase: 'commit', at }, priv.n1))
    await pbft.onCommit(await signed({ proposalId: proposal.proposalId, viewNo: proposal.viewNo, nodeId: 'n2', phase: 'commit', at }, priv.n2))
    expect(pbft.commitIfThreshold('p1')).toBe(true)
  })

  it('rejects forged signatures', async () => {
    const replicaSet = ['n1', 'n2', 'n3']
    const { pub, priv } = await keysFor(replicaSet)
    const pbft = new PbftConsensus({
      replicaSet,
      threshold: 2,
      replicaPublicKeys: pub,
      replicaPrivateKeys: priv,
    })
    const proposal = await pbft.proposeTiDefinition('p2', 'n1')
    const forged = await signed(
      { proposalId: proposal.proposalId, viewNo: proposal.viewNo, nodeId: 'n2', phase: 'prepare', at: new Date().toISOString() },
      priv.n1,
    )
    await expect(pbft.onPrepare(forged)).rejects.toThrow(/invalid PBFT signature/)
  })

  it('advances view on view-change', async () => {
    const replicaSet = ['n1', 'n2', 'n3']
    const { pub, priv } = await keysFor(replicaSet)
    const pbft = new PbftConsensus({
      replicaSet,
      threshold: 2,
      replicaPublicKeys: pub,
      replicaPrivateKeys: priv,
    })
    expect(pbft.currentView()).toBe(0)
    await pbft.onViewChange('n2')
    expect(pbft.currentView()).toBe(1)
  })
})
