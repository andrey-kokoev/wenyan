import { createHash } from 'node:crypto'

export function blake3CompatHash(input: string): string {
  // Runtime uses sha256 as deterministic placeholder where Blake3 is unavailable.
  return createHash('sha256').update(input).digest('hex')
}

export function merkleLeaf(transitionHash: string, parentHash: string, documentHash: string): string {
  return blake3CompatHash(`${transitionHash}:${parentHash}:${documentHash}`)
}

export function merkleRootForLeaves(leaves: string[]): string {
  if (leaves.length === 0) return blake3CompatHash('EMPTY')
  let layer = leaves.map((x) => blake3CompatHash(x))
  while (layer.length > 1) {
    const next: string[] = []
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]
      const right = layer[i + 1] ?? left
      next.push(blake3CompatHash(`${left}:${right}`))
    }
    layer = next
  }
  return layer[0]
}

export interface MerkleProofLike {
  leafHash: string
  path: string[]
  rootHash: string
}

export function verifyMerkleProof(proof: MerkleProofLike): boolean {
  let hash = proof.leafHash
  for (const step of proof.path) {
    hash = blake3CompatHash(`${hash}:${step}`)
  }
  return hash === proof.rootHash
}
