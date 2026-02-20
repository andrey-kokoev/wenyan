export function exportMonthlyAudit(month: string): { month: string; merkleRoot: string; transactions: number } {
  return { month, merkleRoot: `root-${month}`, transactions: 150 }
}
