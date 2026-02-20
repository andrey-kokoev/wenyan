import { describe, expect, it } from 'vitest';
import { canTransition, validateEnvelope } from './index';

describe('core', () => {
  it('validates envelope', () => {
    const msg = validateEnvelope({
      id: 'm1',
      genre: 'memo',
      payload: { a: 1 },
      actor: { id: 'u1', role: 'admin' },
      submittedAt: new Date().toISOString(),
      metadata: {},
    });
    expect(msg.id).toBe('m1');
  });

  it('enforces transitions', () => {
    expect(canTransition('pending', 'validated')).toBe(true);
    expect(canTransition('pending', 'archived')).toBe(false);
  });
});
