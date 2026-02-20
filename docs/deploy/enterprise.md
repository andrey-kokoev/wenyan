# Enterprise Deployment: Terraform & Kubernetes on AWS (2 hours)

Deploy Wenyan at scale across multiple availability zones with automated failover, HSM-backed genesis keys, and compliance-grade audit logging. For construction consortia, financial clearinghouses, and IoT networks requiring 99.9% SLA.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      AWS Cloud (us-east-1)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   us-east-1a │  │   us-east-1b │  │   us-east-1c│      │
│  │  ┌────────┐  │  │  ┌────────┐  │  │  ┌────────┐ │      │
│  │  │Wenyan  │  │  │  │Wenyan  │  │  │  │Wenyan  │ │      │
│  │  │Pod 1   │  │  │  │Pod 2   │  │  │  │Pod 3   │ │      │
│  │  │(Leader)│  │  │  │(Follow)│  │  │  │(Follow)│ │      │
│  │  └───┬────┘  │  │  └───┬────┘  │  │  └───┬────┘ │      │
│  │      │EBS    │  │      │EBS    │  │      │EBS   │      │
│  │  ┌───┴────┐  │  │  ┌───┴────┐  │  │  ┌───┴────┐ │      │
│  │  │SQLite  │  │  │  │SQLite  │  │  │  │SQLite  │ │      │
│  │  │WAL Mode│  │  │  │WAL Mode│  │  │  │WAL Mode│ │      │
│  │  └────────┘  │  │  └────────┘  │  │  └────────┘ │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│           │              │              │                   │
│           └──────────────┼──────────────┘                   │
│                          │                                  │
│                   ┌──────┴──────┐                          │
│                   │    NLB      │                          │
│                   │ (TCP 8080)  │                          │
│                   └──────┬──────┘                          │
│                          │                                  │
│  ┌───────────────────────┼─────────────────────────┐        │
│  │         Kubernetes (EKS)                        │        │
│  │  ┌────────────────────┴────────────────────┐   │        │
│  │  │      Wenyan Operator (Custom Controller) │   │        │
│  │  │  - Manages StatefulSet                   │   │        │
│  │  │  - Handles Merkle sync on pod restart    │   │        │
│  │  │  - Automated backups to S3               │   │        │
│  │  └──────────────────────────────────────────┘   │        │
│  └──────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              AWS KMS (Hardware Security Module)              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Genesis Key (Seal 6 Imperial Authority)                │ │
│  │  - Never leaves HSM                                     │ │
│  │  - Access via IAM Roles                                 │ │
│  │  - Multi-sig: 2-of-3 officers required                  │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- **AWS Account** with IAM admin access
- **Tools**: Terraform ≥1.5, kubectl, AWS CLI configured
- **Domains**: `wenyan.yourcompany.com` pointing to AWS
- **Budget**: ~$300/month for 3-node HA setup (3× m6g.large, EBS gp3, NLB, KMS)

## Phase 1: Infrastructure with Terraform (45 minutes)

### 1. Clone the Wenyan Infrastructure Repository

```bash
git clone https://github.com/andrey-kokoev/wenyan-terraform.git
cd wenyan-terraform/examples/aws-ha
```

### 2. Configure Variables

Create `terraform.tfvars`:

```hcl
# General
aws_region = "us-east-1"
cluster_name = "wenyan-production"
domain_name = "wenyan.yourcompany.com"

# Node Configuration
node_count = 3
instance_type = "m6g.large"  # Graviton2 for cost/performance
ebs_volume_size = 100  # GB per node

# Genesis Security (Multi-sig)
genesis_key_multi_sig = true
genesis_key_officers = [
  "arn:aws:iam::123456789012:user/architect-alice",
  "arn:aws:iam::123456789012:user/minister-bob", 
  "arn:aws:iam::123456789012:user/censor-carol"
]
genesis_key_threshold = 2  # 2-of-3 to unseal genesis key

# Backup
s3_backup_bucket = "wenyan-dangan-backups-yourcompany"
backup_retention_days = 2555  # 7 years for compliance

# Monitoring
enable_prometheus = true
grafana_admin_password = "CHANGE-ME-IN-PRODUCTION"
```

