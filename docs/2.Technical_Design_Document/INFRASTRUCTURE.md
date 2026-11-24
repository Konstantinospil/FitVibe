# FitVibe Infrastructure Deployment Guide

**Status: Legacy cloud/Kubernetes design reference — NOT an active deployment runbook (2026-11-02).** The sections below describe an unimplemented AWS-based target and include provider-specific examples. FitVibe's operative deployment uses Docker Compose on a private Raspberry Pi; follow [`infra/docker/prod/README.md`](../../infra/docker/prod/README.md) and [`infra/docker/prod/compose.yml`](../../infra/docker/prod/compose.yml). AWS Secrets Manager integration, S3 backup upload and AWS EBS StorageClass provisioning have been removed. Do not execute the AWS CLI examples below as deployment instructions.

This document provides comprehensive instructions for deploying FitVibe infrastructure across all environments.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Local Development Setup](#local-development-setup)
4. [Kubernetes Production Deployment](#kubernetes-production-deployment)
5. [Monitoring & Observability](#monitoring--observability)
6. [Disaster Recovery](#disaster-recovery)
7. [Troubleshooting](#troubleshooting)

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                         Internet                             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                   NGINX Ingress / ALB                        │
│                   (TLS Termination)                          │
└───────┬─────────────────────────────────────┬───────────────┘
        │                                     │
        ↓                                     ↓
┌──────────────────┐              ┌──────────────────────┐
│   Frontend       │              │   Backend API        │
│   (React/Vite)   │◄────────────►│   (Node/Express)     │
│   Replicas: 2-6  │              │   Replicas: 3-10     │
└──────────────────┘              └──────┬───────────────┘
                                         │
                    ┌────────────────────┼───────────────┐
                    ↓                    ↓               ↓
            ┌──────────────┐    ┌──────────────┐  ┌────────────┐
            │  PostgreSQL  │    │    Redis     │  │  S3/Object │
            │  (Primary)   │    │   (Cache)    │  │  Storage   │
            └──────────────┘    └──────────────┘  └────────────┘
                    ↓
            ┌──────────────┐
            │  PostgreSQL  │
            │  (Replica)   │
            └──────────────┘
```

### Infrastructure Components

| Component      | Purpose                        | HA Strategy                        | Backup                         |
| -------------- | ------------------------------ | ---------------------------------- | ------------------------------ |
| **Frontend**   | React SPA served via NGINX     | 2-6 replicas, HPA                  | Image registry                 |
| **Backend**    | Express API server             | 3-10 replicas, HPA                 | Image registry                 |
| **PostgreSQL** | Primary database               | Master-replica, automated failover | Daily snapshots, WAL archiving |
| **Redis**      | Cache and session storage      | Single instance (or cluster)       | RDB snapshots (hourly)         |
| **NGINX**      | Reverse proxy, TLS termination | 2+ replicas                        | Config in git                  |
| **Prometheus** | Metrics collection             | 2 replicas                         | 30-day retention               |
| **Grafana**    | Metrics visualization          | 2 replicas                         | Dashboards in git              |

## Prerequisites

### Required Tools

**For Local Development:**

- Docker 24+ & Docker Compose 2.20+
- Node.js 24 LTS
- PNPM 10+
- PostgreSQL 15+ client (`psql`)

**For Kubernetes Deployment:**

- `kubectl` 1.28+
- `helm` 3.12+
- Cloud provider CLI:
  - AWS: `aws-cli` 2.x
  - GCP: `gcloud` SDK
  - Azure: `az` CLI
- `kubeseal` (for sealed-secrets)
- `jq` (for JSON parsing)

### Access Requirements

**Development:**

- GitHub repository access
- Local admin privileges (for Docker)

**Production:**

- Cloud provider account with admin IAM role
- Kubernetes cluster access (RBAC: cluster-admin initially, namespace-scoped later)
- GitHub Container Registry access (GHCR)
- Domain DNS control (for TLS certificates)

## Local Development Setup

### Quick Start with Docker Compose

1. **Clone repository**:

```bash
git clone https://github.com/Konstantinospil/FitVibe-v2.git
cd FitVibe-v2
```

2. **Configure environment**:

```bash
# Copy example environment files
cp .env.example .env
cp apps/frontend/.env.example apps/frontend/.env.local

# Generate JWT keys
mkdir -p infra/keys
openssl genrsa -out infra/keys/jwt_rs256.key 4096
openssl rsa -in infra/keys/jwt_rs256.key -pubout -out infra/keys/jwt_rs256.pub

# Update .env with your configuration
# Minimal required changes:
# - DATABASE_URL (if using external database)
# - SMTP credentials (for email features)
```

3. **Start all services**:

```bash
# Start full stack (PostgreSQL, Redis, Backend, Frontend, Prometheus, Grafana)
docker-compose up -d

# View logs
docker-compose logs -f backend frontend

# Check service health
curl http://localhost:4000/health
curl http://localhost:3000
```

4. **Run database migrations**:

```bash
# Install dependencies
pnpm install

# Run migrations
pnpm tsx apps/backend/src/db/scripts/migrate.ts

# Seed database (optional)
pnpm tsx apps/backend/src/db/scripts/seed.ts
```

5. **Access services**:

| Service     | URL                   | Credentials                    |
| ----------- | --------------------- | ------------------------------ |
| Frontend    | http://localhost:3000 | Register new account           |
| Backend API | http://localhost:4000 | N/A (API endpoints)            |
| Prometheus  | http://localhost:9090 | None                           |
| Grafana     | http://localhost:3001 | admin / admin                  |
| PostgreSQL  | localhost:5432        | fitvibe / fitvibe_dev_password |
| Redis       | localhost:6379        | fitvibe_dev_redis              |

### Manual Development Setup (Without Docker)

1. **Start PostgreSQL**:

```bash
# macOS (Homebrew)
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb fitvibe
```

2. **Start Redis**:

```bash
# macOS (Homebrew)
brew install redis
brew services start redis

# Set password
redis-cli CONFIG SET requirepass fitvibe_dev_redis
```

3. **Install dependencies and run migrations**:

```bash
pnpm install
pnpm tsx apps/backend/src/db/scripts/migrate.ts
```

4. **Start backend**:

```bash
pnpm --filter @fitvibe/backend dev
# Runs on http://localhost:4000
```

5. **Start frontend** (in separate terminal):

```bash
pnpm --filter @fitvibe/frontend dev
# Runs on http://localhost:3000
```

## Kubernetes Production Deployment

### Cluster Setup

#### AWS EKS Example

```bash
# Install eksctl
brew install eksctl

# Create EKS cluster
eksctl create cluster \
  --name fitvibe-production \
  --region us-east-1 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 3 \
  --nodes-min 3 \
  --nodes-max 10 \
  --managed

# Configure kubectl
aws eks update-kubeconfig --region us-east-1 --name fitvibe-production

# Verify connectivity
kubectl get nodes
```

#### GKE Example

```bash
# Create GKE cluster
gcloud container clusters create fitvibe-production \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type n1-standard-2 \
  --enable-autoscaling \
  --min-nodes 3 \
  --max-nodes 10

# Get credentials
gcloud container clusters get-credentials fitvibe-production --zone us-central1-a

# Verify
kubectl get nodes
```

### Install Required Components

#### 1. NGINX Ingress Controller

```bash
# Add Helm repo
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# Install
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.metrics.enabled=true \
  --set controller.podAnnotations."prometheus\.io/scrape"=true \
  --set controller.podAnnotations."prometheus\.io/port"=10254

# Get LoadBalancer IP
kubectl get svc -n ingress-nginx ingress-nginx-controller
```

#### 2. Cert-Manager (for TLS certificates)

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Verify installation
kubectl get pods -n cert-manager

# ClusterIssuer is defined in infra/kubernetes/ingress.yaml
```

#### 3. External Secrets Operator

```bash
# Add Helm repo
helm repo add external-secrets https://charts.external-secrets.io
helm repo update

# Install
helm install external-secrets \
  external-secrets/external-secrets \
  -n external-secrets-system \
  --create-namespace

# Verify
kubectl get pods -n external-secrets-system
```

#### 4. Prometheus & Grafana

```bash
# Add Helm repo
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install Prometheus
helm install prometheus prometheus-community/prometheus \
  --namespace monitoring \
  --create-namespace \
  --values infra/prometheus/prometheus-values.yaml

# Install Grafana
helm install grafana grafana/grafana \
  --namespace monitoring \
  --values infra/grafana/grafana-values.yaml

# Get Grafana admin password
kubectl get secret --namespace monitoring grafana -o jsonpath="{.data.admin-password}" | base64 --decode
```

### Deploy FitVibe Application

#### 1. Create Namespace

```bash
kubectl apply -f infra/kubernetes/namespace.yaml
```

#### 2. Configure Secrets

**Option A: Using Sealed Secrets (Recommended for GitOps)**

```bash
# Install sealed-secrets controller
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/controller.yaml

# Create secret locally (DO NOT commit this file)
kubectl create secret generic fitvibe-secrets \
  --from-literal=postgres-user=fitvibe \
  --from-literal=postgres-password=YOUR_SECURE_PASSWORD \
  --from-literal=redis-password=YOUR_REDIS_PASSWORD \
  --from-file=jwt-private-key=./infra/keys/jwt_rs256.key \
  --from-file=jwt-public-key=./infra/keys/jwt_rs256.pub \
  --namespace=fitvibe \
  --dry-run=client -o yaml | \
  kubeseal --format yaml > infra/kubernetes/sealed-secrets-production.yaml

# Apply sealed secret (safe to commit)
kubectl apply -f infra/kubernetes/sealed-secrets-production.yaml
```

**Option B: Using External Secrets Operator**

```bash
# Store secrets in AWS Secrets Manager
aws secretsmanager create-secret \
  --name fitvibe/production/postgres \
  --secret-string '{"username":"fitvibe","password":"YOUR_SECURE_PASSWORD"}'

aws secretsmanager create-secret \
  --name fitvibe/production/redis \
  --secret-string '{"password":"YOUR_REDIS_PASSWORD"}'

# Create ExternalSecret resource (already configured in setup)
kubectl apply -f infra/kubernetes/external-secret.yaml
```

#### 3. Deploy ConfigMap

```bash
# Review and update configmap.yaml with production values
kubectl apply -f infra/kubernetes/configmap.yaml
```

#### 4. Deploy Database (PostgreSQL)

```bash
# Deploy PostgreSQL StatefulSet
kubectl apply -f infra/kubernetes/postgres-deployment.yaml

# Verify pods are running
kubectl get pods -n fitvibe -l app=postgres

# Run migrations
kubectl exec -it -n fitvibe postgres-0 -- psql -U fitvibe -d fitvibe -c "SELECT version();"

# From local machine (with access to pod):
export PGPASSWORD=$(kubectl get secret fitvibe-secrets -n fitvibe -o jsonpath='{.data.postgres-password}' | base64 -d)
export DATABASE_URL="postgresql://fitvibe:${PGPASSWORD}@$(kubectl get svc postgres -n fitvibe -o jsonpath='{.spec.clusterIP}'):5432/fitvibe"

pnpm tsx apps/backend/src/db/scripts/migrate.ts
```

#### 5. Deploy Redis

```bash
kubectl apply -f infra/kubernetes/redis-deployment.yaml

# Verify
kubectl get pods -n fitvibe -l app=redis
```

#### 6. Deploy Backend

```bash
# Build and push Docker image
docker build -t ghcr.io/konstantinospil/fitvibe-backend:latest -f apps/backend/Dockerfile .
docker push ghcr.io/konstantinospil/fitvibe-backend:latest

# Deploy to Kubernetes
kubectl apply -f infra/kubernetes/backend-deployment.yaml

# Watch rollout
kubectl rollout status deployment/backend -n fitvibe

# Check logs
kubectl logs -n fitvibe -l app=backend --tail=50 -f
```

#### 7. Deploy Frontend

```bash
# Build and push Docker image
docker build \
  --build-arg VITE_API_URL=https://api.fitvibe.com \
  -t ghcr.io/konstantinospil/fitvibe-frontend:latest \
  -f apps/frontend/Dockerfile .
docker push ghcr.io/konstantinospil/fitvibe-frontend:latest

# Deploy
kubectl apply -f infra/kubernetes/frontend-deployment.yaml

# Verify
kubectl rollout status deployment/frontend -n fitvibe
```

#### 8. Configure Ingress & TLS

```bash
# Update ingress.yaml with your domain
# Ensure DNS A records point to Ingress LoadBalancer IP

kubectl apply -f infra/kubernetes/ingress.yaml

# Watch cert-manager issue certificates
kubectl get certificate -n fitvibe --watch

# Verify HTTPS
curl -I https://fitvibe.com
curl -I https://api.fitvibe.com/health
```

### Verify Deployment

```bash
# Check all resources
kubectl get all -n fitvibe

# Check pod health
kubectl get pods -n fitvibe

# Check services
kubectl get svc -n fitvibe

# Check ingress
kubectl get ingress -n fitvibe

# Test backend health
curl https://api.fitvibe.com/health

# Test frontend
curl https://fitvibe.com

# Check logs for errors
kubectl logs -n fitvibe -l app=backend --tail=100 | grep -i error
kubectl logs -n fitvibe -l app=frontend --tail=100 | grep -i error
```

## Monitoring & Observability

### Prometheus Metrics

**Access Prometheus**:

```bash
# Port-forward to access locally
kubectl port-forward -n monitoring svc/prometheus-server 9090:80

# Open http://localhost:9090
```

**Key Metrics**:

- `http_request_duration_seconds` - API latency histogram
- `http_requests_total` - Total request count
- `jwt_refresh_reuse_total` - Refresh token reuse attempts
- `up` - Service availability (0 = down, 1 = up)
- `process_resident_memory_bytes` - Memory usage
- `nodejs_heap_size_used_bytes` - Node.js heap usage

### Grafana Dashboards

**Access Grafana**:

```bash
# Get admin password
kubectl get secret -n monitoring grafana -o jsonpath="{.data.admin-password}" | base64 -d

# Port-forward
kubectl port-forward -n monitoring svc/grafana 3000:80

# Open http://localhost:3000
# Login with admin / <password>
```

**Import Dashboards**:

1. Navigate to Dashboards → Import
2. Upload JSON files from `infra/grafana/dashboards/`
3. Select Prometheus datasource

### Alerts

**Prometheus Alert Rules** are defined in `infra/prometheus/alerts.yml`.

**Key Alerts**:

- **HighErrorRate**: 5xx rate > 1% for 5 minutes
- **HighAPILatency**: p95 latency > 600ms for 5 minutes
- **ServiceDown**: Service unavailable for 2 minutes
- **DatabaseConnectionPoolHigh**: > 80% pool utilization
- **HighMemoryUsage**: > 90% memory consumption

**Alert Notification**:

Configure Alertmanager to send notifications to Slack, PagerDuty, or email:

```yaml
# infra/prometheus/alertmanager-config.yaml
receivers:
  - name: "slack-notifications"
    slack_configs:
      - api_url: "YOUR_SLACK_WEBHOOK_URL"
        channel: "#fitvibe-alerts"
        text: "{{ .CommonAnnotations.summary }}"
```

### Logging

**Centralized Logging with Loki** (optional):

```bash
# Install Loki stack
helm repo add grafana https://grafana.github.io/helm-charts
helm install loki grafana/loki-stack \
  --namespace monitoring \
  --set promtail.enabled=true \
  --set grafana.enabled=false

# View logs in Grafana
# Add Loki datasource: http://loki:3100
# Use LogQL queries:
# {namespace="fitvibe", app="backend"} |= "error"
```

## Disaster Recovery

### Backup Strategy

#### Database Backups

**Automated Daily Snapshots**:

```bash
# AWS RDS (automated backups)
aws rds modify-db-instance \
  --db-instance-identifier fitvibe-production \
  --backup-retention-period 30 \
  --preferred-backup-window "03:00-04:00"

# Manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier fitvibe-production \
  --db-snapshot-identifier fitvibe-prod-$(date +%Y%m%d)

# GCP Cloud SQL
gcloud sql backups create \
  --instance=fitvibe-production \
  --description="Manual backup $(date)"
```

**WAL Archiving** (for point-in-time recovery):

```sql
-- Enable WAL archiving in PostgreSQL
ALTER SYSTEM SET wal_level = replica;
ALTER SYSTEM SET archive_mode = ON;
ALTER SYSTEM SET archive_command = 'aws s3 cp %p s3://fitvibe-wal-archive/%f';
SELECT pg_reload_conf();
```

#### Redis Backups

```bash
# Create RDB snapshot
kubectl exec -n fitvibe redis-0 -- redis-cli --pass $REDIS_PASSWORD BGSAVE

# Copy RDB file to S3
kubectl cp fitvibe/redis-0:/data/dump.rdb ./dump.rdb
aws s3 cp ./dump.rdb s3://fitvibe-redis-backups/dump-$(date +%Y%m%d).rdb
```

#### Secrets Backups

```bash
# Export all secrets (encrypted)
kubectl get secrets -n fitvibe -o yaml > secrets-backup.yaml

# Encrypt backup
gpg --symmetric --cipher-algo AES256 secrets-backup.yaml

# Store encrypted backup securely
aws s3 cp secrets-backup.yaml.gpg s3://fitvibe-secure-backups/
rm secrets-backup.yaml secrets-backup.yaml.gpg
```

### Recovery Procedures

#### Database Recovery

**Restore from snapshot**:

```bash
# AWS RDS
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier fitvibe-production-restored \
  --db-snapshot-identifier fitvibe-prod-20251113

# Point cluster to restored instance
kubectl edit configmap fitvibe-config -n fitvibe
# Update postgres-host to new endpoint
```

**Point-in-time recovery (PITR)**:

```bash
# Restore to specific timestamp
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier fitvibe-production \
  --target-db-instance-identifier fitvibe-prod-pitr \
  --restore-time 2025-11-13T10:30:00Z
```

#### Application Recovery

**Rollback deployment**:

```bash
# View deployment history
kubectl rollout history deployment/backend -n fitvibe

# Rollback to previous version
kubectl rollout undo deployment/backend -n fitvibe

# Rollback to specific revision
kubectl rollout undo deployment/backend -n fitvibe --to-revision=3
```

**Restore from image tag**:

```bash
# Deploy specific version
kubectl set image deployment/backend \
  backend=ghcr.io/konstantinospil/fitvibe-backend:v1.2.3 \
  -n fitvibe
```

## Troubleshooting

### Common Issues

#### 1. Pods Not Starting

**Symptoms**: Pods stuck in `Pending`, `CrashLoopBackOff`, or `ImagePullBackOff`

**Diagnosis**:

```bash
# Describe pod for events
kubectl describe pod <pod-name> -n fitvibe

# Check logs
kubectl logs <pod-name> -n fitvibe --previous

# Common causes:
# - Insufficient cluster resources (CPU/memory)
# - Image pull errors (check GHCR access)
# - Missing secrets/configmaps
# - Failed liveness/readiness probes
```

**Solutions**:

```bash
# Scale down other workloads to free resources
kubectl scale deployment/frontend --replicas=1 -n fitvibe

# Verify secret exists
kubectl get secret fitvibe-secrets -n fitvibe

# Check image exists
docker pull ghcr.io/konstantinospil/fitvibe-backend:latest

# Adjust resource requests/limits in deployment YAML
```

#### 2. Database Connection Failures

**Symptoms**: Backend logs show `ECONNREFUSED` or `connection timeout`

**Diagnosis**:

```bash
# Check PostgreSQL pod
kubectl get pods -n fitvibe -l app=postgres

# Test connection from backend pod
kubectl exec -it -n fitvibe <backend-pod> -- \
  psql -h postgres -U fitvibe -d fitvibe -c "SELECT 1"

# Check service DNS
kubectl exec -it -n fitvibe <backend-pod> -- nslookup postgres
```

**Solutions**:

```bash
# Verify database credentials
kubectl get secret fitvibe-secrets -n fitvibe -o jsonpath='{.data.postgres-password}' | base64 -d

# Check PostgreSQL logs
kubectl logs -n fitvibe postgres-0

# Restart PostgreSQL
kubectl delete pod postgres-0 -n fitvibe
```

#### 3. High Latency / Slow Responses

**Symptoms**: API responses > 1s, frontend loading slowly

**Diagnosis**:

```bash
# Check Prometheus metrics
# Query: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Check pod CPU/memory usage
kubectl top pods -n fitvibe

# Check database query performance
kubectl exec -n fitvibe postgres-0 -- \
  psql -U fitvibe -d fitvibe -c "SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
```

**Solutions**:

```bash
# Scale up replicas
kubectl scale deployment/backend --replicas=6 -n fitvibe

# Adjust HPA targets
kubectl edit hpa backend-hpa -n fitvibe

# Add database indexes (run migrations)
pnpm tsx apps/backend/src/db/scripts/migrate.ts
```

#### 4. Certificate Issues

**Symptoms**: `ERR_CERT_AUTHORITY_INVALID`, `NET::ERR_CERT_COMMON_NAME_INVALID`

**Diagnosis**:

```bash
# Check certificate status
kubectl get certificate -n fitvibe

# Describe certificate for errors
kubectl describe certificate fitvibe-tls -n fitvibe

# Check cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager
```

**Solutions**:

```bash
# Delete and recreate certificate
kubectl delete certificate fitvibe-tls -n fitvibe
kubectl apply -f infra/kubernetes/ingress.yaml

# Manually test ACME challenge
curl http://fitvibe.com/.well-known/acme-challenge/test
```

### Debugging Commands

```bash
# Interactive shell in pod
kubectl exec -it -n fitvibe <pod-name> -- /bin/sh

# Copy files from pod
kubectl cp fitvibe/<pod-name>:/app/logs ./logs

# Port-forward for local debugging
kubectl port-forward -n fitvibe svc/backend 4000:4000

# View cluster events
kubectl get events -n fitvibe --sort-by='.lastTimestamp'

# Restart deployment
kubectl rollout restart deployment/backend -n fitvibe
```

## References

- **CLAUDE.md**: Project overview and development guide
- **SECRETS_MANAGEMENT.md**: Secrets rotation and compliance
- **apps/docs/**: Detailed technical design documents
- **Kubernetes Docs**: https://kubernetes.io/docs/
- **Prometheus Docs**: https://prometheus.io/docs/

---

**Document Version**: 1.0
**Last Updated**: 2025-11-13
**Maintained By**: DevOps Team
