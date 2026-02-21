import { createHash } from 'node:crypto'
import { getPublicKeyAsync } from '@noble/ed25519'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import { PbftConsensus, signPbftMessage, type PbftMessageToSign } from '@andrey-kokoev/wenyan-consensus'

function privateKeyForNode(nodeId: string): string {
  return createHash('sha256').update(`wenyan-pbft:${nodeId}`).digest('hex').slice(0, 64)
}

export async function createPbftFixture(
  replicaSet: string[],
  threshold: number,
  allowSingleReplica = false,
): Promise<{
  pbft: PbftConsensus
  privateKeys: Record<string, string>
  signed: (msg: PbftMessageToSign) => Promise<PbftMessageToSign & { signature: string }>
}> {
  const privateKeys: Record<string, string> = {}
  const publicKeys: Record<string, string> = {}
  for (const node of replicaSet) {
    const privateKey = privateKeyForNode(node)
    privateKeys[node] = privateKey
    publicKeys[node] = bytesToHex(await getPublicKeyAsync(hexToBytes(privateKey)))
  }
  const pbft = new PbftConsensus({
    replicaSet,
    threshold,
    replicaPublicKeys: publicKeys,
    replicaPrivateKeys: privateKeys,
    allowSingleReplica,
  })
  return {
    pbft,
    privateKeys,
    signed: async (msg) => ({
      ...msg,
      signature: await signPbftMessage(msg, privateKeys[msg.nodeId]),
    }),
  }
}
