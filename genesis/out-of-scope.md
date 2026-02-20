--- out-of-scope.md ---

Out of Scope

Wenyan does not implement novel transport protocols. It operates over existing HTTP/WebSocket/TCP channels without optimizing for congestion control, mesh networking, or peer discovery. The Yichuan package provides reliability guarantees atop existing sockets, not socket innovations.

Wenyan does not solve Byzantine consensus. The archive assumes single-node SQLite or trusted replication between known nodes. Distributed consensus algorithms (Raft, PBFT, HotStuff) are excluded; network partitions between wenyan nodes result in explicit unavailability rather than eventual consistency guarantees.

Wenyan does not execute business logic. The pipeline validates document structure and authorization chains, then appends to log. Domain-specific state transitions (inventory management, payment processing, fitness class scheduling) occur in downstream consumers reading the archive, not within wenyan's core state machine.

Wenyan does not provide graphical interfaces. The CLI supports composition and inspection; dashboards, drag-and-drop workflow builders, and mobile applications are external consumers of the archive API.

Wenyan does not integrate enterprise databases. The supported storage adapters are local SQLite and Cloudflare D1 for the same archive contract. Adapters for PostgreSQL, Redis, or object storage are explicitly out of scope for the initial object.

Adjacent Development Directions

Mesh Wenyan: Gossip-based propagation of sealed documents between untrusted nodes, maintaining the categorical invariants while relaxing the single-node assumption. Requires cryptographic verification of remote seals without central coordination.

Bridge Ecosystem: Type-safe adapters translating foreign message buses (NATS, Kafka, MQTT, AMQP) into wenyan documents. Each bridge implements the IntoWenyan trait, proving the universal property against existing infrastructure.

Temporal Audit Engine: Analytical layer querying the dang'an archive for causality analysis—detecting authorization cycles, measuring pipeline latency distributions, reconstructing system state at arbitrary historical moments.

Policy DSL: Domain-specific language compiling to Shenfu validation predicates. Allows non-programmers to define review criteria as declarative rules while maintaining the equalizer property in the type system.

Hardware Seal Modules: Integration with TPM, YubiKey, or cloud HSM for the sixth seal (imperial authorization), ensuring zhupi signatures originate from physically secured keys even in compromised runtime environments.

Agent SDK: Library for autonomous actors participating in the consort protocol—implementing the actor/ package interfaces in Rust, Go, or TypeScript to allow software agents to draft, review, and authorize documents with the same structural constraints as human operators.
