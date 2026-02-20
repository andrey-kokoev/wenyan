--- e2e/rituals-v0.2.0.md ---

End-to-End Rituals for Wenyan v0.2.0 (The Self-Describing Empire)

Version 0.2.0 establishes the fully self-describing archive: the system reads its own 
constitution (Ti) and laws (Edicts) from the Dang'an, not from configuration files.
These rituals verify the constitutional layer and the separation of ontology (体) from governance (法).

1. The Grand Secretariat Establishment (Genesis Bootstrap)
   Context: The founding of the imperial bureaucracy. The Emperor establishes the
   Hanlin Academy (to define document styles) and the Six Ministries (to govern),
   recording both in the Jade Register (archive) before accepting external memorials.

   Technical Flow:
   - Execute `wenyan --init /var/wenyan` with minimal bootstrap (node_id, genesis_key)
   - System auto-drafts two genesis documents:
     a) ti_definition (genre: ti_definition, version: 1.0.0) — defines how to define schemas
     b) edict (law_type: appointment) — creates initial role "genesis_admin" with full powers
   - System applies Seal 6 (genesis_key) to both, archiving them
   - System enters operational state

   Assertions:
   - Archive contains exactly 2 documents (both state: archived)
   - Query `GET /api/wenyan/constitution` returns current ti_definition content
   - Query `GET /api/wenyan/law/appointment` returns genesis_admin role definition
   - Attempting to submit non-genre document before bootstrap complete fails with 503 "Empire not established"
   - Bootstrap idempotent: second `--init` on same path detects existing genesis, exits 0 without mutation

2. The Imperial Catalogue (Ti Definition Creation)
   Context: The Hanlin Academy promulgates a new document style (genre: "petition").
   This is constitutional—defining the very structure of acceptable discourse.

   Technical Flow:
   - Minister drafts ti_definition document:
     ```json
     {
       "genre": "ti_definition",
       "payload": {
         "target_genre": "petition",
         "version": "1.0.0",
         "schema": { "provenance": {...}, "payload": {...}, "routing": {...} },
         "superseded_by": null
       }
     }
     ```
   - Standard 6-seal workflow (requires genesis_admin or delegated constitutional authority)
   - Archive commits with high threshold (Seal 6 requires 2-of-3 imperial signatures for ti_definition)
   - Subsequent petitions validated against this schema (Seal 2: Censor)

   Assertions:
   - POST /api/wenyan/messages with genre "petition" rejected before ti_definition archived (400 Bad Genre)
   - After archival, same payload accepted (201 Created)
   - Schema retrieval via archive API returns exact Zod-equivalent structure
   - ti_definition immutable: attempts to UPDATE via SQL fail (foreign key constraint on genre registry)

3. The Appointment Edict (Governance without Structure Change)
   Context: The Ministry of Personnel issues an edict defining the role "censor"—who may review
   petitions, but not the structure of petitions themselves.

   Technical Flow:
   - Draft edict document:
     ```json
     {
       "genre": "edict",
       "payload": {
         "law_type": "appointment",
         "target_genre": "petition",  // References ti_definition ID
         "content": {
           "role_id": "censor",
           "permissions": ["review"],
           "allowed_genres": ["petition"]
         },
         "precedence": 1,
         "effective_date": "2026-03-01T00:00:00Z"
       }
     }
     ```
   - Standard 6-seal workflow (normal threshold—single imperial seal sufficient for edicts)
   - Pipeline reads edict from archive to enforce role-based routing

   Assertions:
   - Actor with role "censor" may apply Seal 2 (Shenfu) to petitions
   - Actor with role "clerk" (no "review" permission) attempting Seal 2 receives 403 Forbidden
   - Query /api/wenyan/law/appointment returns latest censor definition
   - Edict effective_date respected: submissions before effective_date use previous law (temporal jurisdiction)

