export function todoTask(i: number): Record<string, unknown> {
  return {
    title: `Task ${i}`,
    assignee: ['alice', 'bob', 'carol', 'dave'][i % 4],
    done: false,
  }
}

export const ritualNumbers = {
  r1: {
    pbftThreshold: 3,
  },
  r2: {
    convergenceMs: 5000,
  },
  r3: {
    attackAttempts: 12,
  },
  r6: {
    sensorFloodCount: 120,
  },
  r7: {
    legacyCount: 10,
    lightLux: 1000,
  },
  r9: {
    sampleCount: 10,
  },
} as const

export function treasuryProposal(amount: number, to = 'GameStore'): Record<string, unknown> {
  return { to, amount, reason: 'allowance' }
}

export function sensorReading(v = 22.5): Record<string, unknown> {
  return { temp: v, humidity: 60, soil_ph: 6.5 }
}
