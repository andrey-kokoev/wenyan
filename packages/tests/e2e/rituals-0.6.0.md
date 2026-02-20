# End-to-End Rituals for Wenyan v0.6.0 (The Censorate — Observability & Audit)

These rituals verify that the distributed consort is fully observable, that
read operations leave cryptographic evidence (Seal 0), and that Byzantine
intrusions are detectable via behavioral analysis.

1. The Transparent Archive (Distributed Tracing)
   Context: A petition travels from Guangzhou (draft) through Nanjing (review)
   to Beijing (authorize). The Censorate must observe the complete journey across
   nodes without blind spots.

   Setup:
   - 3-node consort: Beijing (imperial), Nanjing (censorate), Guangzhou (provincial)
   - Jaeger tracing backend (or stdout exporter for test)
   
   Flow:
   - Guangzhou drafts document (Seal 1)
   - Trace context injected into SWIM gossip message
   - Nanjing receives, processes review (Seal 2-5), propagates to Beijing
   - Beijing applies Seal 6
   
   Assertions:
   - Jaeger UI shows single trace spanning 3 nodes (trace_id consistent)
   - 6 spans visible: caoni.draft (GZ), gossip.send, gossip.recv, shenfu.review (NJ), gossip.send, pizhun.authorize (BJ)
   - Each span contains attributes: seal.type, actor.id, document.genre
   - Latency metrics: gossip latency <10ms, SQLite commit <5ms per span

2. The Reader's Mark (Seal 0 Verification)
   Context: A clerk queries the Dang'an for tax records from 1645. The system
   must cryptographically prove this access occurred, preventing later denial.

   Setup:
   - Document archived: genre="tax_record", year=1645, content=sensitive
   - Clerk actor authorized for genre tax_record
   
   Flow:
   - Clerk executes: `wenyan query --genre=tax_record --year=1645`
   - System retrieves document
   - System creates Seal 0 entry:
     - document_id: tax_record_1645_id
     - actor_id: clerk_pubkey
     - query_parameters: { genre: "tax_record", year: "1645" } (hashed for privacy)
     - result_hash: Blake3 of returned JSON
     - signature: clerk signs the receipt
   - Seal 0 stored in seal_0_log table
   
   Assertions:
   - `wenyan audit who-read --document <id>` returns entry with clerk's identity
   - Cryptographic signature verifies against clerk's public key
   - Query without authentication fails (403) or creates anonymous Seal 0 (configurable)
   - Seal 0 entry appears in Merkle tree (checkpoint includes read audit)

3. The Stolen Seal (Velocity Anomaly Detection)
   Context: A Byzantine actor steals the Minister's private key and attempts
   to authorize 100 constitutional amendments in 1 minute (coup attempt).

   Setup:
   - Anomaly rule configured: velocity_threshold = 10 (max 10 Seal 6 per minute per actor)
   - Attack: Script applies Seal 6 to 100 ti_definitions as fast as possible
   
   Flow:
   - First 10 amendments succeed (within threshold)
   - 11th amendment triggers anomaly detector
   - Detector creates alert:
     - severity: critical
     - actor: compromised_minister
     - pattern: velocity_violation
     - action: quarantine
   - System automatically quarantines actor:
     - All subsequent seals from this actor rejected pending manual attestation
     - Existing valid seals (first 10) remain in archive (no retroactive invalidation)
   
   Assertions:
   - Exactly 10 amendments archived before quarantine
   - Alert entry exists in censorate_alerts table
   - Actor status in actor_registry: quarantine=true
   - `wenyan audit anomaly --window 1h` shows velocity spike graph

4. The Time Bandit (Temporal Anomaly Detection)
   Context: A compromised node attempts to backdate a constitutional amendment
   to make it appear older than it is (retroactive legislation).

   Setup:
   - Byzantine node sets system clock to 1 week in the past
   - Attempts to issue ti_definition with timestamp T-7days
   
   Flow:
   - Shenfu stage validates Seal 3 (Date)
   - Compares claimed timestamp with:
     - Local wall clock (drift > 5 seconds detected)
     - SWIM cluster median timestamp (Byzantine fault tolerant clock)
     - Previous Seal 3 in chain (monotonicity check)
   - Detects temporal anomaly: claimed_time << cluster_median - threshold
   - Rejects document with reason: temporal_anomaly
   - Alerts: Byzantine clock attack detected from node_nan
   
   Assertions:
   - Document transitions to feiwen (void)
   - censorate_alerts entry with type: temporal_anomaly
   - Node_nan suspected in SWIM (increased suspicion score)
   - If 2f+1 nodes report node_nan anomalies, automatic exclusion from consort

