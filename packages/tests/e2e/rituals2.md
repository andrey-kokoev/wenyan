# Imperial Rites (Additional E2E Tests)

8. The Secret Memorial (Mifeng/密封)
   Context: High-clearance documents arrive in sealed envelopes (encrypted payload).
   Only the Censorate and Emperor possess keys to decrypt.
   
   Test: Encrypt payload with recipient public key at drafting.
   Verify Gateway cannot read content (opaque blob).
   Verify Shenfu stage decrypts with private key for review.
   Verify unauthorized actors receive ciphertext only.
   Assertion: Content remains encrypted in transit logs; only Seal metadata visible.

9. The Joint Memorial (Huiti/会题)
   Context: Unlike sequential Multi-Office (4), multiple offices draft 
   a single document concurrently, each appending their seal to the same 
   memorial before it enters the pipeline.
   
   Test: Three actors draft partial content simultaneously.
   Merge into single document with multiple Office seals (Seal 1a, 1b, 1c).
   Verify pipeline accepts multi-sig draft.
   Assertion: Document originates from three offices; rejection requires 
   consensus of all three to withdraw.

10. The Imperial Audience (Chao/朝) — Streaming
    Context: Real-time presentation of urgent military dispatches to the throne.
    The emperor views the draft before sealing, providing verbal instruction 
    that becomes the zhupi.
    
    Test: WebSocket stream from draft stage to imperial client.
    Verify emperor can view "pending_imperial" documents in real-time.
    Verify zhupi is applied via live connection, not batched.
    Assertion: Latency < 100ms from draft to imperial screen; 
    archive marks "witnessed_by" timestamp.

11. The Return to Sender (Bohui/驳回)
    Context: Censorate rejects a memorial but annotates it with corrections,
    returning to originating office for revision (not destruction).
    The document retains its original ID but accumulates a "revision chain."
    
    Test: Submit invalid document; Shenfu rejects with annotations.
    Verify document returns to "draft" state with original actor.
    Verify actor can amend and resubmit (same ID, new Seal 1).
    Verify archive contains full revision history (v1, v2, v3).
    Assertion: Message ID persistent across revisions; rejection reasons 
    visible in audit trail.

12. The Register of Presentation (Dengwen/登文)
    Context: Before processing, the Tongzheng Si logs the arrival in a 
    public ledger visible to all offices, proving receipt timestamp 
    for legal disputes.
    
    Test: Submit document during network partition (archive unavailable).
    Verify Gateway writes to local WAL (Write-Ahead Log).
    Verify ledger entry is public-readable before authorization completes.
    Assertion: 202 Accepted with provisional timestamp; 
    final archive commit preserves original receipt time.

13. The Archives Migration (Qiankan/迁刊)
    Context: Annual transfer of documents older than three years from 
    capital archives to provincial salt garrisons (cold storage).
    Originals remain indexed but payload moves to cheaper storage.
    
    Test: Create documents with timestamps 3+ years old.
    Trigger migration job.
    Verify metadata remains in hot SQLite; payload moves to object storage/file.
    Verify seal chain still validates against migrated payload.
    Assertion: Retrieval latency increases for archived docs but 
    cryptographic integrity maintained; hot storage size capped.

14. The Censorate Circulation (Kechao/科抄)
    Context: Approved edicts are copied (chao) and distributed to all 
    relevant ministries for implementation—fan-out broadcast.
    
    Test: Authorize document with routing.broadcast=true.
    Verify single authorization creates n copies in archive 
    (one per destination office).
    Verify each copy has unique Seal 5 (Route) but shared Seal 6 (Imperial).
    Assertion: Atomic broadcast; all copies share zhupi but diverge in routing.

15. The Mobile Imperial Camp (Xunxing/巡幸)
    Context: Emperor traveling (offline mode). Local cache of pending 
    documents; synchronization upon return to capital.
    
    Test: Gateway operates with --offline flag (no archive connection).
    Queue documents in local LevelDB/SQLite.
    Verify seals 1-5 can be applied; Seal 6 queued.
    Reconnect to archive; verify batched synchronization.
    Assertion: Offline operations validate structurally; 
    authorization stalls until connectivity restored; no message loss.

16. The Errata Slip (Gaiding/改定)
    Context: After archiving, a critical error is discovered 
    (wrong date, wrong recipient). An errata memorial is filed 
    referencing the original, but original remains immutable.
    
    Test: File amendment message referencing original ID.
    Verify original document linked to amendment.
    Verify consumers querying original receive "see amendment" notice.
    Assertion: Original document state frozen; amendment creates new 
    archive entry with supersedes pointer; audit shows correction chain.

Ritual Completeness
When implemented, Wenyan reenacts the full documentary cycle of the 
High Qing bureaucracy: conception (draft), validation (seals), 
presentation (gateway), authorization (zhupi), distribution (kechao), 
correction (gaiding), and retirement (qiankan).