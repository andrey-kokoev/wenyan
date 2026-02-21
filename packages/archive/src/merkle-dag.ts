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
  path: Array<{ siblingHash: string; side: 'left' | 'right' }>
  rootHash: string
}

export function verifyMerkleProof(proof: MerkleProofLike): boolean {
  let hash = blake3CompatHash(proof.leafHash)
  for (const step of proof.path) {
    if (step.side === 'left') {
      hash = blake3CompatHash(`${step.siblingHash}:${hash}`)
      continue
    }
    hash = blake3CompatHash(`${hash}:${step.siblingHash}`)
  }
  return hash === proof.rootHash
}

export function buildMerkleProofFromLeaves(
  rawLeaves: string[],
  targetIndex: number,
): { leafHash: string; rootHash: string; path: Array<{ siblingHash: string; side: 'left' | 'right' }> } {
  if (targetIndex < 0 || targetIndex >= rawLeaves.length) {
    throw new Error('merkle-target-out-of-range')
  }
  if (rawLeaves.length === 0) {
    throw new Error('merkle-empty-leaves')
  }

  let layer = rawLeaves.map((x) => blake3CompatHash(x))
  let idx = targetIndex
  const path: Array<{ siblingHash: string; side: 'left' | 'right' }> = []

  while (layer.length > 1) {
    const isRight = idx % 2 === 1
    const siblingIndex = isRight ? idx - 1 : idx + 1
    const siblingHash = layer[siblingIndex] ?? layer[idx]
    path.push({ siblingHash, side: isRight ? 'left' : 'right' })

    const next: string[] = []
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]
      const right = layer[i + 1] ?? left
      next.push(blake3CompatHash(`${left}:${right}`))
    }
    layer = next
    idx = Math.floor(idx / 2)
  }

  return {
    leafHash: rawLeaves[targetIndex],
    rootHash: layer[0],
    path,
  }
}
