# Production Deployment: 3-Node Consort with Docker Compose (30 minutes)

Deploy a fault-tolerant Wenyan consort across three VPS instances for small teams, family offices, or regional construction sites. No Kubernetes required—just Docker and SSH.

## Architecture

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Beijing   │◄───────►│   Nanjing   │◄───────►│   Shanghai  │
│   (Leader)  │  Gossip │  (Follower) │  Gossip │  (Follower) │
│  Minister   │         │   Censor    │         │   Archive   │
└─────────────┘         └─────────────┘         └─────────────┘
```

- **3 nodes**: Tolerates 1 node failure (f=1 Byzantine fault tolerance)
- **Docker Compose**: Single file per node, simple restart policies
- **SQLite with WAL**: Persistent storage on host volumes

## Prerequisites

- **3 VPS instances**: 2GB RAM, 20GB SSD each (e.g., DigitalOcean $12/mo droplets, AWS t3.small)
- **Docker & Compose**: `docker-compose` v2.0+
- **Networking**: Nodes can reach each other on ports 8080 (HTTP) and 7946 (gossip)

## Step 1: Provision Nodes (5 minutes)

On each server (beijing, nanjing, shanghai):

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Create directory structure
mkdir -p ~/wenyan/{data,config}
chmod 700 ~/wenyan/data
```

## Step 2: Genesis Ceremony (Beijing Only) (5 minutes)

On the Beijing node (your first/leader node):

```bash
# Create genesis configuration
cat > ~/wenyan/config/genesis.toml << 'EOF'
[genesis]
node_id = "beijing-001"
realm = "production-consort"

[consensus]
kind = "pbft"
replica_set = ["beijing-001", "nanjing-001", "shanghai-001"]
constitutional_threshold = 2  # 2-of-3 for amendments

[gossip]
bind_addr = "0.0.0.0:7946"
EOF

# Initialize the Dang'an (creates genesis key inside Docker volume)
docker run --rm -v ~/wenyan/data:/data -v ~/wenyan/config:/config \
  ghcr.io/andrey-kokoev/wenyan:v1.0.0 \
  init --config /config/genesis.toml --data /data

# Export genesis key securely (you'll need this for other nodes)
docker run --rm -v ~/wenyan/data:/data \
  ghcr.io/andrey-kokoev/wenyan:v1.0.0 \
  export-genesis --data /data > ~/wenyan-genesis-key.pem

# Secure copy this file to your local machine, then delete from server
scp root@beijing:~/wenyan-genesis-key.pem ./
ssh root@beijing "rm ~/wenyan-genesis-key.pem"
```

## Step 3: Configure Follower Nodes (10 minutes)

On **Nanjing** node:

```bash
# Receive genesis key from secure offline channel
# (Assume you SCP'd it back to nanjing temporarily for setup)

cat > ~/wenyan/config/wenyan.toml << 'EOF'
[genesis]
node_id = "nanjing-001"
import_genesis_key = "/config/genesis-key.pem"  # One-time import

[consensus]
kind = "pbft"
replica_set = ["beijing-001", "nanjing-001", "shanghai-001"]

[gossip]
bind_addr = "0.0.0.0:7946"
seeds = ["beijing.yourdomain.com:7946"]
EOF

# Place the genesis key
mv ~/wenyan-genesis-key.pem ~/wenyan/config/genesis-key.pem

# Start the node
docker-compose up -d
```

On **Shanghai** node: Same as Nanjing, but `node_id = "shanghai-001"`.

## Step 4: Docker Compose File (5 minutes)

Create `~/wenyan/docker-compose.yml` on all three nodes:

```yaml
version: '3.8'

services:
  wenyan:
    image: ghcr.io/andrey-kokoev/wenyan:v1.0.0
    container_name: wenyan-node
    restart: unless-stopped
    
    volumes:
      - ./data:/data:rw
      - ./config:/config:ro
    
    environment:
      - WENYAN_DATA_DIR=/data
      - WENYAN_CONFIG=/config/wenyan.toml
      - RUST_LOG=info
    
    ports:
      - "8080:8080"    # Gateway HTTP
      - "7946:7946"    # Gossip SWIM
      - "7946:7946/udp" # Gossip UDP
    
    healthcheck:
      test: ["CMD", "wenyan", "health", "--data", "/data"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    
    # Resource limits for production stability
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M

  # Optional: Prometheus exporter for monitoring
  exporter:
    image: ghcr.io/andrey-kokoev/wenyan-exporter:v1.0.0
    ports:
      - "9090:9090"
    environment:
      - WENYAN_ENDPOINT=http://wenyan:8080
```

## Step 5: Verify Consort Health (5 minutes)

On Beijing:

```bash
# Check all nodes see each other
docker exec wenyan-node wenyan consort status

# Expected output:
# Node ID        Address               State      Last Seen   Merkle Root
# beijing-001    10.0.0.1:7946         Alive      0s          a3f2b1...
# nanjing-001    10.0.0.2:7946         Alive      2s          a3f2b1...
# shanghai-001   10.0.0.3:7946         Alive      1s          a3f2b1...

# Test document flow
wenyan draft --genre test --content "Production test"
wenyan submit ./test-*.json

# Verify replicated to Nanjing (SSH to nanjing and check)
ssh root@nanjing "docker exec wenyan-node wenyan list --state archived"
```

## Backup Strategy

**Critical**: Backup the `~/wenyan/data/` directory on each node:

```bash
# Daily cron job on each node
0 2 * * * rsync -a ~/wenyan/data/ /backup/wenyan-$(date +\%Y\%m\%d)/
```

The Dang'an is append-only; you can also use SQLite's `.backup` command for hot backups.

## Troubleshooting

**Node shows as "Suspect"**:
Network partition likely. Check: `ping nanjing` from Beijing. Gossip will heal automatically when connectivity restored.

**Merkle root mismatch**:
One node has diverged (likely due to crash during write). Solution:
```bash
# On diverged node (e.g., Shanghai)
docker exec wenyan-node wenyan consort sync --peer beijing:7946
```

**Out of disk space**:
SQLite WAL grows during heavy write. Vacuum: `docker exec wenyan-node wenyan archive vacuum`

## Upgrading (Zero Downtime)

```bash
# On each node, one at a time:
docker-compose pull
docker-compose up -d
# Wait for healthcheck to pass before next node
