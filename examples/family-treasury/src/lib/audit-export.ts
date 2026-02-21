export function exportMonthlyAudit(month: string, transactions: number): { month: string; merkleRoot: string; transactions: number } {
  return { month, merkleRoot: `root-${month}`, transactions }
}
