import { describe, expect, it } from 'vitest'
import { NatsIntoWenyanAdapter } from './adapters/nats'
import { KafkaBridgeAdapter } from './adapters/kafka'
import { MqttBridgeAdapter } from './adapters/mqtt'

function metadataKeys(input: Record<string, unknown> | undefined): string[] {
  return Object.keys(input ?? {}).sort()
}

describe('bridge forgetting parity', () => {
  it('keeps only idempotency/routing/provenance metadata across all adapters in strict mode', () => {
    const at = new Date().toISOString()

    const nats = new NatsIntoWenyanAdapter({
      id: 'nats',
      protocol: 'nats',
      url: 'nats://127.0.0.1:4222',
      subject_pattern: ['events.*'],
      target_genre: 'sensor_reading',
      idempotency_header: 'Nats-Msg-Id',
      trust_provenance: true,
      metadata_mode: 'strict',
    })
    const kafka = new KafkaBridgeAdapter({
      id: 'kafka',
      protocol: 'kafka',
      brokers: ['127.0.0.1:9092'],
      topics: ['events'],
      consumer_group: 'wenyan',
      target_genre: 'sensor_reading',
      trust_provenance: true,
      metadata_mode: 'strict',
    })
    const mqtt = new MqttBridgeAdapter({
      id: 'mqtt',
      protocol: 'mqtt',
      url: 'mqtt://127.0.0.1:1883',
      topics: ['events/#'],
      qos: 1,
      target_genre: 'sensor_reading',
      trust_provenance: true,
      metadata_mode: 'strict',
    })

    const natsDoc = nats.translate(
      { subject: 'events.a', data: { temp: 1 }, headers: { 'Nats-Msg-Id': 'n-1', Foo: 'bar' } },
      { protocol: 'nats', adapterId: 'nats', subjectOrTopic: 'events.a', headers: {}, timestampIso: at },
    )
    const kafkaDoc = (kafka.into as { translate: (...args: any[]) => any }).translate(
      { topic: 'events', partition: 0, offset: '1', value: { temp: 1 }, headers: { Foo: 'bar' } },
      { protocol: 'kafka', adapterId: 'kafka', subjectOrTopic: 'events', headers: {}, timestampIso: at },
    )
    const mqttDoc = (mqtt.into as { translate: (...args: any[]) => any }).translate(
      { topic: 'events/a', payload: { temp: 1 }, qos: 1, retain: true, headers: { Foo: 'bar' } },
      { protocol: 'mqtt', adapterId: 'mqtt', subjectOrTopic: 'events/a', headers: {}, timestampIso: at },
    )

    expect(natsDoc.ok && kafkaDoc.ok && mqttDoc.ok).toBe(true)
    if (!natsDoc.ok || !kafkaDoc.ok || !mqttDoc.ok) return

    const expected = ['idempotency_key', 'provenance', 'routing']
    expect(metadataKeys(natsDoc.document.metadata as Record<string, unknown>)).toEqual(expected)
    expect(metadataKeys(kafkaDoc.document.metadata as Record<string, unknown>)).toEqual(expected)
    expect(metadataKeys(mqttDoc.document.metadata as Record<string, unknown>)).toEqual(expected)
  })
})
