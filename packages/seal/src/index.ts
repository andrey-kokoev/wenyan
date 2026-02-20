export * from './thresholds'
export * from './crypto'
export * from './merkle'
export * from './chain'

import type { SealContext } from './chain'

export const DEV_SEAL_CONTEXT: SealContext = {
  draftPrivateKeyHex: '1'.repeat(64),
  masterPrivateKeyHex: '2'.repeat(64),
  capabilitySecret: 'wenyan-capability-secret',
  lamportClock: 1,
  routeKey: 'local.default.route',
  imperialSignatures: ['local-dev'],
  provenance: {
    kind: 'agent',
    service_account: 'wenyan-local-agent',
    mtls_fingerprint: 'local-dev-mtls-fingerprint',
  },
}
