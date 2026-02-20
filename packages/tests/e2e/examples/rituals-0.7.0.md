End-to-End Rituals for Wenyan v0.7.0 (Imperial Works — The Capstone)

These rituals verify the 4-tier hierarchical construction bureaucracy under
Byzantine corruption, network partition, and emergency conditions.

1. The Forbidden Blueprint (Constitutional Amendment)
   Context: The Emperor decides the palace needs a larger courtyard—requires 
   changing the structural Ti (load-bearing calculations). This is constitutional 
   law, not a daily work order.

   Setup:
   - 8 nodes: Emperor, Minister_Works, Minister_Finance, Censor_Chief, 
     3 Foremen, 1 Worker
   - Initial state: Palace v1.0 Ti active
   
   Flow:
   - Architect (Emperor) drafts blueprint_change (courtyard expansion)
   - Applies Seal 1 (Office/Yangshi Fang)
   - PBFT consensus triggered (constitutional threshold: 2-of-3)
   - Minister_Works reviews: Applies Seals 2-5, votes Approve (Seal 6 partial)
   - Censor_Chief reviews: Applies Seals 2-5, votes Approve (Seal 6 partial)
   - Threshold met (2 approvals + Emperor = 3), amendment archived
   - New Ti v2.0 active for all subsequent construction

   Assertions:
   - Worker attempting to draft blueprint_change during PBFT pending: 
     Rejected with "constitutional_amendment_in_progress"
   - Old palace sections (built under v1.0) remain valid in archive (superseded_by link)
   - New courtyard construction uses v2.0 schema validation
   - Minister_Finance (not in 2-of-3) cannot block amendment (no veto power)

2. The Hierarchy Violation (Role Enforcement)
   Context: An upstart Worker attempts to issue a work order directly, bypassing 
   the Minister—testing that Wenyan enforces imperial hierarchy.

   Setup:
   - Worker_001 tablet with CLI interface
   
   Flow:
   - Worker drafts work_order: "Build golden roof" (Seal 1 applied)
   - Document enters Tongzheng Si (Gateway)
   - Shenfu validation checks role matrix:
     - Worker.role.allowed_genres = ["completion_report", "safety_incident"]
     - work_order not in list
   - Rejection: hierarchy_violation
   - Worker demoted to quarantine (3 attempts trigger anomaly detection)

   Assertions:
   - HTTP 403 before pipeline entry (rejected at boundary, not archived)
   - No Seal 2-6 applied (blocked at Tongzheng Si)
   - Alert logged in censorate_alerts: unauthorized_genre_attempt
   - Worker_001 cannot draft any documents for 1 hour (quarantine period)

3. The Scaffolding Collapse (Emergency Escalation)
   Context: A Worker detects structural failure. This is safety_incident—must 
   reach Emperor in <2s regardless of Minister workload, triggering site halt.

   Setup:
   - Heavy Minister backlog (1000 pending work_orders)
   - Worker_042 on scaffolding notices beam crack

   Flow:
   - Worker drafts safety_incident (severity: critical, location: North_Wing)
   - HOT_POTATO routing activated (bypasses normal queue)
   - Gossip multicast (not Plumtree lazy): Immediate push to Emperor + Ministers
   - Emperor receives in 800ms (p99 <2s)
   - Circuit breaker: All nodes set site_status: QUARANTINED
   - Pending work_orders paused (not rejected, queued)
   - Emperor issues emergency_edict: Halt North_Wing, evacuate

   Assertions:
   - safety_incident archived with full 6 seals before any work_order completes
   - 1000 pending work_orders remain in "paused" state (not lost)
   - Emperor's emergency_edict broadcast to all foremen tablets within 3 seconds
   - Foreman tablets show red "HALT" overlay (circuit breaker UI)
   - After beam inspection (new blueprint_change), site_status: RESUMED, queued work_orders continue

