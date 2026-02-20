# Wenyan

Wenyan is the **initial object** in the category **MsgSys** where:

- **Objects**: typed message systems supporting four invariants:
  - Input validation (schema compliance at boundary)
  - Stateful authorization (role-dependent state transitions)
  - Immutable logging (append-only audit trail)
  - Actor boundaries (typed interfaces between human/agent)

- **Morphisms**: structure-preserving maps respecting:
  - Input filters (gateway topology)
  - State transitions (seal-chain validation)
  - Audit trails (historical functoriality)
  - Actor capabilities (permission fibrations)

For any S ∈ MsgSys, ∃! morphism Wenyan → S.

## Architectural Translation

The categorical structure maps to historical mechanics:

| Category | Imperial Implementation | Modern Package |
|----------|------------------------|----------------|
| Input filter | Tongzheng Si (通政司) | `gateway/` |
| Free construction | Caoni (草擬) | `pipeline/draft` |
| Equalizer | Shenfu (審覆) | `pipeline/verify` |
| Coequalizer | Pizhun (批准) | `pipeline/authorize` |
| Endofunctor | Seal chain (鈐印) | `seal/` |
| Terminal coalgebra | Dang'an (檔案) | `archive/` |

## Type-Theoretic Core

Wenyan implements a typed schema/runtime model where:

- **Kinds** (Ti/體): Document genres defined in `core/` schemas
- **Terms** (Ci/辭): Message payloads parameterized by provenance
- **Certificates** (Shu/書): Cryptographic proof records attached per message

The six-seal chain is enforced at runtime through deterministic hash/signature verification and archive transition checks. Tampering breaks verification and is rejected.

## Runtime Structure

**Static** (The Law):
- Schema definitions (immutable kinds)
- Cryptographic invariants (hash algorithms, signature schemes)
- State machine graph (valid transitions encoded in TypeScript schemas/helpers)
- Role hierarchy (law-resolved permissions, strict fail-closed)

**Moving** (The Flow):
- Message instances (temporary documents in pipeline)
- Actor processes (ephemeral WebSocket connections)
- Seal instances (generated proofs attached per-message)
- Docket queues (pending states awaiting authorization)

## Deployment Invariant

Local execution maintains the same categorical properties as distributed: SQLite can serve as both **state machine registry** and **immutable archive** (Dang'an), while Cloudflare D1 is supported through the same adapter contract. The gateway-pipeline-archive triad forms the minimal viable universal property.
