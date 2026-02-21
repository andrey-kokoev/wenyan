# Wenyan v0.3.0 E2E Test Plan: Constitutional Stratification

1. The Void (Empty Wenyan)
   - wenyan --init ./empty-node
   - Submit any document → Expect 503 "Schema Undefined" (not 201, not 500)
   - Verify SQLite has zero rows in messages table
   - Verify node boots and responds to health checks despite emptiness

2. The Genesis Event
   - Execute wenyan genesis apply --key-file ./genesis.pem
   - Verify exactly 2 documents archived with constitutional=true
   - Verify ti_definition document has 1 seal (genesis exception)
   - Verify subsequent regular submissions succeed

3. The Constitutional Barrier
   - Draft ti_definition (new genre) with single Seal 6
   - Submit → Expect 403 "Insufficient Imperial Authority"
   - Apply 3 distinct imperial seals → Expect 201
   - Verify constitutional flag true, superseded_by null

4. The Legislative Boundary
   - Draft edict referencing undefined genre "phantom"
   - Pipeline → Expect state "feiwen", rejection reason "invalid-constitutional-reference"
   - Verify document archived (not rejected at gateway) but marked void

5. The Temporal Snapshot
   - Submit document A (triggers under protocol v1)
   - Immediately archive protocol edict changing required_acks from 2→1
   - Submit document B (triggers under protocol v2)
   - Verify A's transition uses quorum 2, B's uses quorum 1
   - Query stateAt(A.id, now) shows complete with old rules

6. The Merkle Genesis
   - Node A: genesis apply
   - Node B: --join tcp://A:8080
   - Verify B's logs: "Constitutional sync complete, Merkle root: abc123..."
   - Verify B rejects submission of undefined genre (has Ti definitions now)
   - Corrupt B's SQLite manually → Restart join → Verify rejection with root mismatch

7. The Package Separation
   - Build Docker image with only @andrey-kokoev/wenyan-core (no genesis package)
   - Verify node starts, responds 503 to all submissions
   - Mount genesis package → Verify genesis apply works
   - Verify core does not import genesis (static analysis check)

8. The Strict Mode Failure
   - Start node with corrupt archive (foreign key violations)
   - Verify immediate exit with error (no in-memory fallback)
   - Verify error message: "Dang'an integrity failure, refusing to degrade"