# Wenyan Protocol v1.0 Draft

## Wire Envelopes
- Message envelope: `id`, `genre`, `payload`, `actor`, `submittedAt`, `metadata`
- Seal chain: stages `caoni`, `shenfu-1..4`, `pizhun`

## State Machine
`received -> validated -> reviewed -> authorized -> archived | rejected`

## Mesh and Consensus
- Mesh sync uses deterministic archive ranges and Merkle roots.
- Constitutional path may use PBFT-gated finalization in configured consort mode.

## Bridge Contract
Foreign adapters must enforce forgetting boundaries and submit normalized envelopes through Tongzheng Si.
