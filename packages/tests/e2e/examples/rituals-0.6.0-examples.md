--- e2e/rituals-v0.6.0-examples.md ---

End-to-End Rituals for Wenyan v0.6.0 Examples (Toy Pressure Tests)

These rituals verify the three example applications demonstrate Wenyan's
practical utility across collaboration, security, and IoT domains.

1. The Constitutional Amendment (Distributed Todo - Schema Evolution)
   Context: A 4-person dev team (Alice, Bob, Carol, Dave) has been using Wenyan
   todo for 3 months. They need to add a "priority" field to tasks. This requires
   constitutional amendment (ti_definition change), not just a code update.

   Setup:
   - 4 Wenyan nodes (Alice-leader, Bob, Carol, Dave) in Docker Compose
   - Initial state: 50 tasks created under v1 schema (title, assignee, done)
   - Network: Fully connected, no partitions initially
   
   Flow:
   - Alice drafts ti_definition v2.0: adds "priority" enum (low/medium/high)
   - Alice applies Seal 1 (Office), submits to consort
   - Bob reviews (Seal 2-5), notices schema validation passes
   - Constitutional barrier: Requires 3-of-4 PBFT approval for ti_definition
   - Carol approves (Seal 6 partial), Dave initially rejects (wants review)
   - After discussion, Dave approves (Seal 6 partial), threshold met (3)
   - Schema v2.0 archived as constitutional law
   
   - Alice creates new task with priority: "high"
   - Bob creates task without priority field (backward compat test)
   
   Assertions:
   - New task validates against v2.0 schema (priority present)
   - Old task (v1.0) still queryable, returns without priority field
   - Query `wenyan audit trace --document <new-task>` shows it used v2.0 Ti
   - Dave's initial rejection logged but superseded by later approval
   - During PBFT pending state (2 approvals), new tasks still use v1.0 (no blocking)

