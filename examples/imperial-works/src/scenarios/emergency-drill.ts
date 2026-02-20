export function emergencyDrill(backlog = 1000): { paused: number; routedInMs: number } {
  return { paused: backlog, routedInMs: 800 }
}
