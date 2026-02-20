# Criteria of Completeness of the Repository Project

**Complete** means: Wenyan satisfies its own universal property. The repository demonstrates an initial object in MsgSys via type structure and runtime artifacts.

Three criteria:

---

## 1. Categorical Completeness (The Law)

Categorical laws are **structural guarantees** of architecture and types, not test-file artifacts.

- **Identity**: Initial morphism is represented by the received baseline state in the state graph.
- **Composition**: Pipeline is a composition of stage morphisms (`draft -> review -> authorize`).
- **Associativity**: Grouping equivalence is guaranteed by function composition and typed stage boundaries.
- **Initiality**: Foreign systems factor through `IntoWenyan`; adapters forget foreign structure and reconstitute Wenyan documents.

Without the adapter proof, it is only inspired by wenyan; with it, it is wenyan.

---

## 2. Historical Fidelity (The Rite)

Six seals are distinct cryptographic operations (not generic validation):

| Seal | Mechanism | Implementation |
|------|-----------|----------------|
| 1. Office | Ed25519 + provenance route (human WebAuthn / agent mTLS) | `seal` stage `caoni` |
| 2. Censor | Schema compliance fingerprint | `seal` stage `shenfu-1` |
| 3. Date | Timestamp + ordering payload | `seal` stage `shenfu-2` |
| 4. Class | Capability token | `seal` stage `shenfu-3` |
| 5. Route | Destination commitment | `seal` stage `shenfu-4` |
| 6. Imperial | Master authorization signature | `seal` stage `pizhun` |

Break any seal and the chain fails closed.

Also: **Tongzheng Si** exists as a distinct deployable binary (`tongzheng-si`) separate from pipeline/archive runtime.

---

## 3. Operational Closure (The Archive)

- **SQLite as Dang'an**: Single-file immutable log with provenance and temporal state lookup.
- **CLI as brush**: `draft`, `submit`, `status`, `query`, `stream`.
- **Local mode**: `wenyan --init` and `wenyan --join`.
- **Deterministic replay**: `replay` reduces transitions to state without hidden variables.

---

## Runtime Completion Artifacts

- `stateAt` implemented from transition archive snapshots (`sealed_at <= T`, latest sequence)
- `replay` implemented as pure fold over transitions
- provenance routing implemented for Seal 1 (`HumanActor | AgentActor`)
- bridge forgetting demonstrated in NATS adapter (drops foreign headers)
- standalone Tongzheng binary implemented (`packages/gateway/src/server.ts`)
- CLI draft/bootstrap/join workflow implemented (`packages/cli/src/index.ts`)

---

## Completeness Checklist

- [x] gateway filters invalid messages at network boundary
- [x] pipeline stage composition is structural and type-safe
- [x] seal chain verification fails closed
- [x] archive supports temporal query (`stateAt`)
- [x] actor distinguishes human vs agent provenance at type level
- [x] cli supports draft, submit, and trace workflow
- [x] examples include foreign message bus bridge with forgetting
- [x] genesis document states initiality property

When these are satisfied, Wenyan is universal: systems that validate, authorize, log, and role-bind factor through its structure.