### 3. Deploy Infrastructure

```bash
terraform init
terraform plan -out=tfplan
terraform apply tfplan

# Outputs:
# - EKS cluster endpoint
# - NLB DNS name
# - KMS key ID for genesis
# - S3 backup bucket ARN
```

This creates:
- **EKS cluster** (3 AZs, managed node groups)
- **DynamoDB** for node discovery (alternative to gossip seeds in dynamic K8s)
- **S3** for cold storage (Qiankan) and backups
- **KMS** with multi-sig policy for genesis key
- **NLB** (Network Load Balancer) for TCP 8080/7946
- **Security Groups**: Inter-node gossip allowed, external only to 8080

### 4. Configure kubectl

```bash
aws eks --region us-east-1 update-kubeconfig --name wenyan-production
kubectl get nodes  # Verify 3 nodes ready
```

## Phase 2: Deploy Wenyan Operator (30 minutes)

### 5. Install the Operator

```bash
kubectl apply -f https://raw.githubusercontent.com/andrey-kokoev/wenyan-operator/v1.0.0/deploy/crds.yaml
kubectl apply -f https://raw.githubusercontent.com/andrey-kokoev/wenyan-operator/v1.0.0/deploy/operator.yaml

# Verify operator running
kubectl get pods -n wenyan-system
```

### 6. Create the WenyanConsort Custom Resource

Create `consort.yaml`:

```yaml
apiVersion: wenyan.dev/v1
kind: WenyanConsort
metadata:
  name: imperial-works-production
  namespace: default
spec:
  replicas: 3
  version: "1.0.0"
  
  # Constitutional configuration
  genesis:
    kmsKeyId: "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012"
    realm: "enterprise-production"
    consensus:
      kind: "pbft"
      constitutionalThreshold: 2  # 2-of-3
    
  # Storage configuration
  storage:
    type: "ebs"
    size: "100Gi"
    storageClass: "gp3-encrypted"
    walMode: true
    
  # Backup to S3 (Qiankan)
  backup:
    enabled: true
    s3Bucket: "wenyan-dangan-backups-yourcompany"
    schedule: "0 2 * * *"  # Daily at 2 AM
    coldStorageAfterDays: 90  # Archive to Glacier
    
  # Service exposure
  service:
    type: "LoadBalancer"
    annotations:
      service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
      service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled: "true"
  
  # Monitoring
  monitoring:
    prometheus:
      enabled: true
      scrapeInterval: "15s"
    grafana:
      enabled: true
      dashboards:
        - "imperial-overview"
        - "tongzheng-si"
        - "dangan-health"
  
  # Resource limits (production-grade)
  resources:
    requests:
      memory: "2Gi"
      cpu: "1000m"
    limits:
      memory: "4Gi"
      cpu: "2000m"
```

Deploy:
```bash
kubectl apply -f consort.yaml

# Wait for pods to be ready (5-10 minutes)
kubectl get pods -w
# NAME                      READY   STATUS
# wenyan-0                  2/2     Running   # Leader (Beijing)
# wenyan-1                  2/2     Running   # Follower (Nanjing)
# wenyan-2                  2/2     Running   # Follower (Shanghai)
```

### 7. Verify the Consort

```bash
# Port-forward to access CLI
kubectl port-forward pod/wenyan-0 8080:8080

# In another terminal
wenyan --endpoint http://localhost:8080 consort status
# Should show all 3 nodes with matching Merkle roots

# Check HSM integration (genesis key in KMS, not in pod)
kubectl logs wenyan-0 -c wenyan | grep "KMS"
# Expected: "Genesis key loaded from AWS KMS (multi-sig: 2-of-3)"
```

## Phase 3: Operational Procedures (45 minutes)

### 8. Backup and Disaster Recovery

**Automated**: Operator handles S3 backups daily.

**Manual backup**:
```bash
kubectl exec wenyan-0 -- wenyan admin backup --s3 s3://wenyan-dangan-backups-yourcompany/manual-$(date +%s)
```

**Disaster recovery** (total cluster loss):
```bash
# Provision new cluster with same Terraform
# Restore from S3
kubectl exec wenyan-0 -- wenyan admin restore --from s3://wenyan-dangan-backups-yourcompany/latest/
# Pods will automatically Merkle-sync with each other
```

