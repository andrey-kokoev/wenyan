--- AGENT_INSTRUCTIONS_EXAMPLES.md ---

Implementation Guide: Three Toy Pressure Tests for Wenyan v0.6.0

Objective: Implement three complete, runnable example applications demonstrating
Wenyan's practical utility across collaboration, security, and IoT domains.
These serve as both integration tests and demonstration vehicles.

Directory Structure
-------------------
examples/
├── distributed-todo/          # Example 1: Constitutional schema evolution
├── family-treasury/           # Example 2: Byzantine fault tolerance
└── smart-greenhouse/          # Example 3: Foreign bridge & temporal queries

All examples use the published @wenyan/* packages from GitHub Packages.

================================================================================
EXAMPLE 1: The Distributed Todo List (Constitutional vs. Legislative)
================================================================================

Overview:
A CLI-based todo manager for 4 team members (Alice, Bob, Carol, Dave) with
laptops that go offline. Demonstrates schema evolution (adding "priority" field)
as constitutional amendment vs. daily tasks as legislative.

1. Setup Directory Structure
----------------------------
examples/distributed-todo/
├── docker-compose.yml         # 4 Wenyan nodes + NATS for sync
├── package.json
├── src/
│   ├── cli.ts                # Main CLI interface
│   ├── schema/
│   │   ├── task-v1.json      # Initial Ti: title, assignee, done
│   │   └── task-v2.json      # Constitutional amendment: +priority
│   └── config/
│       ├── alice.toml
│       ├── bob.toml
│       ├── carol.toml
│       └── dave.toml

2. Configuration (alice.toml example)
-------------------------------------
[genesis]
node_id = "alice-node-uuid"
genesis_key = "alice-ed25519-private"

[archive]
engine = "sqlite"
path = "./alice-dangan.db"

[gateway]
listen = { host = "0.0.0.0", port = 8080 }

[consensus]  # Constitutional amendment requires 3-of-4
kind = "pbft"
replica_set = ["alice-node-uuid", "bob-node-uuid", "carol-node-uuid", "dave-node-uuid"]
constitutional_threshold = 3

[gossip]
seeds = ["bob:7946", "carol:7946"]

[bridge]  # For mobile sync (optional)
enabled = true
protocol = "nats"
url = "nats://localhost:4222"

3. Implementation (src/cli.ts)
------------------------------
Key commands to implement:

# Initialize with schema v1.0 (genesis)
$ todo init --node alice
# Auto-creates ti_definition for "task" genre with v1 schema

# Create task (legislative - 1 seal)
$ todo create --title "Fix bug" --assignee bob
# Drafts document, applies Seal 1 (Office/Alice), submits to pipeline
# Bob receives via gossip, applies Seal 2 (Review), etc.

# Constitutional amendment (3-of-4 seals required)
$ todo amend-constitution --schema ./schema/task-v2.json
# Creates ti_definition document with target_genre="task"
# Requires PBFT consensus (3 nodes must approve via CLI)
# Alice proposes, Bob & Carol approve, Dave opposes (still passes with 3)

# Offline mode
$ todo create --offline --title "Urgent task"
# Queues locally with Seals 1-5, waits for connectivity to apply Seal 6

# Conflict resolution (CRDT)
# When Alice and Bob both assign the same task to different people offline:
$ todo sync
# Detects concurrent edits via vector clocks
# Merges via LWW (last timestamp wins) or creates schism record

# Audit trail
$ todo audit --task-id <uuid>
# Shows Seal 0 (who viewed), Seals 1-6 (who modified), full trace

4. Testing Rituals
------------------
- Test constitutional barrier: Try to add "priority" field without 3 approvals
  → Should remain pending in PBFT until threshold met
  
- Test offline sync: Disconnect Alice, create 5 tasks, reconnect
  → All 5 should appear on other nodes with correct Lamport ordering
  
- Test CRDT merge: Simultaneous edit on Alice (assign:carol) and Bob (assign:dave)
  → Query should show one winner (LWW), other in superseded chain
  
- Test schema version: Query old tasks (created under v1) after v2 amendment
  → Should return v1 structure (no priority field), marked with schema_version

================================================================================
EXAMPLE 2: The Multi-Sig Family Treasury (Byzantine Fault Tolerance)
================================================================================

Overview:
A 4-member family (Mom, Dad, Teen1, Teen2) managing allowance and savings.
Demonstrates Byzantine detection when Teen1 is compromised and tries to drain
the wallet.

1. Setup Directory Structure
----------------------------
examples/family-treasury/
├── docker-compose.yml         # 4 nodes with network partition simulation
├── package.json
├── src/
│   ├── treasury.ts            # Main logic
│   ├── schema/
│   │   ├── spend-proposal.json    # Genre: spend_request
│   │   └── allowance-rule.json    # Genre: allowance (edict)
│   └── config/
│       ├── mom.toml           # Imperial authority (high threshold)
│       ├── dad.toml
│       ├── teen1.toml         # Byzantine node (compromised)
│       └── teen2.toml

2. Key Features to Implement
----------------------------
# Spending threshold (constitutional)
[actors.roles.parent]
can_authorize = true
imperial_threshold = 2  # Requires 2 parents for >$100

[actors.roles.teen]
can_authorize = false   # Can only propose (Seal 1), not approve (Seal 6)

# Anomaly detection rules (Censorate)
[censorate.rules]
velocity_threshold = 3  # Max 3 proposals/minute (Teen1 tries 50)
cabal_detection = true  # Detect if Teen1 colludes with external account

3. Implementation Scenarios
---------------------------
Scenario A: Normal Allowance
$ treasury propose --from teen1 --to "GameStore" --amount 50 --reason "Game"
# Teen1 applies Seal 1 (Office)
# Mom reviews (Seal 2-5), Dad applies Seal 6 (Imperial, 1-of-2 threshold for <$100)
# Funds "transferred" (mock), archived with 6 seals

Scenario B: Byzantine Attack (Compromised Teen1)
$ treasury attack-simulate --compromised-key teen1 --attempts 50 --amount 1000
# Teen1's stolen key tries to authorize 50 withdrawals rapidly
# Anomaly detector triggers on velocity (3rd attempt)
# Auto-quarantines teen1's key (status: quarantined)
# Subsequent attempts rejected with "actor_quarantined"

Scenario C: Geographic Impossibility
# Teen1 physically at school (GPS/seal metadata), cloned key used from home
# Second seal appears with impossible travel time
# Anomaly: geographic_impossibility detected
# Both parents receive alert, manual verification required

Scenario D: Monthly Audit
$ treasury audit-export --month 2026-05 --format pdf
# Exports Merkle root and all transactions
# Parents verify: Blake3(proposals) == checkpoint.merkle_root
# Proves no funds moved without 2-parent authorization

4. Testing Rituals
------------------
- Verify PBFT for large transfers: Propose $500 (requires 2 parents)
  → Should not complete with only Mom's seal; waits for Dad
  
- Verify Byzantine detection: Run attack simulation
  → Teen1 quarantined after 3 attempts, alerts logged in censorate_alerts
  
- Verify partition tolerance: Disconnect Mom, Dad approves with Teen2 (offline mode)
  → When reconnected, reconciliation shows approved state
  
- Verify Merkle proof: Export checkpoint, corrupt one transaction in SQLite
  → Merkle verification fails, detecting tampering

================================================================================
EXAMPLE 3: The Smart Greenhouse (Foreign Bridge & Temporal Queries)
================================================================================

Overview:
100 IoT sensors (simulated via MQTT) report to Wenyan. Tests foreign bridge
information loss, high-volume archiving, and schema evolution (firmware upgrade).

1. Setup Directory Structure
----------------------------
examples/smart-greenhouse/
├── docker-compose.yml         # Wenyan node + Mosquitto MQTT + Grafana
├── package.json
├── src/
│   ├── sensor-bridge.ts       # MQTT → Wenyan bridge
│   ├── analytics.ts           # Temporal query interface
│   ├── schema/
│   │   ├── sensor-v1.json     # temp, humidity
│   │   └── sensor-v2.json     # adds soil_ph
│   └── simulator/
│       └── sensor-fleet.ts    # Simulates 100 MQTT clients

2. Configuration
----------------
# Bridge configuration (wenyan.toml)
[[bridge.adapters]]
protocol = "mqtt"
url = "mqtt://mosquitto:1883"
topics = ["greenhouse/+/data"]
target_genre = "sensor_reading"
trust_provenance = false  # All sensor reads require Seal 0 attestation

[censorate]
seal0_required = true  # Audit who queried what sensor data

3. Implementation Features
--------------------------
Sensor Simulation:
$ greenhouse simulate --sensors 100 --interval 1000ms --duration 1h
# Publishes MQTT messages:
# Topic: greenhouse/zone-a/temp
# Payload: { temp: 22.5, humidity: 60, device_id: "sensor-001" }
# Headers: MQTT QoS, retain flag, etc.

Bridge Translation (IntoWenyan):
- Drops: MQTT topic hierarchy (converted to routing.destination), QoS flags, retain bit
- Keeps: temp, humidity (v1) or temp, humidity, soil_ph (v2)
- Result: Information loss ratio ~40% (headers stripped)

Temporal Queries:
$ greenhouse query --sensor "zone-a" --field "temp" --time "2026-06-01T15:00:00Z"
# Uses stateAt() to reconstruct exact temperature at specific time
# Returns: { value: 24.2, seal_chain: [...], certainty: "archived" }

Schema Evolution:
# After 30 days, sensors upgrade to firmware v2 (adds soil_ph)
$ greenhouse amend-schema --file schema/sensor-v2.json
# Creates new ti_definition with superseded_by pointing to v1
# Bridge accepts both formats: v1 sensors continue working, v2 sensors use new fields
# Archive stores both schemas, documents tagged with schema_version

Cold Storage (Qiankan):
$ greenhouse archive-cold --before 2026-05-01 --destination s3://wenyan-cold/
# Moves old sensor readings to S3 Parquet
# Keeps Merkle root in hot SQLite for verification
# Query old data: transparently fetches from S3 with Merkle proof check

4. Testing Rituals
------------------
- Verify information loss: Capture MQTT packet (150 bytes), check Wenyan archive (90 bytes)
  → Ratio >0.4, headers absent from Dang'an
  
- Verify temporal accuracy: Insert specific reading at T=0, query at T=0 with stateAt
  → Returns exact value, not interpolated or latest
  
- Verify schema versioning: Send v1 reading after v2 schema enacted
  → Accepted, archived with schema_version="1.0", validated against v1 schema
  
- Verify high volume: Run 100 sensors × 1s interval for 1 hour = 360k documents
  → SQLite WAL handles write load, Merkle root updates every 1000 documents
  → Qiankan migrates to S3 automatically when threshold met
  
- Verify audit trail: Query "who accessed zone-b data?"
  → Returns Seal 0 entries showing analytics service (or human operator) access times

================================================================================
SHARED INFRASTRUCTURE & TESTING
================================================================================

1. Docker Compose Setup
-----------------------
Each example includes:
- Wenyan nodes (based on ghcr.io/.../wenyan:latest)
- Required infrastructure (NATS, Mosquitto, SQLite browser)
- Network partition simulation (toxiproxy or iptables sidecar)

2. Package.json Template
------------------------
{
  "name": "@wenyan/examples-[name]",
  "version": "0.6.0",
  "dependencies": {
    "@wenyan/core": "^0.6.0",
    "@wenyan/gossip": "^0.6.0",
    "@wenyan/bridge": "^0.6.0",
    "@wenyan/censorate": "^0.6.0",
    "commander": "^11.0.0",  // For CLI
    "chalk": "^5.0.0"        // For pretty output
  },
  "scripts": {
    "start": "tsx src/cli.ts",
    "test": "vitest run",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down -v"
  }
}

3. Verification Checklist
-------------------------
Each example must:
[ ] Build without errors (pnpm typecheck)
[ ] Run full scenario without manual intervention (pnpm test:e2e)
[ ] Demonstrate at least one Byzantine failure mode (where applicable)
[ ] Show information loss metrics (where applicable)
[ ] Generate Merkle checkpoint that verifies externally
[ ] Include README with architecture diagram (Mermaid)

4. Documentation Output
-----------------------
Each example README must include:
- Purpose (what Wenyan feature it demonstrates)
- Prerequisites (Docker, pnpm)
- Quick start (3 commands to run)
- Architecture diagram (Mermaid sequence or component)
- Expected output (what success looks like)
- Troubleshooting (common failures)

Deliverables
------------
1. Three complete example directories under examples/
2. Integration tests in packages/tests/e2e/examples/ verifying all three
3. Video/GIF demo (optional but recommended) showing:
   - Todo: Constitutional amendment passing with 3 CLI signatures
   - Treasury: Byzantine attack being quarantined in real-time
   - Greenhouse: Sensor data flowing through bridge with header stripping

Acceptance Criteria
-------------------
- [ ] All three examples run independently via docker-compose up
- [ ] Examples demonstrate v0.6.0 features: PBFT, CRDT, Bridge, Censorate, Qiankan
- [ ] No hardcoded secrets (genesis keys generated per-run or via env vars)
- [ ] Clean shutdown leaves Merkle-verifiable archives (no corruption)
- [ ] CI pipeline includes examples:test job running all three scenarios