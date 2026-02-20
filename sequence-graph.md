~~~mermaid
sequenceDiagram
    title Wenyan (文檔) - The Initial Object in MsgSys

    actor Human as Human/Agent
    participant CLI as wenyan CLI
    participant GW as Gateway (Tongzheng Si)
    participant DRAFT as Caoni (Draft)
    participant REVIEW as Shenfu (Review)
    participant AUTH as Pizhun (Authorize)
    participant ARCH as Dang'an (Archive)
    participant NATS as Foreign System (NATS)

    Note over Human, ARCH: The Imperial Circuit (Normal Flow)

    Human->>CLI: wenyan draft --genre=petition
    CLI->>CLI: Generate Seal 1 (Office)<br/>Sign with Actor Key
    CLI->>CLI: State: Draft Created
    
    Human->>CLI: wenyan submit ./petition.json
    CLI->>GW: POST /api/wenyan/messages<br/>(Sealed Document)
    
    GW->>GW: Ti Validation (Schema Check)<br/>Zod Parse (Genre Exists?)
    GW->>ARCH: Query: Active Ti Definition<br/>(for Genre: petition)
    ARCH-->>GW: Schema v2.0.0
    
    alt Invalid Schema
        GW-->>CLI: 400 Feiwen (Void)<br/>Schema Noncompliant
    else Valid
        GW->>GW: Idempotency Check<br/>(NATS-Msg-Id / Content Hash)
        GW->>ARCH: Log Transition: Received
        GW->>DRAFT: Forward Document
    end

    DRAFT->>DRAFT: Seal 1 Verification<br/>(Office Signature Valid?)
    DRAFT->>ARCH: Log Transition: Drafting<br/>Store: Document + Seal 1
    DRAFT->>REVIEW: Queue for Review

    REVIEW->>ARCH: Query Current Law<br/>(Edict: appointment/review)
    ARCH-->>REVIEW: Role Matrix (Censor can review petition)
    
    REVIEW->>REVIEW: Apply Seal 2 (Censor)<br/>Schema Compliance Merkle Root
    REVIEW->>REVIEW: Apply Seal 3 (Date)<br/>Lamport Clock + Timestamp
    REVIEW->>REVIEW: Apply Seal 4 (Class)<br/>Clearance: Secret
    REVIEW->>REVIEW: Apply Seal 5 (Route)<br/>Dest: [Grand_Secretariat, Emperor]
    
    REVIEW->>ARCH: Log Transition: Reviewed<br/>Store: Seals 2-5
    
    alt Actor Cannot Review
        REVIEW->>ARCH: Log Rejection: actor-cannot-review<br/>State: Feiwen
        REVIEW-->>CLI: 403 (Async via WebSocket)
    else Authorized
        REVIEW->>AUTH: Forward for Imperial Seal
    end

    AUTH->>AUTH: Verify 5 Preceding Seals<br/>Cryptographic Chain Validation
    
    alt Invalid Chain
        AUTH->>ARCH: Log Rejection: seal-break<br/>State: Feiwen
    else Valid
        AUTH->>ARCH: Query Edict: authorization<br/>(Imperial Threshold)
        ARCH-->>AUTH: min_seals=1, role_required=minister
        
        AUTH->>AUTH: Apply Seal 6 (Imperial)<br/>Genesis Key / HSM Sign
        
        AUTH->>ARCH: Log Transition: Authorized<br/>Store: Seal 6 + Final State
        AUTH-->>CLI: 201 Created<br/>Location: /messages/{id}
    end

    Note over ARCH, NATS: Replay & Initiality Proof
    
    Human->>ARCH: wenyan query --state=archived
    ARCH->>ARCH: SELECT * FROM transitions<br/>WHERE to_state='archived'
    ARCH-->>Human: List of Sealed Documents
    
    Human->>ARCH: wenyan replay --time=T-24h
    ARCH->>ARCH: Fold transitions up to timestamp<br/>Pure Function: (Log, []) -> State
    ARCH-->>Human: Reconstructed State at T-24h
    
    NATS->>GW: Publish (Foreign Message)
    GW->>GW: Drop NATS Headers<br/>Map Subject→Routing<br/>Map Payload→Schema
    GW->>GW: IntoWenyan (Lossy Translation)
    GW->>ARCH: Check: Is Ti Defined for this Genre?
    
    alt Genre Undefined
        GW->>ARCH: Log: Foreign Rejection
        Note right of GW: Initiality Demonstrated:<br/>Foreign structure forgotten,<br/>Wenyan structure imposed
    else Valid Genre
        GW->>DRAFT: Enter Standard Pipeline
    end
~~~