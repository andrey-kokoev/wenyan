# End-to-End Rituals for Wenyan v0.5.0 (The Foreign Bridge — Initiality Proof)

These rituals verify the universal property: any external message system (foreign court)
factors uniquely through Wenyan. Foreign memorials must lose their native vernacular
(headers, protocols, metadata) and be reconstituted solely from the six seals.

1. The Barbarian Tribute (NATS → Wenyan)
   Context: A distant province (NATS server) sends tribute via their native courier
   (subject: "tribute.gold", headers: X-Nats-Sequence, X-Nats-Time, custom-metadata).
   The Tongzheng Si (gateway) must accept the gold but reject the foreign ceremony.

   Setup:
   - Wenyan node with NATS bridge configured (subject: "tribute.*" → genre: "tribute")
   - NATS server with JetStream enabled
   
   Flow:
   - Publish NATS message:
     - Subject: "tribute.gold"
     - Headers: { "Nats-Sequence": "42", "Nats-Time": "2026-05-01...", "Barbarian-Chief": "Attila" }
     - Data: { "amount": 1000, "type": "gold" }
   - NATS bridge receives, extracts subject mapping
   - Applies IntoWenyan translation:
     - genre: "tribute" (from config mapping)
     - payload: { amount, type } (validated against Ti)
     - routing: { destination: ["imperial_treasury"] } (derived from subject pattern)
     - provenance: { foreign: "nats", attested: false } (marked as untrusted origin)
   - Drops headers: Nats-Sequence, Nats-Time, Barbarian-Chief (forgotten)
   - Submits to pipeline: Acquires Seal 1 (Office/Bridge), Seal 2 (Schema), etc.

   Assertions:
   - Wenyan document archived with exactly 6 seals
   - SQLite query: `SELECT payload FROM messages WHERE id = ?` returns ONLY amount/type
   - `SELECT metadata FROM messages` contains NO "Nats-Sequence" or "Barbarian-Chief"
   - Document state: "archived" within 2 seconds of NATS publish
   - Foreign_rejected table empty (valid payload accepted)

2. The Imperial Rescript (Wenyan → NATS)
   Context: The Emperor issues an edict modifying tribute requirements. The edict
   must reach the barbarian province in their native tongue (NATS subject), but
   carrying only the imperial authority (Seal 6), not Wenyan internal metadata.

   Setup:
   - Wenyan document archived: genre="edict", payload={ new_tax: 0.1 }, full 6 seals
   - NATS bridge configured for outbound (routing.foreign_system = "nats")
   
   Flow:
   - Wenyan gossip commits Seal 6 (Imperial) to local Dang'an
   - Bridge sync detects document with routing.foreign_system = "nats"
   - FromWenyan translation:
     - NATS subject: "edicts.tax" (derived from genre + routing table)
     - Headers: { "Wenyan-Seal-6-Hash": "abc123...", "Imperial-Authority": true } (proof of seal)
     - Data: { "new_tax": 0.1 } (payload only)
   - Drops: Wenyan internal fields (document_id, transition_hashes, actor internal IDs)
   - Publish to NATS

   Assertions:
   - NATS message received by subscriber within 1 second
   - Message headers contain ONLY Wenyan-Seal-6-Hash and Imperial-Authority
   - NO foreign headers from original tribute (from Ritual 1) present
   - Payload exactly matches Wenyan payload (no structural additions)
   - Information loss ratio > 0 (Wenyan internal metadata stripped)

