export function todoTask(i: number): Record<string, unknown> {
  return {
    title: `Task ${i}`,
    assignee: ['alice', 'bob', 'carol', 'dave'][i % 4],
    done: false,
  }
}

export function treasuryProposal(amount: number, to = 'GameStore'): Record<string, unknown> {
  return { to, amount, reason: 'allowance' }
}

export function sensorReading(v = 22.5): Record<string, unknown> {
  return { temp: v, humidity: 60, soil_ph: 6.5 }
}