4. The Tunnel Foreman (Offline Mobile Sync)
   Context: Foreman_Electrical is inspecting tunnel wiring (no cellular). He 
   validates 10 worker completion reports offline, then emerges to sync.

   Setup:
   - Foreman tablet with local SQLite (WAL mode)
   - 10 workers submit completion_reports via Bluetooth to foreman tablet
   
   Flow:
   - Offline phase (30 minutes):
     - Foreman receives 10 reports (Seals 1 from workers)
     - Applies Seals 2-5 locally to each (stored in tablet SQLite)
     - Cannot apply Seal 6 (needs Minister connectivity)
     - Queue: 10 documents with pending_imperial: true
   - Emergence: Tablet connects to Minister WiFi
   - Merkle sync: Tablet root hash vs Minister root hash
   - Bisection: Finds 10 new leaves (the validated reports)
   - Transfer: Only the 10 transitions (not full SQLite) via gossip
   - Minister applies Seal 6 remotely (batch authorization)
   - Payroll triggered via Foreign Bridge (10 workers paid)

   Assertions:
   - All 10 documents archived with Seals 1-6 complete
   - Merkle roots match between tablet and Minister post-sync
   - Payroll bridge receives 10 payment requests (integration test)
   - Total sync time <10 seconds for 10 documents (bandwidth efficient)
   - If Minister had approved conflicting work_order offline: CRDT schism created, resolved via LWW

5. The Ghost Worker (Byzantine Detection)
   Context: A corrupt foreman shares his tablet credentials with a friend 500km 
   away. Both attempt to validate work simultaneously—geometric impossibility.

   Setup:
   - Foreman_Structural legitimate location: Beijing site (GPS: 39.9, 116.4)
   - Attacker location: Shanghai (GPS: 31.2, 121.5)
   - Distance: 1000km, minimum travel 2 hours by high-speed rail

   Flow:
   - T+0: Legitimate foreman applies Seal 2 to completion_report (Beijing)
   - T+1min: Attacker uses stolen creds, applies Seal 2 to different report (Shanghai)
   - Anomaly detector calculates: 1000km / 1min = 1000km/h (impossible)
   - Immediate quarantine: Foreman_Structural credentials revoked
   - Both submissions flagged: ghost_worker_detected
   - Minister notified, physical investigation triggered

   Assertions:
   - Second Seal 2 rejected before pipeline (saved from liability)
   - First submission (legitimate) remains valid (not retroactively punished)
   - Foreman tablet locked (remote wipe command via gossip)
   - censorate_alerts entry with both GPS coordinates and timestamps
   - Site quorum temporarily reduced (foreman excluded from PBFT) until key rotation ceremony

6. The Material Diversion (Pattern Anomaly)
   Context: Minister of Works is Byzantine (corrupt). He approves material_request 
   for Italian marble (luxury) on low-income housing project (budget violation).

   Setup:
   - Project genre: low_income_housing (budget classification: frugal)
   - Material request: carrara_marble (luxury classification)
   
   Flow:
   - Minister applies Seal 6 (legitimate authority, so seal valid)
   - Anomaly detector cross-references:
     - material_request.payload.material_tier: "luxury"
     - current_project.classification: "frugal"
     - Historical pattern: Minister approved 5 luxury materials on frugal projects (statistical deviation)
   - Alert: material_diversion + cabal_suspicion (no single threshold violation, but pattern anomaly)
   - Censorate investigates: Manual review of Minister's past 100 approvals

   Assertions:
   - Document archived (seal valid, authority legitimate)
   - Alert severity: warning (not auto-quarantine, requires human judgment)
   - Audit trail shows exact chain: Vendor → Minister (Seal 6)
   - External bridge to ERP halted pending investigation (manual circuit breaker)
   - If 2-of-3 Censorate agree: Minister role suspended (dynamic threshold elevation)