2. The Offline Sprint (Distributed Todo - CRDT Reconciliation)
   Context: The team goes on a retreat with spotty WiFi. Alice and Bob work
   offline, both assigning the same critical bug to different people.

   Setup:
   - 4 nodes, fully synced initially with shared task #100 "Fix login bug"
   - Network partition: Alice and Bob isolated from Carol, Dave, and each other
   - Duration: 30 minutes offline work
   
   Flow:
   - Alice (offline): Assigns task #100 to Carol, applies Seals 1-5 locally
   - Bob (offline): Assigns task #100 to Dave, applies Seals 1-5 locally
   - Both queue Seal 6 (Imperial) locally (cannot achieve quorum offline)
   - Carol (online): Creates 5 new tasks under v2.0 schema (works fine with 2 nodes)
   
   - Network heals (retreat WiFi returns)
   - Gossip anti-entropy detects divergent Merkle roots for task #100
   - CRDT reconciliation: Vector clocks show concurrent edits (neither dominates)
   - Resolution: LWW (Last-Write-Wins) based on Lamport timestamp—Bob's assignment wins (later timestamp)
   - Alice's assignment preserved as superseded transition in Dang'an
   
   Assertions:
   - Final assignee is Dave (Bob's choice won)
   - Both assignments exist in archive (Alice's not lost, marked superseded)
   - No data loss: Carol's 5 tasks also present after sync
   - Automatic resolution within 5 seconds of partition heal
   - CLI shows warning: "Concurrent edit detected, resolved via LWW"

3. The Compromised Teen (Family Treasury - Byzantine Detection)
   Context: The Johnson family treasury (Mom, Dad, Teen1, Teen2) detects that
   Teen1's laptop was stolen. The thief has the private key and tries to drain
   the savings.

   Setup:
   - 4-node treasury consort (f=1 Byzantine tolerance)
   - Anomaly rules: velocity_threshold=3 (max 3 proposals/minute)
   - Balance: $5000 savings, $200 allowance pool
   - Teen1's key compromised (simulated via script)
   
   Flow:
   - Normal operation: Teen2 proposes $50 game purchase (approved by Mom, valid)
   - Attack begins: Compromised Teen1 key submits 50 "withdrawal" proposals rapidly
     - Proposal 1: $1000 to "BitcoinExchange" (Seal 1 applied)
     - Proposal 2: $1000 to "GiftCardResale" (Seal 1 applied)
     - Proposal 3: $1000 to "SuspiciousVendor" (Seal 1 applied) → Threshold hit
   - Censorate detects velocity anomaly (3 proposals in 10 seconds)
   - Auto-quarantine: Teen1's actor status set to "quarantined"
   - Proposal 4-50: Rejected immediately with "actor_quarantined"
   - Alert generated: severity=critical, pattern=velocity_violation, actor=teen1
   
   - Family investigation: Mom runs audit
     - `treasury audit who-proposed --limit 50` shows all 50 attempts logged
     - First 3 have Seal 1 valid (before quarantine), rest rejected
     - Geographic analysis: Last 47 proposals from IP 45.33.x.x (not home network)
   
   Assertions:
   - Exactly 0 funds transferred to attackers (all proposals blocked or pending)
   - Teen1's legitimate earlier transactions remain valid (no retroactive invalidation)
   - Quarantine persisted across node restarts (archived in Dang'an)
   - Alert notification sent to Mom and Dad (webhook/email)
   - Recovery: Mom issues manual "unquarantine" edict after key rotation ceremony

4. The Impossible Allowance (Family Treasury - Geographic Impossibility)
   Context: Teen2 tries to game the system by sharing their key with a friend
   across the country to "double spend" allowance.

   Setup:
   - Teen2 legitimately at school (GPS/metadata: Seattle, 09:00 AM)
   - Teen2's key used simultaneously from New York by friend (GPS: NYC, 09:00 AM EST)
   - Geographic distance: 2400 miles, impossible travel time < 1 hour
   
   Flow:
   - Seattle: Teen2 proposes $20 lunch money (Seal 1, timestamp T, location Seattle)
   - NYC: Friend proposes $30 "books" (Seal 1, timestamp T+1min, location NYC)
   - Distance calculation: 2400 miles / 1 minute = impossible speed (>> sound speed)
   - Anomaly detector flags geographic_impossibility
   - Second proposal quarantined immediately
   - Alert: "Cloned key detected - simultaneous use in Seattle and NYC"
   
   Assertions:
   - Seattle proposal accepted (legitimate use)
   - NYC proposal rejected before entering pipeline (saved from embarrassment)
   - Teen2's key NOT fully quarantined (only suspicious use blocked)
   - Audit log shows both attempts with location metadata
   - Family can investigate: "Teen2, why did your key sign from New York?"

5. The Monthly Audit (Family Treasury - Merkle Verification)
   Context: The family accountant reviews May 2026 expenses to verify no
   unauthorized withdrawals occurred.

   Setup:
   - 150 transactions archived in May (allowances, savings deposits, parent approvals)
   - 3 constitutional amendments (allowance rate changes) with full PBFT consensus
   
   Flow:
   - Mom runs: `treasury audit-export --month 2026-05 --format json`
   - System exports:
     - All 150 transactions with full seal chains
     - 3 constitutional amendment documents
     - Signed Merkle root: hashxyz123 (signed by 2f+1 nodes: Mom, Dad, Teen1)
   - Accountant verifies:
     - Computes Blake3 of all transaction hashes → matches Merkle root
     - Verifies 2f+1 signatures on checkpoint using public keys
     - Confirms no transactions omitted (Merkle proof of inclusion for random sample)
   
   Assertions:
   - Export completes in <2 seconds (Merkle verification O(log n))
   - Any single altered byte in transaction causes Merkle verification failure
   - Checkpoint signature cryptographically proves Mom, Dad, Teen1 all agreed on state
   - Accountant can verify WITHOUT access to SQLite files (just the export JSON)

6. The Sensor Flood (Smart Greenhouse - Foreign Bridge & Throughput)
   Context: A heat wave hits. 100 sensors report temperature spikes every second.
   The MQTT bridge must handle the flood without dropping messages or losing
   sensor metadata (while still stripping protocol headers).

   Setup:
   - 100 simulated MQTT sensors (mosquitto_pub in loop)
   - Topic pattern: greenhouse/zone-{a,b,c}/sensor-{001..100}
   - Payload: { temp: 45.2, humidity: 80, soil_ph: 6.5 } (v2 schema)
   - MQTT headers: QoS, Retain, ClientID, etc. (should be stripped)
   - Duration: 5 minutes = 30,000 messages
   
   Flow:
   - Sensors publish to Mosquitto MQTT broker
   - Wenyan bridge subscribes, applies IntoWenyan translation:
     - Extracts: temp, humidity, soil_ph → payload
     - Extracts: topic → routing.destination (zone-a, zone-b, zone-c)
     - Drops: QoS flags, Retain bit, ClientID, MQTT protocol metadata
   - Documents enter pipeline: Seal 1 (Office/Bridge), Seals 2-6 via consort
   - Archive write: 30,000 documents committed to SQLite with full seal chains
   
   Assertions:
   - All 30,000 documents archived (no loss)
   - Information loss ratio > 30% (MQTT headers stripped, Wenyan structure smaller)
   - Average latency < 100ms (end-to-end: MQTT publish → Wenyan archived)
   - Query `SELECT COUNT(*) FROM messages WHERE genre='sensor_reading'` returns 30000
   - No MQTT metadata present in Dang'an (verify: `SELECT payload FROM ...` has no QoS field)

7. The Firmware Upgrade (Smart Greenhouse - Schema Evolution)
   Context: After 6 months, sensors upgrade to firmware v3 adding "light_lux" field.
   Old v2 sensors still operate. Both must coexist.

   Setup:
   - Archive: 10,000 v2 readings (temp, humidity, soil_ph) from Jan-May
   - Day 1 of June: Deploy ti_definition v3.0 adding "light_lux" (optional field)
   
   Flow:
   - Constitutional amendment: Add v3.0 schema (requires PBFT consensus, passes)
   - New sensors (60 units) start sending v3 data with light_lux
   - Old sensors (40 units) continue sending v2 data (no light_lux field)
   
   - Wenyan pipeline behavior:
     - v2 payloads: Validated against v2.0 schema (backward compatibility), archived with schema_version="2.0"
     - v3 payloads: Validated against v3.0 schema, archived with schema_version="3.0"
   
   - Query: "Average light_lux in June"
     - Returns average of 60 sensors (v2 readings return NULL for light_lux, excluded from average)
   
   Assertions:
   - v2 and v3 documents coexist in same archive table
   - Query `wenyan query --schema-version 2.0` returns exactly 10,000 pre-June docs
   - Query `wenyan query --schema-version 3.0` returns only post-June docs with light_lux
   - Ti v3.0 marked as superseding v2.0, but v2.0 retained for historical validation
   - No rejection of v2 data (graceful degradation, not forced upgrade)

8. The Historical Climate Query (Smart Greenhouse - Temporal Accuracy)
   Context: An agricultural inspector asks: "What was the temperature in Zone A
   at exactly 2:30 PM on March 15th during the frost event?"

   Setup:
   - Archive: 500k sensor readings over 6 months (Qiankan migrated old data to S3)
   - Target: Specific timestamp 2026-03-15T14:30:00Z
   
   Flow:
   - User runs: `greenhouse query --zone a --field temp --at "2026-03-15T14:30:00Z"`
   - System:
     - Determines which schema was active at that time (v1.0, pre-priority)
     - Queries archive: finds transition just before 14:30:00Z
     - Retrieves document from S3 cold storage (transparently)
     - Returns exact value: 2.5°C
   
   Assertions:
   - Query completes in <500ms despite 500k total archive (indexing effective)
   - Value returned is exactly 2.5°C (not interpolated, not latest, not averaged)
   - Seal chain returned showing which sensor device signed the reading
   - No data loss despite cold storage migration (Merkle proof verifies integrity)

9. The Qiankan Cold Migration (Smart Greenhouse - Archive Hygiene)
   Context: The SQLite file grows to 50GB. Old sensor data (>90 days) must move
   to S3 cold storage while maintaining cryptographic verifiability.

   Setup:
   - Archive: 1 million sensor readings (45GB SQLite)
   - Policy: Move readings >90 days old to S3 Parquet format
   
   Flow:
   - Automated job runs: `greenhouse archive-cold --before 2026-03-01`
   - System:
     - Scans messages table for old sensor_reading documents
     - Extracts payload + seal hashes + Merkle paths
     - Writes to S3: s3://wenyan-cold/greenhouse/2026-Q1/xyz.parquet
     - Keeps Merkle root and index in hot SQLite (few KB)
     - Deletes old rows from SQLite (WAL reclaim)
   
   - Query old data: `greenhouse query --date 2026-02-01`
     - System detects data not in hot SQLite
     - Fetches from S3 using content hash
     - Verifies Merkle proof against stored root
     - Returns data transparently to user
   
   Assertions:
   - SQLite size drops to <5GB (90% reduction)
   - Query for February 2026 data still works (transparent fetch from S3)
   - Merkle verification passes (no corruption during migration)
   - Cold storage query latency <2s (acceptable for archival data)
   - Hot storage (last 90 days) queries remain <100ms

Implementation Notes for CI/CD
-------------------------------
- Run all 9 rituals in sequence via GitHub Actions using Docker Compose
- Rituals 1-2: Distributed Todo (focus on constitutional/CRDT)
- Rituals 3-5: Family Treasury (focus on Byzantine/audit)
- Rituals 6-9: Smart Greenhouse (focus on bridge/scale/temporal)
- Each ritual must complete in <60 seconds (except Ritual 9 which may take 2min for migration)
- Failure of any ritual blocks release (examples are integration tests)
- Artifacts: Export Merkle checkpoints from each example for manual verification