5. The Ghost Actor (Geographic Impossibility Detection)
   Context: An actor's key is cloned. Seals appear from Beijing and Nanjing
   within 1 second (physically impossible, >1000km apart).

   Setup:
   - Actor "general_li" legitimately in Beijing
   - Attacker clones key, uses from Nanjing simultaneously
   
   Flow:
   - Seal 1 applied from Beijing (timestamp T, location metadata Beijing)
   - Seal 1 applied from Nanjing (timestamp T+0.5s, location metadata Nanjing)
   - Distance: 1000km, minimum travel time: 1 hour (even by fastest courier)
   - Anomaly detector calculates: impossible_travel = distance / (time_delta * max_speed) > 1
   
   Assertions:
   - Second seal rejected with geographic_impossibility
   - Alert created with both locations and timestamps
   - Actor quarantined pending identity verification
   - Merkle checkpoint includes both attempted seals (evidence of cloning)

6. The Cabal (Coalition Anomaly Detection)
   Context: Normally antagonistic offices suddenly collude to pass a controversial
   constitutional amendment (suspicious coalition).

   Setup:
   - Historical baseline: Censorate and Ministry of War rarely agree (0% overlap in approvals)
   - Anomaly: 5 amendments in 1 hour approved by exactly these two offices (100% overlap)
   
   Flow:
   - Detector maintains Markov chain of actor coalitions per genre
   - Detects deviation: P(censorate ∩ war | petition) = 0.95, but baseline = 0.05
   - Z-score > 3 standard deviations
   - Alert: cabal_detected
   
   Assertions:
   - Alert includes statistical evidence (baseline vs observed probability)
   - Amendments still valid (not auto-rejected) but flagged for review
   - Optional: Circuit breaker raises constitutional threshold from 3 to 5 seals temporarily

7. The Audit Export (Merkle Checkpoint Verification)
   Context: External auditor (imperial inspector) arrives to verify no tax records
   were altered during the fiscal year. System exports tamper-evident proof.

   Setup:
   - Fiscal year documents: 10,000 tax records sealed
   - Current Merkle root: abc123...
   
   Flow:
   - Execute: `wenyan audit export --start 2026-01-01 --end 2026-12-31 --format json`
   - System exports:
     - All 10,000 documents (or just hashes if privacy mode)
     - All Seal 0 entries (who accessed)
     - Signed Merkle root at year-end
     - Sparse Merkle proof of inclusion for each document
   
   Assertions:
   - Auditor verifies: Blake3(exported_data) == published_merkle_root
   - Any missing document detected (Merkle proof fails)
   - Any altered document detected (hash mismatch)
   - Any unauthorized access detected (Seal 0 log complete)
   - Signature from 2f+1 nodes on checkpoint verifies consensus

8. The Blind Read (Unauthorized Access Attempt)
   Context: A clerk without clearance attempts to query secret military dispatches.
   Seal 0 should log the attempt even if denied (intrusion detection).

   Setup:
   - Document: genre="military_dispatch", clearance="top"
   - Clerk: allowed_genres=["petition"], no top clearance
   
   Flow:
   - Clerk query: `wenyan query --genre=military_dispatch`
   - Shenfu checks classification edict: clerk lacks top clearance
   - Query denied (403 Forbidden)
   - Seal 0 STILL created:
     - document_id: null (did not see content)
     - query_parameters: { genre: "military_dispatch" }
     - result: "denied"
     - signature: clerk (non-repudiable proof of attempt)
   
   Assertions:
   - `wenyan audit who-read --genre=military_dispatch` shows denied attempt
   - Alert generated: unauthorized_access_attempt
   - Clerk cannot claim "I never tried to access military documents"
   - After 3 denied attempts, clerk auto-quarantined

9. The Tracing Overhead (Performance Verification)
   Context: Verify observability does not degrade consort throughput.

   Setup:
   - Baseline: v0.6.0 consort processes 1000 seals/second with 0.5ms latency
   - v0.6.0 with tracing enabled (sampling 100% constitutional, 10% legislative)
   
   Flow:
   - Load test: 10,000 documents, mix of constitutional (ti_definition) and legislative (edict)
   - Measure throughput and latency
   - Compare to baseline
   
   Assertions:
   - Throughput degradation <5% (950+ seals/second sustained)
   - Latency increase <1ms p95
   - Memory usage stable (no span leaks, bounded queue)
   - WAL write amplification <2x (Seal 0 batching effective)

Implementation Notes
--------------------
- Use `docker-compose` with Jaeger container for tracing visualization
- Use `k6` or `artillery` for load testing ritual 9
- Anomaly detection rules should be hot-reloadable via edict documents
- Seal 0 table requires careful indexing (document_id, actor_id, timestamp) for query performance
- For privacy-sensitive deployments, Seal 0 can store hashed query parameters rather than plaintext (configurable via edict)