4. The Constitutional Amendment (Superseding Ti)
   Context: The Hanlin Academy revises the petition format (v1.0.0 → v2.0.0), adding "urgency" field.
   This is constitutional change—rare and weighty.

   Technical Flow:
   - Draft new ti_definition with superseded_by pointing to v1.0.0 ID
   - High threshold authorization (3-of-5 imperial seals or constitutional convention)
   - Archive maintains both: v1.0.0 (superseded) and v2.0.0 (current)
   - Running pipeline accepts both during transition window (backward compatibility period)
   - After effective_date, v1.0.0 petitions rejected at Tongzheng Si (400 Schema Obsolete)

   Assertions:
   - Archive query for ti_definition/petition returns v2.0.0 by default
   - Query with ?version=1.0.0 retrieves superseded schema (historical fidelity)
   - stateAt(messageId, v1_effective_date) shows schema v1.0.0 was current then
   - Documents sealed under v1.0.0 remain valid in archive (no retroactive invalidation)

5. The Precedence Conflict (Edict Override)
   Context: Two conflicting edicts issued: Minister A routes petitions to Grand Secretariat;
   Minister B (later) routes petitions directly to Emperor. Precedence rules determine current law.

   Technical Flow:
   - Edict 1: precedence=1, sealed_at=T0, routes to "grand_secretariat"
   - Edict 2: precedence=2 (or same precedence but T1 > T0), routes to "emperor"
   - Pipeline queries: SELECT * FROM edicts WHERE law_type='routing' AND target_genre='petition' ORDER BY precedence DESC, sealed_at DESC LIMIT 1

   Assertions:
   - Petitions submitted after Edict 2 archival route to "emperor"
   - Query /api/wenyan/law/routing returns Edict 2 content (Edict 1 remains in archive but inactive)
   - Amendment chain: Edict 2 payload contains superseded_edict_id linking to Edict 1 (historical continuity)

6. The Cold Start Verification (Constitution from Empty)
   Context: New node joins mesh with empty SQLite. Must reconstruct operational state solely from
   replicated archive (no local config beyond genesis key).

   Technical Flow:
   - Node B: `wenyan --join tcp://beijing:8080` with empty /var/wenyan
   - Replication protocol transfers all genesis edicts and ti_definitions first (constitutional layer)
   - Node B validates Seal 6 on all constitutional documents before accepting operational documents
   - Node B constructs in-memory law cache from archive, begins accepting new submissions

   Assertions:
   - Node B rejects operational messages until constitutional sync complete
   - Node B's /api/wenyan/constitution matches Node A's exactly (deterministic genesis)
   - Node B applies current routing rules (from replicated edicts) immediately upon sync
   - Archive hash (Merkle root) identical between nodes post-sync

7. The Invalid Cross-Reference (Edict Referencing Nonexistent Ti)
   Context: A rogue minister attempts to issue an edict for genre "secret_treaty" before
   the Hanlin Academy has defined that genre structure.

   Technical Flow:
   - Draft edict: law_type=appointment, target_genre="secret_treaty"
   - Shenfu stage validates: Does ti_definition exist for target_genre?
   - Validation fails: Cannot appoint reviewers for undefined document type

   Assertions:
   - Pipeline rejects edict at Seal 2 (Censor) with 422 Unprocessable: "Target genre undefined"
   - Error payload indicates missing ti_definition dependency
   - No partial seal application (atomic rejection)

8. The Protocol Edict (Meta-Governance)
   Context: The Emperor issues edict changing the consensus rules themselves—reducing
   required_acks from 3 to 2 for faster wartime communication.

   Technical Flow:
   - Edict: law_type=protocol, content={ required_acks: 2, effective_immediately: true }
   - Standard 6-seal workflow
   - Mesh nodes watch edict stream; apply new protocol parameters after Seal 6 detected

   Assertions:
   - Submissions after edict archival use new quorum (2)
   - Submissions in-flight during transition complete with old quorum (3)
   - Archive contains protocol change audit trail (who changed consensus, when)
   - Attempt to set required_acks=0 rejected by Shenfu (schema validation: minimum 1)

Implementation Notes
- Constitutional documents (ti_definition) should have elevated seal threshold configurable via genesis edict
- Law cache TTL should respect effective_date boundaries (invalidate cache at effective_date boundary)
- All queries for "current law" must filter: state=archived AND effective_date <= NOW() AND (superseded_by IS NULL OR superseded_by.effective_date > NOW())