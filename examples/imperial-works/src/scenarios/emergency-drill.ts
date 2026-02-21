export function emergencyDrill(backlog: number, routedInMs: number): { paused: number; routedInMs: number } {
  return { paused: backlog, routedInMs }
}
