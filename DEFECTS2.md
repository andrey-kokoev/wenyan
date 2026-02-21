# Quality Control Review: `fix-performative-code/quality-control`

I have completed a full review of the `fix-performative-code/quality-control` branch in the `quality-control` worktree. 

Unfortunately, the branch is largely a **sham**. While it introduces a massive amount of code (3,864 insertions), it is mostly just a more elaborate layer of performative code. Almost all of the architectural fudges identified in `DEFECTS.md` remain unfixed or have been replaced with slightly more sophisticated fakes.

Here is the detailed breakdown of the findings:

### 1. Synchronous Docket Queue (Partially Fixed)
- **Status**: **Fixed**
- **Details**: The `enqueueDocket` function in `packages/gateway/src/index.ts` now correctly spawns a background `processDocketLoop()` instead of synchronously dequeuing and processing the message in the same request. This is a genuine fix.

### 2. Fake Distributed Sync (Still Fake)
- **Status**: **Unfixed**
- **Details**: `syncWithPeer` in `packages/archive/src/sync.ts` was updated to actually fetch transitions from the remote peer via HTTP. However, it **never applies them to the local database**. It simply returns `diverged: true, fetched: range.length`. 

### 3. Fake CRDT Merge (Still Fake)
- **Status**: **Unfixed**
- **Details**: In `packages/server/src/index.ts`, when `syncWithPeer` returns `diverged: true`, the server still calls `mergeEdict(a, b)` with completely fake, hardcoded `EdictLike` objects (`{ id: 'local', ... }` and `{ id: 'remote', ... }`). The result of the merge is still completely ignored.

### 4. Fake PBFT Consensus (Still Fake)
- **Status**: **Unfixed**
- **Details**: The `PbftConsensus` class in `packages/consensus/src/index.ts` was updated to use real `@noble/ed25519` cryptography for signatures. However:
  - `onPrePrepare`, `onPrepare`, and `onCommit` just append the message to a local in-memory log and return `true`.
  - There are **no network endpoints** in the server to actually receive PBFT messages from other nodes.
  - Because no messages are ever received from peers, `commitIfThreshold` will never be met, meaning any message requiring PBFT consensus will be stuck in the `pending` state forever.

### 5. Fake Gossip Protocol (Still Fake)
- **Status**: **Unfixed**
- **Details**: `packages/server/src/index.ts` still instantiates the fake `InMemoryPlumtree`. When a seal is gossiped, it calls `wenyanPlumtree?.eagerPush(...)`, which returns an array of peer strings (`['peer-1', 'peer-2', ...]`), but the server does absolutely nothing with this array. No network requests are made.

### 6. Fake Audit Bundle Export (Still Fake)
- **Status**: **Unfixed**
- **Details**: `exportAuditBundle` in `packages/archive/src/sqlite.ts` still just returns raw `seal_0_log` rows and a simple `sha256` hash of the checkpoint object. It does not generate a Merkle proof or any cryptographically verifiable bundle.

### Conclusion
The PR author has attempted to hide the performative code by adding real cryptography (`@noble/ed25519`) and real HTTP fetches, but the core logic remains completely disconnected. The fetched data is discarded, the cryptographic signatures are never exchanged with peers, and the CRDT merges are still performed on hardcoded dummy objects.
