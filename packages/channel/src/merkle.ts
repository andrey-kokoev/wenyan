import { createHash } from 'node:crypto'

interface ConstitutionalRepo {
  getConstitutionalDocuments():
    | Array<{ id: string; archivedAt: string }>
    | Promise<Array<{ id: string; archivedAt: string }>>
}

function digestHex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

export function merkleRoot(items: string[]): string {
  if (items.length === 0) return digestHex('EMPTY')
  let layer = items.map((item) => digestHex(item))
  while (layer.length > 1) {
    const next: string[] = []
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]
      const right = layer[i + 1] ?? left
      next.push(digestHex(`${left}:${right}`))
    }
    layer = next
  }
  return layer[0]
}

export async function constitutionalMerkleRoot(archive: ConstitutionalRepo): Promise<string> {
  const docs = await archive.getConstitutionalDocuments()
  const ordered = docs
    .slice()
    .sort((a, b) => a.archivedAt.localeCompare(b.archivedAt) || a.id.localeCompare(b.id))
    .map((d) => `${d.archivedAt}:${d.id}`)
  return merkleRoot(ordered)
}