3. The Concurrent Embassy (Conflict Resolution)
   Context: Both courts (Wenyan and Foreign) modify the same treaty simultaneously.
   The foreign minister updates terms in NATS; the Imperial Censor updates terms
   in Wenyan. The bridge must reconcile using vector clocks (v0.4.0), not last-write-wins.

   Setup:
   - Initial treaty document synced to both systems (state S0)
   - Network partition (simulated delay in bridge sync)
   
   Flow:
   - T0: Foreign system publishes update A (NATS subject: "treaty.terms")
   - T0: Wenyan archives update B (different content, same document reference)
   - Bridge detects partition heal, compares states:
     - Foreign: VC = { foreign: 1, wenyan: 0 }
     - Wenyan: VC = { foreign: 0, wenyan: 1 }
   - Detect concurrent (neither dominates)
   - Apply reconciliation strategy (LWW for this test):
     - If Wenyan timestamp > Foreign timestamp: Wenyan wins
     - Bridge publishes Wenyan version back to NATS (overwrites foreign)
   - Archive foreign_sync_state shows conflict_status: "resolved"

   Assertions:
   - Both systems eventually converge to identical state (eventual consistency)
   - Wenyan Dang'an contains document with vector clock { foreign: 1, wenyan: 1 } (merged)
   - Foreign system receives update reflecting Wenyan content (authority of Seal 6)
   - No infinite ping-pong (bridge detects sync loop and breaks)

4. The Quarantine (Untrusted Provenance)
   Context: A new barbarian tribe (unknown NATS publisher) sends tribute. The
   bridge operates in trust_provenance=false mode. The foreign message must be
   quarantined pending manual Seal 1 attestation.

   Setup:
   - Bridge config: trust_provenance = false
   - New NATS client ID (never seen before) publishes to "tribute.silver"
   
   Flow:
   - Bridge receives message from unknown publisher
   - IntoWenyan detects untrusted provenance (no prior attestation)
   - Instead of submitting to pipeline, writes to `foreign_quarantine` table:
     - foreign_id: NATS message sequence
     - payload: validated but unsealed
     - status: "pending_attestation"
   - CLI command: `wenyan bridge attest --foreign-id <id> --as genesis_admin`
     - Applies Seal 1 (Office) manually via CLI attestation
   - Document enters normal pipeline (Seals 2-6)

   Assertions:
   - Document NOT archived until manual attestation
   - Quarantine table entry exists with timestamp
   - After attestation, document acquires full 6 seals
   - Subsequent messages from same publisher auto-accepted (provenance cached)

5. The Kafka Partition Alignment (Ordering Guarantee)
   Context: Kafka guarantees ordering within partitions. Wenyan guarantees
   causality via Lamport clocks. The bridge must preserve causal ordering
   when translating Kafka → Wenyan.

   Setup:
   - Kafka topic "orders" with 3 partitions
   - Producer sends: Order A (partition 0), Order B (partition 0, depends on A), Order C (partition 1)
   
   Flow:
   - Bridge consumes Order A (offset 0, partition 0):
     - Assigns Lamport clock: 0
     - Archives with Seal 1
   - Bridge consumes Order B (offset 1, partition 0):
     - Detects causal dependency (business logic key: order_id)
     - Assigns Lamport clock: 1 (monotonic with partition)
     - Archives with Seal 1
   - Bridge consumes Order C (partition 1):
     - Concurrent with B (different partition), assigns Lamport clock: 1 or 2
     - Archives with Seal 1

   Assertions:
   - Query Wenyan by Lamport clock: Order A (0) precedes Order B (1)
   - Kafka offsets preserved in foreign_sync_state table
   - Exactly-once semantics: Duplicate Kafka delivery (retry) results in duplicate detection via idempotency key (Kafka offset), single Wenyan document
   - No ordering inversions: If Kafka offset_A < offset_B (same partition), Wenyan Lamport_A < Lamport_B guaranteed

6. The Information Forgetting Verification (Initiality Proof)
   Context: Demonstrate the categorical property ∀S ∈ MsgSys, ∃! morphism S → Wenyan.
   This requires proving that foreign structure is lost and cannot be recovered
   from Wenyan archive (no embedding of foreign protocol in output).

   Setup:
   - NATS message with maximum metadata: 20 custom headers, reply-to, sequence, timestamp, subject hierarchy
   - Bridge configured with strict mapping (only 3 fields extracted)
   
   Flow:
   - Calculate input entropy: Size of NATS message in bytes (including all headers)
   - Process through IntoWenyan
   - Calculate output entropy: Size of archived Wenyan document (payload + mapped routing only)
   
   Assertions:
   - Output bytes < Input bytes * 0.7 (30% information loss minimum)
   - SQLite query for original headers returns NULL (not stored in any table)
   - Attempting to reconstruct original NATS message from Wenyan document fails
     (missing headers cannot be recovered)
   - This proves "forgetting": The morphism is not injective (many foreign messages
     map to one Wenyan structure), satisfying the universal property that Wenyan
     is initial (minimal structure).

