export function seedTasks(count = 50): Array<Record<string, unknown>> {
  return Array.from({ length: count }, (_, i) => ({
    id: `task-${i + 1}`,
    title: `Task ${i + 1}`,
    assignee: ['alice', 'bob', 'carol', 'dave'][i % 4],
    done: false,
  }))
}
