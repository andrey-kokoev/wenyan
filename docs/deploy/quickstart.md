# Quick Start: Wenyan on Your Laptop (5 minutes)

Run a single-node Wenyan instance for local development, testing the CLI, and understanding the document flow. No infrastructure required—just your laptop and a terminal.

## Prerequisites

- **OS**: Linux, macOS, or WSL2 on Windows
- **Tools**: `curl`, `unzip`, SQLite (usually pre-installed)
- **Ports**: 8080 (gateway), 7946 (gossip) available

## Installation (30 seconds)

```bash
# Download latest release
curl -L https://github.com/andrey-kokoev/wenyan/releases/download/v1.0.0/wenyan-linux-amd64 -o wenyan
chmod +x wenyan
sudo mv wenyan /usr/local/bin/

# Verify installation
wenyan --version
# Output: wenyan 1.0.0 (The Imperial Standard)
```

## Initialize the Dang'an (30 seconds)

Create your personal archive (the 档案):

```bash
mkdir ~/wenyan-dev && cd ~/wenyan-dev
wenyan init --name developer-laptop
```

This creates:
- `wenyan.dang'an` (SQLite archive with genesis schema)
- `wenyan.toml` (configuration)
- `genesis.pem` (your Ed25519 signing key—**backup this file**)

## Create Your First Document (2 minutes)

```bash
# Draft a document (creates Seal 1 - Office seal)
wenyan draft --genre memo --to "future-self" --content "Hello from Wenyan"

# Submit to the archive (Seals 2-6 applied locally in single-node mode)
wenyan submit ./memo-*.json

# Query the archive
wenyan list --state archived
wenyan show <document-id> --seals
```

## Verify the Seal Chain

```bash
# Inspect the cryptographic proof
wenyan verify --document <id>

# Expected output:
# Seal 1 (Office): Valid ✓ (Signed by developer-laptop)
# Seal 2 (Censor): Valid ✓ (Schema compliance: memo)
# Seal 3 (Date): Valid ✓ (2026-07-15T10:23:00Z)
# Seal 4 (Class): Valid ✓ (Clearance: open)
# Seal 5 (Route): Valid ✓ (Destination: future-self)
# Seal 6 (Imperial): Valid ✓ (Self-signed in single-node)
# Merkle Root: abc123...
```

## Next Steps

- **Learn the CLI**: `wenyan --help`
- **Try offline mode**: Disconnect WiFi, draft documents, reconnect, sync
- **Read the spec**: `cat spec/WENYAN-PROTOCOL.md`

## Troubleshooting

**Port 8080 already in use**:
```bash
wenyan serve --port 9000
```

**Genesis key lost**:
If you delete `genesis.pem`, you cannot sign new documents. Re-run `wenyan init` to create a new identity (old documents remain verifiable but you cannot amend them).

**SQLite locked**:
Another process is using the Dang'an. Check: `lsof wenyan.dang'an`