### 9. Scaling (Adding Nodes)

Edit `consort.yaml`:
```yaml
spec:
  replicas: 5  # Increased from 3
```

Apply:
```bash
kubectl apply -f consort.yaml
# Operator creates wenyan-3 and wenyan-4 pods
# New nodes automatically join via gossip and sync Merkle tree
```

### 10. Upgrading (Rolling Update)

Change version:
```yaml
spec:
  version: "1.0.1"  # Patch release
```

Apply:
```bash
kubectl apply -f consort.yaml
# Operator performs rolling restart:
# 1. Cordon wenyan-2 (stop new traffic)
# 2. Update pod to 1.0.1
# 3. Wait for Merkle sync with remaining 1.0.0 nodes
# 4. Verify health, uncordon
# 5. Repeat for wenyan-1, then wenyan-0 (leader last)
```

## Phase 4: Security & Compliance Hardening

### 11. Network Policies

Restrict pod-to-pod communication:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: wenyan-consort
spec:
  podSelector:
    matchLabels:
      app: wenyan
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: wenyan
    ports:
    - protocol: TCP
      port: 7946  # Gossip only
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: wenyan
```

### 12. Audit Logging to CloudWatch

```yaml
spec:
  auditLogging:
    enabled: true
    destination: "cloudwatch"
    cloudwatch:
      logGroup: "/wenyan/imperial-works-production"
      retentionDays: 2555  # 7 years compliance
```

### 13. Genesis Key Ceremony (Multi-sig)

To perform constitutional amendment (ti_definition change):

```bash
# Officer 1 (Alice) initiates
wenyan --kms-key-id $KMS_KEY_ID_1 constitution amend --file new-building-code.json

# Officer 2 (Bob) approves (required for 2-of-3 threshold)
wenyan --kms-key-id $KMS_KEY_ID_2 constitution approve --amendment-id <id>

# Amendment automatically propagated to all nodes via PBFT
```

## Monitoring Stack

Access Grafana:
```bash
kubectl port-forward svc/wenyan-grafana 3000:3000
# Open http://localhost:3000 (password from terraform.tfvars)
```

Key dashboards:
- **Imperial Overview**: Consort health, seal throughput, Byzantine suspicion scores
- **Tongzheng Si**: Gateway admission rates, rejection reasons (403, 503)
- **Dang'an Health**: SQLite WAL size, Merkle sync lag, S3 cold storage status

Critical alerts (PagerDuty integration):
- `WenyanMerkleDrift > 5 minutes`: Nodes disagree on state (split brain risk)
- `WenyanGenesisKeyUnsealFailed`: Cannot reach KMS (consensus halted)
- `WenyanColdStorageLag > 24h`: Qiankan backup failing (compliance risk)

## Cost Optimization

**Development**: Use the Docker Compose guide (~$36/mo for 3× VPS).

**Production**: This setup (~$300/mo) provides:
- 99.9% SLA (3 AZs, health checks, auto-restart)
- HSM-backed keys (KMS, not software)
- 7-year audit retention (S3 Glacier)
- Horizontal scaling to 50+ nodes

**To reduce costs**:
- Use `t3.medium` instead of `m6g.large` (~$150/mo, less throughput)
- Single AZ for non-critical workloads (saves 66% on inter-AZ data transfer)
- Disable Grafana hosted, use existing Prometheus instance

## Troubleshooting

**Pod stuck in `Pending`**:
```bash
kubectl describe pod wenyan-0
# Check: EBS volume available in AZ? Insufficient CPU?
```

**Merkle sync never completes**:
```bash
kubectl logs wenyan-1 -c wenyan | grep "merkle"
# Likely: Network partition between pods. Check Security Group rules (port 7946).
```

**KMS access denied**:
```bash
kubectl logs wenyan-0 -c wenyan
# Ensure node IAM role has kms:Decrypt permission for the genesis key.
```

## Next Steps

- **Load testing**: Run Imperial Works simulation at 10x scale
- **Disaster recovery drill**: Simulate AZ outage, verify automatic failover
- **Compliance audit**: Export 7 years of CloudWatch logs for regulatory review