# End-to-End Rituals (E2E Tests)

These tests verify Wenyan's universal property through historical reenactment.
Each test maps an imperial procedure to categorical invariant verification.

1. The Imperial Examination (Golden Path)
   Historical Context: A scholar presents a memorial (zouzhe) to the throne.
   It passes through the Tongzheng Si (receipt), is drafted by the Hanlin Academy,
   reviewed by the Censorate, and receives the Emperor's vermilion rescript (zhupi).

   Technical Flow:
   - CLI: `wenyan draft --genre=petition --actor=scholar_01 ./memorial.json`
   - Gateway: POST /api/wenyan/messages (Seal 1: Office applied)
   - Pipeline: Shenfu validation (Seals 2-5)
   - Authorization: Pizhun with imperial key (Seal 6)
   - Archive: Commit to Dang'an (SQLite)

   Assertions:
   - Response status: 201 Created
   - Location header returns message ID
   - GET /api/wenyan/messages/:id returns state "archived"
   - Seal chain length === 6
   - SQLite row exists with immutable hash matching response
   - Archive query for 'scholar_01' returns exactly 1 document

2. The Tampered Memorial (Integrity Failure)
   Historical Context: A courier (Yichuan) is ambushed. The seals are broken
   or the document contents altered. The Tongzheng Si detects the forgery
   and marks it feiwen (void text)—destroyed, not merely rejected.

   Technical Flow:
   - Inject valid document through Gateway
   - Corrupt payload bytes after Seal 2 application
   - Attempt Seal 3 verification

   Assertions:
   - Pipeline throws SealInvalidError at Seal 3 verification
   - State transitions to "feiwen" (bottom type)
   - Archive logs rejection with reason "seal_break"
   - Original actor receives notification of document destruction
   - No downstream consumer processes the corrupted content
   - Hash mismatch detected before database write

3. The Grieved Petition (Idempotency)
   Historical Context: A petition arrives from a flood-stricken province.
   The courier station (Yichuan) burns; the message must be retransmitted.
   The Tongzheng Si recognizes the duplicate memorial by its seal timestamp
   and routing code, acknowledging receipt without double-processing.

   Technical Flow:
   - POST /api/wenyan/messages with X-Idempotency-Key: flood_1638
   - Simulate network timeout after server receives but before client ACK
   - Retry identical POST within 24 hours

   Assertions:
   - Second request returns 200 OK (not 201)
   - Response body identical to first (including original timestamp)
   - SQLite contains exactly one row for flood_1638
   - Seal chain identical; no duplicate seals appended
   - Idempotency key TTL respected (reject after expiration)

4. The Multi-Office Memorial (Routing)
   Historical Context: A military dispatch requires concurrent review by
   the Ministry of War (Bingbu) and the Censorate. The document carries
   multiple routing directives (Seal 5), requiring authorization from
   both offices before imperial approval.

   Technical Flow:
   - Draft document with routing.destination = ["war_ministry", "censorate"]
   - War Ministry applies Seal 4a (clearance: secret)
   - Censorate applies Seal 4b (clearance: secret)
   - Both approvals must precede Seal 6 (Imperial)

   Assertions:
   - State remains "pending" after first approval
   - Second approval triggers transition to "authorized"
   - Seal 6 cannot be applied with only one Seal 4
   - Archive records intermediate state with partial seal chain
   - Query for "pending" returns document; query for "authorized" returns after both

5. The Forbidden Archive (Audit & Immutability)
   Historical Context: The Grand Secretariat attempts to alter records
   of a previous edict to cover a political error. The Dang'an (档案)
   system preserves the original zhupi and the tampering attempt itself,
   creating an indelible record of the corruption.

   Technical Flow:
   - Create and archive valid document (State A)
   - Attempt direct SQL UPDATE on messages table content
   - Attempt to delete transition history
   - Attempt to forge retroactive Seal 3 with past timestamp

   Assertions:
   - SQLite foreign key constraints prevent content mutation
   - Archive logs tampering attempt as new "corruption_alert" message type
   - Original document retrievable with identical hash
   - Retroactive seal fails cryptographic verification (timestamp < prev_seal)
   - Audit query returns full lineage including failed tampering

6. The Corrupted Courier (Network Resilience)
   Historical Context: A message travels the Yichuan relay system.
   A station floods; the courier must backtrack to the previous station.
   The system maintains exactly-once delivery through seal acknowledgment.

   Technical Flow:
   - Start with Gateway operational, Pipeline paused (simulated backpressure)
   - Submit 100 documents rapidly
   - Kill Gateway process (SIGKILL)
   - Restart Gateway, verify Pipeline resumes without loss
   - Verify duplicate detection handles in-flight retries

   Assertions:
   - All 100 documents eventually reach "archived" state
   - Zero duplicate entries in SQLite
   - Seal chains complete (all 6 seals present)
   - Partially sealed documents in "draft" or "review" state recover correctly
   - Archive sequence numbers contiguous (no gaps)

7. The Impersonation Attempt (Identity Boundaries)
   Historical Context: A eunuch attempts to draft a memorial using
   a Grand Secretary's credentials. The Tongzheng Si verifies the
   actor's seal (Seal 1) against the Imperial Registry of Seals,
   detecting the forgery before entry.

   Technical Flow:
   - Draft document with actor_id: "grand_secretary_li"
   - Sign with incorrect private key (random bytes)
   - Submit to Gateway

   Assertions:
   - Gateway rejects at Seal 1 verification (before pipeline entry)
   - HTTP 403 Forbidden
   - Actor registry logs impersonation attempt
   - Document never assigned message ID (no Dang'an entry)
   - Rate limiting triggered on source IP after 3 failed attempts

Implementation Notes
- Use Playwright or Vitest with in-memory SQLite for speed
- For "Forbidden Archive", use actual filesystem permissions to make SQLite read-only mid-test
- For "Corrupted Courier", use `pm2` or process management to simulate hard crashes
- Historical labels (zouzhe, tongzheng si, etc.) should appear in test output/logs