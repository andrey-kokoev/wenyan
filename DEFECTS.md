# Architectural Defects and "Fudging" in Wenyan

This document outlines the critical architectural defects, "fudged" implementations, and instances of "Potemkin architecture" discovered during the audit of the `wenyan` repository. The system frequently uses the vocabulary of advanced distributed systems and cryptography but implements them as hardcoded stubs, synchronous bypasses, or dead code.

## 1. Consensus "Theater" (PBFT Implementation)
The PBFT (Practical Byzantine Fault Tolerance) consensus mechanism in `packages/consensus/src/index.ts` is largely decorative and does not provide actual Byzantine fault tolerance.
- **Fake Signatures:** The `signature` field in `PbftMessage` is a simple colon-separated string (`${leaderNodeId}:${proposalId}:${this.viewNo}`) rather than a cryptographically verified signature.
- **Self-Approval:** The pipeline logic in `packages/pipeline/src/index.ts` automatically calls `onPrepare` and `onCommit` on its own proposal. With the default threshold of 1, a node effectively "consents" with itself, bypassing the need for a real distributed replica set.

## 2. Fake Distributed Sync & CRDT Theater
The system claims to support distributed synchronization and CRDT-based conflict resolution, but the implementation is entirely fake.
- **Sync Does Nothing:** In `packages/archive/src/sync.ts`, the `syncWithPeer` function fetches a range of transitions from a remote peer but **never applies them to the local database**. It simply returns the number of items fetched and discards the data.
- **CRDT "Theater":** In `packages/server/src/index.ts`, if the sync detects a divergence, the code creates two hardcoded, dummy `EdictLike` objects (`a` with `id: 'local'` and `b` with `id: 'remote'`), calls `mergeEdict(a, b)`, and **completely ignores the result**. This exists solely to make it look like CRDT conflict resolution is happening.

## 3. Fake Gossip Protocol (Plumtree & SWIM)
The `packages/gossip/src/index.ts` file defines complex-sounding protocols (`PlumtreeBroadcast`, `SwimMembership`), but they are just local stubs.
- **InMemoryPlumtree:** The `eagerPush` method doesn't send any network requests. It simply returns a hardcoded array of strings: `['peer-1', 'peer-2', 'peer-3']`.
- **SwimMembership:** There are no actual network heartbeats. It is just an in-memory `Map` that marks a node as "suspect" if the local `heartbeat()` function hasn't been called recently.

## 4. Synchronous "Docket" Queue
The architecture implies an asynchronous, event-driven pipeline using a "Docket" (queue). However, in `packages/gateway/src/index.ts`, the Gateway POST handler does this:
1. `await repo.enqueueDocket(message.id)`
2. `const item = await repo.dequeueDocket(...)`
3. `await processDocketMessage(...)`

It inserts the message into the SQLite queue and then **immediately dequeues and processes it in the exact same synchronous HTTP request**. There is no background worker. The queue is just a database write/delete penalty added to a synchronous API call.

## 5. Security Bypasses in Gateway
The Gateway implementation in `packages/gateway/src/index.ts` contains major security shortcuts.
- **Identity Trust:** The `actorFromHeaders` function trusts the `x-wenyan-actor-id` and `x-wenyan-actor-role` headers without any authentication. Anyone can claim to be the `genesis_admin` by setting these headers.
- **Token-as-ID:** Bearer tokens are used directly as the User ID without validation against a registry or IDP.
- **Failure-to-Allow:** If the "Access Control" law is missing from the archive, the system defaults to allowing access to maintain "compatibility."

## 6. Terminological "Fudging"
Several features are named after complex protocols but implemented as simple stubs.
- **Streaming:** The `/stream` endpoint in the Gateway and the "Ritual 10: Streaming" test do not use real-time protocols (WebSockets/SSE). Instead, the server returns a JSON replay of an in-memory event log for the last hour.
- **Merkle Proofs:** The `getMerkleProof` implementation in the SQLite repository returns a hardcoded empty path (`path: []`). This renders the "proof" useless for verification, as it contains only the leaf and the root without the intermediary siblings.

## 7. Fake Audit Bundles
The `exportAuditBundle` function in `packages/archive/src/sqlite.ts` is supposed to export a verifiable cryptographic bundle of the archive's state. Instead, it just returns a dump of the `seal_0_log` (read receipts) and the hash of the latest checkpoint. It does not export the actual messages, the seal chains, or the Merkle tree paths required to actually verify the checkpoint.

## 8. Hardcoded Contexts & Mock Logic
The system relies heavily on the `DEV_SEAL_CONTEXT`, which uses literal string keys (e.g., `'1'.repeat(64)`).
- Many system components (Gateway, Pipeline) use this as a **default parameter**, meaning that unless explicitly configured with real keys, the system operates in a "test-mode-by-default" state.

## 9. Cryptographic Simplifications
- **Non-Standard JWTs:** The "Capability Tokens" generated in `packages/seal/src/crypto.ts` are modeled as JWTs but use a homegrown SHA-256 concatenation instead of the standard HMAC-SHA256 required for HS256. This is technically a "cryptographic fudge" that is less secure than standard implementations.

## 10. "Anomaly Detection" is Just Basic `if` Statements
The `AnomalyDetector` in `packages/censorate/src/anomaly.ts` uses impressive terminology (`detectVelocity`, `detectTemporal`, `detectGeographic`, `detectCoalition`) but implements nothing more than basic `if (value > threshold)` checks. For example, `detectVelocity` just checks if the length of an array is greater than a number. While not strictly a bug, it heavily overstates the system's capabilities.
