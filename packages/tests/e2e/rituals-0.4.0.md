# End-to-End Rituals for Wenyan v0.4.0 (The Consort Protocol)

These rituals verify the distributed consort properties: gossip propagation,
Byzantine fault tolerance, partition reconciliation, and Merkle synchronization.
All tests assume Docker Compose or local process orchestration with network
partitioning capabilities (toxiproxy, iptables, or test containers).

1. The Gossip Relay (Yichuan Propagation)
   Context: A petition is drafted in the remote province of Guangzhou. The
   imperial court in Beijing must receive the sealed memorial without direct
   connection—relayed through intermediate stations (Nanjing, Xi'an).

   Setup:
   - Four nodes: Beijing (leader), Nanjing, Xi'an, Guangzhou (linear topology)
   - Network: Guangzhou ↔ Nanjing ↔ Xi'an ↔ Beijing (Guangzhou cannot reach Beijing directly)
   
   Flow:
   - Guangzhou drafts petition, applies Seal 1 (Office)
   - Nanjing gossips to Xi'an; Xi'an gossips to Beijing
   - Beijing receives document with Seals 1-5 intact
   
   Assertions:
   - Beijing queries document within 2 seconds of Guangzhou submission
   - Seal chain cryptographically valid (hashes verify across hops)
   - Beijing applies Seal 6 (Imperial) and gossips back
   - Guangzhou receives confirmation within 2 seconds via reverse path
   - SQLite on Beijing contains document with full 6-seal chain

2. The Poisoned Courier (Byzantine Resistance)
   Context: A rebel general (Byzantine node) in the army attempts to forge an
   imperial edict lowering the salt tax. The edict appears validly sealed but
   the cryptographic signature is fraudulent.

   Setup:
   - 4-node PBFT cluster (f=1 tolerance): Beijing (leader), Nanjing, Xi'an, Chengdu (Byzantine)
   - Chengdu modified to generate invalid Seal 6 (wrong private key) on "tax_edict"
   
   Flow:
   - Chengdu proposes ti_definition change (lowering constitutional threshold)
   - Beijing (leader) receives pre-prepare, sends prepare to all
   - Nanjing and Xi'an verify Seal 6, detect invalid signature
   - Nanjing/Xi'an reject prepare; view-change initiated
   
   Assertions:
   - No node commits the fraudulent ti_definition (query returns undefined)
   - Chengdu is suspected via SWIM (heartbeat failure after rejection)
   - View-change elects new leader (Nanjing or Xi'an) within 5 seconds
   - Network continues processing legitimate documents with 3 remaining nodes
   - Chengdu's subsequent connection attempts rejected (Byzantine blacklist)

3. The Two Emperors (Partition & Reconciliation)
   Context: The empire splits. The Ming court holds Beijing; the rebel court
   holds Nanjing. Both issue conflicting routing edicts for "petition" genre.
   When the rebellion is quashed, the archives must reconcile without losing
   the valid petitions filed in both capitals.

   Setup:
   - 4 nodes: Beijing-A, Beijing-B (loyalist partition); Nanjing-A, Nanjing-B (rebel partition)
   - Network partition via iptables DROP between Beijing and Nanjing subnets
   - Duration: 30 seconds partition
   
   Flow (Partition Phase):
   - Beijing issues edict: route petitions to "grand_secretariat"
   - Nanjing issues edict (higher precedence=2): route petitions to "emperor_direct"
   - Both sides continue accepting documents (local Seal 1-5)
   - Both sides queue Seal 6 (Imperial) locally (cannot achieve PBFT quorum cross-partition)
   
   Flow (Heal Phase):
   - Remove iptables rules, network heals
   - SWIM detects partition end, triggers anti-entropy
   - Merkle root comparison detects divergence in edict branch
   - CRDT reconciliation: vector clock comparison shows Nanjing edict has higher precedence
   - Beijing adopts Nanjing routing rule (LWW merge)
   
   Assertions:
   - Post-heal, all 4 nodes query identical routing table (emperor_direct)
   - Both edicts exist in archive (Beijing's marked superseded_by Nanjing's)
   - Documents filed during partition in Beijing correctly routed post-reconciliation
   - No duplicate document IDs (idempotency via content hashing preserved)
   - Schism edict NOT created (reconciliation automatic via precedence)

4. The Empty Archive Join (Merkle Synchronization)
   Context: A new prefecture establishes a Wenyan node. The local magistrate
   must synchronize 10,000 archived documents from the capital without
   downloading the entire 10GB SQLite file—only the missing branches.

   Setup:
   - Beijing: 10,000 documents, full 6-seal chains (50MB SQLite)
   - NewNode: Empty Dang'an, joins via `wenyan --join gossip://beijing:7946`
   
   Flow:
   - NewNode requests Merkle root from Beijing
   - NewNode has empty tree; XOR distance = full root hash
   - Bisection: Request level 1 hashes (left/right children)
   - NewNode requests level 2, 3... until finding leaf divergence (all leaves missing)
   - Request only missing leaf nodes (document transitions) via content hash
   - Beijing streams only the 10,000 transition records (not full SQLite)
   
   Assertions:
   - Sync completes in <5 seconds (vs. 30+ seconds for full file copy)
   - Bandwidth usage <10MB (vs. 50MB for full SQLite)
   - NewNode Merkle root matches Beijing exactly (Blake3 hash identical)
   - NewNode can query any document by ID immediately post-sync
   - NewNode participates in gossip within 1 second of sync completion

5. The Urgent Dispatch (Imperial Broadcast)
   Context: Barbarians breach the Great Wall. The Emperor issues emergency
   protocol edict lowering quorum requirements for military dispatches.
   Every node must receive this within 500ms to coordinate defense.

   Setup:
   - 8-node cluster (Beijing capital + 7 provincial nodes)
   - Network: LAN latency (<1ms between nodes)
   - Load: Each node processing 100 req/s background traffic
   
   Flow:
   - Beijing archives protocol edict (law_type: protocol, content: {quorum: 1})
   - Triggers Imperial Broadcast (eager push to all 7 neighbors simultaneously)
   - Provincial nodes receive, validate Seal 6, apply immediately to law cache
   - Subsequent military dispatches processed with quorum=1
   
   Assertions:
   - All 7 nodes report edict receipt within 500ms (p95 latency)
   - Zero nodes miss the broadcast (100% delivery)
   - No conflicting edicts delivered (agreement property)
   - Military dispatch submitted 600ms after edict succeeds with single Seal 6
   - Background traffic uninterrupted (no head-of-line blocking)

6. The Fallen Capital (Leader Failure & View Change)
   Context: The Emperor dies suddenly (leader crash). The Grand Secretariat
   must elect a new leader without human intervention to continue constitutional
   amendments.

   Setup:
   - 4-node PBFT: Beijing (leader), Nanjing, Xi'an, Chengdu (all honest)
   - Kill Beijing process (SIGKILL) during active ti_definition amendment
   
   Flow:
   - Nanjing sends pre-prepare for new schema, Beijing dead (no response)
   - Nanjing/Xi'an/Chengdu timeout after 5 seconds (view-change timeout)
   - Remaining nodes exchange view-change messages
   - Nanjing elected new leader (smallest node_id among remaining)
   - New view established, amendment resumed from checkpoint
   
   Assertions:
   - No amendments committed during view change (safety)
   - New leader elected within 10 seconds total (liveness)
   - Partially prepared amendment from old view discarded (no commit)
   - Client retry submits to Nanjing, succeeds with new leader
   - SWIM marks Beijing as failed within 2 seconds of SIGKILL

7. The Schism Record (Irreconcilable Conflict)
   Context: Two constitutional amendments pass in different partitions with
   identical precedence levels and concurrent vector clocks. The system cannot
   automatically merge and must flag for human intervention.

   Setup:
   - Partition A (Beijing, Nanjing): Issues ti_definition v2.0.0 (precedence=10)
   - Partition B (Xi'an, Chengdu): Issues ti_definition v2.0.0 (precedence=10)
   - Same genre, same precedence, concurrent vector clocks {Beijing:1,Xi'an:1}
   
   Flow:
   - Heal partition, Merkle sync detects divergent constitutional roots
   - CRDT comparison shows concurrent write (neither dominates)
   - Arbitrary deterministic rule (lexicographic node_id) would pick Beijing
   - BUT constitutional amendments require explicit human authority
   - System creates schism record instead of auto-merging
   
   Assertions:
   - No automatic adoption of either v2.0.0 variant
   - New edict created with law_type: schism, payload: {conflict_a, conflict_b}
   - All nodes query current schema return v1.0.0 (last agreed version)
   - Human operator must issue resolution edict (law_type: resolution) manually
   - Resolution edict references schism record, selects variant A or B

8. The Byzantine Gossip Storm (Spam Resistance)
   Context: A compromised node (Byzantine) floods the network with 10,000
   invalid seal messages per second (DoS). Honest nodes must maintain
   availability and not propagate garbage.

   Setup:
   - 4 nodes: Nanjing, Xi'an, Chengdu (honest); Shanghai (Byzantine attacker)
   - Shanghai generates cryptographically invalid seals (random bytes)
   
   Flow:
   - Shanghai gossips invalid seals to Nanjing
   - Nanjing verifies signatures (cryptographic failure), drops immediately
   - Nanjing does not forward to Xi'an/Chengdu (no amplification)
   - SWIM suspects Shanghai after 3 consecutive invalid message bursts
   - Shanghai expelled from membership list
   
   Assertions:
   - Nanjing CPU usage <20% during attack (verification is cheap, O(1))
   - Xi'an/Chengdu receive zero invalid seals (no propagation)
   - Valid document throughput maintained at 100 req/s (no degradation)
   - Shanghai automatically blacklisted within 10 seconds
   - Archive contains zero invalid seal entries (rejected at gateway)

9. The Cascading Failure (Cascade Resistance)
   Context: The PBFT leader (Beijing) is slow (packet loss), causing view
   change to Nanjing, which is also slow, causing view change to Xi'an.
   The system must stabilize despite cascading timeouts.

   Setup:
   - 4 nodes: Beijing (lossy, 50% drop), Nanjing (lossy, 50% drop), Xi'an (healthy), Chengdu (healthy)
   - Submit constitutional amendment
   
   Flow:
   - Beijing elected leader, fails to respond (packet loss)
   - View change to Nanjing after timeout
   - Nanjing elected, also fails (packet loss)
   - View change to Xi'an
   - Xi'an healthy, completes amendment
   
   Assertions:
   - Amendment eventually commits (liveness despite failures)
   - Maximum 2 view changes (not infinite loop)
   - No duplicate amendments committed (safety preserved across views)
   - Total latency <30 seconds (vs. 5 seconds normal case)
   - Beijing and Nanjing recover post-amendment, sync via Merkle tree

Implementation Notes for Test Harness
-------------------------------------
- Use `docker-compose` with `toxiproxy` for network partition/latency injection
- Use `pkill -9 wenyan` for Byzantine/leader failure simulation
- Metric collection: Prometheus endpoint on each node for latency/throughput
- Determinism: Fix random seeds for Blake3 hashes in test mode to ensure
  reproducible Merkle root calculations