7. The Circuit Breaker (Foreign System Failure)
   Context: The foreign province (Kafka cluster) is conquered (network partition).
   The bridge must queue outbound messages and not lose Wenyan documents.

   Setup:
   - Wenyan archives 100 documents requiring sync to Kafka
   - Network partition: Drop all packets to Kafka brokers (iptables DROP)
   
   Flow:
   - Bridge detects Kafka unreachable (connection timeout)
   - Opens circuit breaker (state: OPEN)
   - Writes documents to SQLite `bridge_outbound_queue`:
     - document_id, target_protocol, target_topic, retry_count, next_retry_at
   - Continues archiving Wenyan documents locally (no blocking)
   - After 30 seconds, restore network
   - Circuit breaker enters HALF-OPEN, attempts retry
   - Drains queue in order (respecting Lamport clocks)

   Assertions:
   - All 100 documents eventually published to Kafka
   - Ordering preserved (Lamport order == Kafka record order)
   - No documents lost during partition (queue durable in SQLite)
   - Retry backoff exponential (not hammering dead cluster)
   - Metrics: bridge_outbound_queue_depth = 0 after recovery

8. The MQTT Retained Message Sync (State Replay)
   Context: MQTT supports retained messages (last-known state on subscribe).
   Wenyan Dang'an is the source of truth for retained state.

   Setup:
   - MQTT topic "sensors/temperature" with retain flag
   - Wenyan archives 3 historical readings, then new reading T=25C
   
   Flow:
   - Bridge publishes T=25C to MQTT with retain=true
   - New MQTT subscriber connects, immediately receives T=25C (retained)
   - Query Wenyan Dang'an for "last known temperature":
     - Bridge queries archive: SELECT * FROM messages WHERE genre='iot_reading' ORDER BY sealed_at DESC LIMIT 1
     - Returns T=25C document
   - Verify consistency: Retained message == Wenyan latest document

   Assertions:
   - MQTT retained payload matches Wenyan Seal 6 document payload exactly
   - If Wenyan document updated (new seal), MQTT retained message updated within 1 second
   - If MQTT broker restarted, retains correct value from Wenyan sync (no divergence)
   - QoS 1: At-least-once delivery verified (no message loss on reconnect)

9. The Schism Bridge (Irreconcilable Foreign Conflict)
   Context: Foreign system (NATS) has strong consistency (immediate); Wenyan has
   eventual consistency (gossip delay). Both claim authority over routing table.
   Neither vector clock dominates; schism must be declared.

   Setup:
   - NATS publishes routing update (destination: "old_cabinet") at T0
   - Wenyan publishes routing edict (destination: "new_cabinet") at T0 (concurrent)
   - Bridge detects concurrent write, different content, same precedence
   
   Flow:
   - Bridge cannot merge (routing tables are not CRDT-mergeable without semantic knowledge)
   - Creates Wenyan document:
     - genre: "edict"
     - law_type: "schism"
     - payload: { conflict_type: "foreign_nats", foreign_state: "old_cabinet", wenyan_state: "new_cabinet" }
   - Applies full 6 seals (authorized by bridge admin)
   - Archives as resolution-required
   - Halts sync for this routing key until manual edict issued

   Assertions:
   - Foreign system retains "old_cabinet" (not overwritten)
   - Wenyan retains "new_cabinet" (not overwritten)
   - Schism edict exists in Dang'an with both states documented
   - Bridge pauses (does not ping-pong between states)
   - Manual intervention: Admin issues resolution edict selecting one, bridge resumes

Implementation Notes
--------------------
- Use `docker-compose` with NATS, Kafka (Confluent), Mosquitto (MQTT) containers
- Use `toxiproxy` for network partition simulation (latency, drop, bandwidth)
- Foreign system clients: Use official NATS.js, KafkaJS, MQTT.js libraries
- Verification queries: Use `wenyan query` CLI and direct SQLite SELECT to verify
  information loss (no foreign headers in archive)