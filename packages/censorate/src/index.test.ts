import { describe, expect, it } from 'vitest'
import { AnomalyDetector, AuditService, CheckpointService, WenyanTracer } from './index'

describe('censorate exports', () => {
  it('exposes runtime primitives', () => {
    expect(typeof AnomalyDetector).toBe('function')
    expect(typeof AuditService).toBe('function')
    expect(typeof CheckpointService).toBe('function')
    expect(typeof WenyanTracer).toBe('function')
  })
})
