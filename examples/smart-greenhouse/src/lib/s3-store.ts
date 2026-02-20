export interface ColdObject {
  key: string
  hash: string
}

export function buildColdObjectKey(prefix: string, date: string): string {
  return `${prefix}/${date}.parquet`
}
