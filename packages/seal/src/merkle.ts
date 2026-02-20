import { digestHex } from './crypto'

function toLeaf(value: string): string {
  return digestHex(`leaf:${value}`)
}

export function merkleRoot(values: string[]): string {
  if (values.length === 0) return digestHex('merkle:empty')
  let level = values.map((v) => toLeaf(v))
  while (level.length > 1) {
    const next: string[] = []
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]
      const right = level[i + 1] ?? left
      next.push(digestHex(`node:${left}:${right}`))
    }
    level = next
  }
  return level[0]
}
