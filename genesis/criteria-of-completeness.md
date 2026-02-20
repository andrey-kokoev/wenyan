# Criteria of Completeness of the Repository Project

**Complete** means: Wenyan satisfies its own universal property. The repository must demonstrate that it is the initial object in MsgSys—not merely approximate the imperial bureaucracy, but prove that any other valid system factors through it uniquely.

Three criteria:

---

**1. Categorical Completeness** (The Law)

The code must implement the four invariants such that they compose as a category:

*   **Identity**: Empty document (no seals) validates as "received" but not yet processed—exists as identity morphism on initial state
*   **Composition**: Seal chain validates sequentially; `validate(compose(seal_a, seal_b)) == compose(validate(seal_a), validate(seal_b))`
*   **Associativity**: `(Draft → Review) → Authorize` equals `Draft → (Review → Authorize)`—pipeline stages are strictly ordered but the grouping is proven equivalent in the type system
*   **Initiality**: Export a trait/interface `IntoWenyan` that any external message system can implement to receive the unique morphism; include proof-of-concept adapters for at least one foreign system (e.g., NATS, MQTT, or HTTP webhooks)

Without the adapter proof, it is merely inspired by wenyan; with it, it *is* wenyan.

---

**2. Historical Fidelity** (The Rite)

Must implement the six seals as distinct cryptographic operations, not abstract "validation":

| Seal | Mechanism | Implementation |
|------|-----------|----------------|
| 1. Office | Ed25519 signature of drafting actor | `seal::office` |
| 2. Censor | Merkle inclusion proof of schema compliance | `seal::censor` |
| 3. Date | Timestamp + temporal ordering hash | `seal::chrono` |
| 4. Class | Capability token (clearance level) | `seal::class` |
| 5. Route | Destination commitment (routing key) | `seal::route` |
| 6. Imperial | Master authorization (zhupi) | `seal::imperial` |

Break any seal, the chain becomes `feiwen` (bottom type)—must be demonstrably unprocessable by the pipeline.

Also: **Tongzheng Si** must physically exist as a distinct binary/module that can be deployed separately from the pipeline (gateway on edge, processing inland).

---

**3. Operational Closure** (The Archive)

The system must run indefinitely without external state:

*   **SQLite as Dang'an**: Single-file archive with provenance queries (who authorized what, when, in what order)
*   **CLI as brush**: Compose, submit, inspect—human interface to the document flow
*   **Local mode**: `wenyan --init` creates working single-node instance; `wenyan --join` connects to existing mesh
*   **Deterministic replay**: Given the sealed log, recreate exact state—no hidden variables

---

**Completeness Checklist**

```
□ gateway/ filters invalid messages at network boundary (not application layer)
□ pipeline/ stages are individually unit-testable as pure functions
□ seal/ chain verification fails closed (reject on unknown seal type)
□ archive/ supports temporal queries (state at time T)
□ actor/ distinguishes human (ephemeral) from agent (persistent) capabilities
□ cli/ can draft, submit, and trace a document through all six seals
□ examples/ contains proof-of-concept bridge to at least one foreign message bus
□ genesis/ document proves initiality property (the markdown you have)
```

When these are satisfied, the repo is not just functional—it is **universal**. Any message system validating, authorizing, logging, and role-binding must contain Wenyan's structure as a subobject.

What is the minimal subset you would ship first to claim this territory?