export function todoAuditTrace(taskId: string): { taskId: string; stages: string[] } {
  return { taskId, stages: ['seal0', 'seal1', 'seal2', 'seal3', 'seal4', 'seal5', 'seal6'] }
}
