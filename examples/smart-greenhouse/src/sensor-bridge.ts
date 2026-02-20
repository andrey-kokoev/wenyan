export function translateMqttToWenyan(topic: string, payload: Record<string, unknown>) {
  const destination = topic.split('/').slice(1, 2).join('-')
  return {
    genre: 'sensor_reading',
    payload,
    metadata: {
      routing: { destination },
      provenance: { foreign: 'mqtt' },
    },
  }
}

if (process.argv[1]?.endsWith('sensor-bridge.ts')) {
  console.log(JSON.stringify({ ok: true, mode: 'bridge' }))
}