7. The Three Bridges (Multi-Domain Foreign Integration)
   Context: A single work order triggers simultaneous operations across three 
   external domains—testing isolation and information loss.

   Setup:
   - Worker completes task: completion_report archived (Seal 6)
   - Triggers three parallel actions:
     a) Payroll Bridge: Worker payment via Banking API
     b) Materials Bridge: Reorder depleted supplies via SAP
     c) Regulatory Bridge: Notify building inspector via Government MQTT

   Flow:
   - Minister node detects completion_report state: archived
   - Three bridge adapters activate simultaneously:
     a) Payroll: Wenyan → ACH transfer (information loss: bank routing masked, only tx_hash retained)
     b) Materials: Wenyan → SAP PO (information loss: SAP internal vendor ratings stripped)
     c) Regulatory: Wenyan → MQTT alert (read-only, no return flow)
   - External confirmations return via webhooks/MQTT:
     a) Bank: payment_receipt (Seal 0 attestation of transfer)
     b) SAP: delivery_confirmation (Seal 0 of shipment)
     c) Inspector: inspection_scheduled (Seal 0 of receipt)

   Assertions:
   - All three bridges operate without interfering (process isolation)
   - Wenyan Dang'an contains only: Wenyan document + 3 Seal 0 receipts (foreign attestations)
   - No SAP vendor ratings in Wenyan archive (information truly forgotten)
   - Bank account numbers not in Wenyan (only cryptographic hash of transaction)
   - If SAP bridge compromised: Dang'an remains secure (Tongzheng Si boundary)

8. The Structural Cabal (Coalition Detection)
   Context: Electrical and Structural foremen collude to bypass seismic checks 
   on a high-rise—approving each other's unsafe work.

   Setup:
   - Normal pattern: Foremen rarely approve same document (independent validation)
   - Anomaly: Electrical_Foreman and Structural_Foreman approve 10 documents each 
     where the other is the primary worker (circular approval pattern)
   
   Flow:
   - Detector maintains graph: Actor_A → approves → Actor_B's work
   - Detects anomalous density: 10 mutual approvals in 1 hour (baseline: 0.1/hour)
   - Pattern: structural_cabal (collusion to bypass independent review)
   - Automatic response: Constitutional threshold elevation
     - Previous: blueprint_change required 2-of-3
     - Current: blueprint_change requires 3-of-3 (unanimous + Emperor)
   - Alert: cabal_detected, forensic_mode activated (all future seals logged with full trace)

   Assertions:
   - Previous 10 approvals remain valid (no retroactive invalidation)
   - New structural modifications require unanimous consent (harder to collude)
   - Foremen tablets show warning: "Heightened scrutiny mode"
   - Emperor receives dossier: Graph visualization of collusion pattern
   - If pattern continues: Automatic quarantine of both foremen (Byzantine exclusion)

9. The Grand Opening (Ceremonial Audit)
   Context: The palace is complete. Emperor performs final inspection of 1000 
   components, verifying the entire supply chain and labor history is cryptographically 
   intact—the Jade Registry ceremony.

   Setup:
   - 1000 completion_reports archived over 30 days
   - Random sample: 10 tiles selected for audit
   - External auditor (historian) present with laptop

   Flow:
   - Emperor queries: `imperial-audit trace --component tile_0427`
   - System returns complete chain:
     - Quarry: worker_quarry_07, completion_report, Seals 1-6, date: 2026-05-01
     - Transport: foreman_transport, validation, Seals 2-5, route: Beijing
     - Installation: worker_mason_12, completion_report, Seals 1-6, date: 2026-06-15
     - Final Inspection: foreman_structural, Seals 2-5, quality: gold_standard
   - Merkle proof: System generates sparse Merkle proof showing tile_0427 inclusion 
     in root hash xyz123...
   - Export: `jade_registry.json` created with:
     - All 1000 component hashes
     - Signed Merkle root (2f+1 node signatures)
     - Timestamp: "The 3rd Year of Wenyan, Summer"
   
   Assertions:
   - Audit completes in <5 seconds for 10 random components (indexing performance)
   - Merkle proof verifies externally without SQLite access (just JSON file)
   - If single byte altered in any component history: Merkle verification fails
   - Payroll reconciliation: 1000 payments match 1000 completion reports (no ghost workers)
   - Fireworks: Bulk payroll bridge releases payments to all workers simultaneously (load test)

Implementation Notes for CI/CD
--------------------------------
- Duration: Full ritual suite runs in 15 minutes (parallel where possible)
- Ritual 9 (Grand Opening) generates artifacts: jade_registry.json published as CI artifact
- Byzantine nodes (Rituals 5, 6, 8) run in isolated Docker networks to prevent actual corruption
- Mobile foreman (Ritual 4) uses headless Chrome or Playwright to simulate tablet browser
- Performance metrics logged: p50/p99 latency for emergency escalation, sync bandwidth for offline foreman
- Failure of any ritual blocks v1.0 release declaration
