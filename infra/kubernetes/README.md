# Kubernetes Configurations

This directory contains Kubernetes manifests for deploying FitVibe to a Kubernetes cluster. These configurations are environment-agnostic and can be customized per environment using namespaces and ConfigMaps.

## Files Overview

| File                       | Purpose              | Description                                     |
| -------------------------- | -------------------- | ----------------------------------------------- |
| `namespace.yaml`           | Namespace definition | Creates the FitVibe namespace                   |
| `backend-deployment.yaml`  | Backend service      | Express API deployment configuration            |
| `frontend-deployment.yaml` | Frontend service     | React SPA deployment configuration              |
| `postgres-deployment.yaml` | Database             | PostgreSQL deployment (for development/staging) |
| `redis-deployment.yaml`    | Cache                | Redis deployment (optional)                     |
| `ingress.yaml`             | Ingress controller   | Routes external traffic to services             |
| `configmap.yaml`           | Configuration        | Non-sensitive configuration data                |
| `secrets-template.yaml`    | Secrets template     | Template for sensitive data (not committed)     |

## Prerequisites

- Kubernetes cluster (1.24+)
- `kubectl` configured to access the cluster
- Ingress controller installed (e.g., NGINX Ingress)
- Storage class for persistent volumes (for PostgreSQL)

## Quick Start

### 1. Create Namespace

```bash
kubectl apply -f infra/kubernetes/namespace.yaml
```

### 2. Create Secrets

Copy the secrets template and fill in values:

```bash
cp infra/kubernetes/secrets-template.yaml infra/kubernetes/secrets.yaml
# Edit secrets.yaml with actual values
kubectl apply -f infra/kubernetes/secrets.yaml
```

**Important**: Never commit `secrets.yaml` to the repository. Use a secrets management system in production.

### 3. Create ConfigMap

```bash
kubectl apply -f infra/kubernetes/configmap.yaml
```

### 4. Deploy Services

```bash
# Database (for development/staging)
kubectl apply -f infra/kubernetes/postgres-deployment.yaml

# Backend
kubectl apply -f infra/kubernetes/backend-deployment.yaml

# Frontend
kubectl apply -f infra/kubernetes/frontend-deployment.yaml

# Ingress
kubectl apply -f infra/kubernetes/ingress.yaml
```

## Configuration

### Environment Variables

Environment variables are set via:

- **ConfigMap**: Non-sensitive configuration (see `configmap.yaml`)
- **Secrets**: Sensitive data (see `secrets-template.yaml`)

### Resource Limits

Each deployment includes resource requests and limits:

- **Backend**: 512Mi-2Gi memory, 0.5-1 CPU
- **Frontend**: 128Mi-512Mi memory, 0.25-0.5 CPU
- **PostgreSQL**: 1Gi-4Gi memory, 1-2 CPU

Adjust based on your cluster capacity and workload.

### Scaling

Scale deployments using `kubectl`:

```bash
# Scale backend to 3 replicas
kubectl scale deployment fitvibe-backend --replicas=3 -n fitvibe

# Use HorizontalPodAutoscaler for automatic scaling
kubectl apply -f infra/kubernetes/hpa.yaml  # (if created)
```

## Health Checks

All deployments include:

- **Liveness probes**: Restart containers if unhealthy
- **Readiness probes**: Remove from service if not ready

### Backend Health Endpoint

```yaml
livenessProbe:
  httpGet:
    path: /api/v1/health
    port: 4000
readinessProbe:
  httpGet:
    path: /api/v1/health
    port: 4000
```

### Frontend Health Check

```yaml
livenessProbe:
  httpGet:
    path: /
    port: 80
```

## Ingress Configuration

The ingress configuration routes traffic:

- `/api/*` → Backend service
- `/*` → Frontend service

### TLS/HTTPS

To enable HTTPS:

1. Install cert-manager
2. Create a Certificate resource
3. Update `ingress.yaml` with TLS configuration:

```yaml
tls:
  - hosts:
      - fitvibe.example.com
    secretName: fitvibe-tls
```

## Database Considerations

### Production Database

For production, use a managed PostgreSQL service (e.g., AWS RDS, Google Cloud SQL, Azure Database) instead of the in-cluster deployment.

Update `backend-deployment.yaml` to use external database connection:

```yaml
env:
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: fitvibe-secrets
        key: database-url
```

### Development/Staging

The `postgres-deployment.yaml` is suitable for:

- Development environments
- Staging/testing
- Local Kubernetes clusters

**Note**: Data persistence uses PersistentVolumes. Ensure your cluster has a verified encrypted StorageClass suited to the real cluster. An obsolete AWS EBS StorageClass placeholder was removed.

## Monitoring and Observability

### Service Discovery

Services are discoverable via DNS:

- `fitvibe-backend.fitvibe.svc.cluster.local:4000`
- `fitvibe-frontend.fitvibe.svc.cluster.local:80`
- `fitvibe-postgres.fitvibe.svc.cluster.local:5432`

### Logs

View logs:

```bash
# Backend logs
kubectl logs -f deployment/fitvibe-backend -n fitvibe

# All pods
kubectl logs -f -l app=fitvibe-backend -n fitvibe
```

### Metrics

Integrate with Prometheus (see [`../observability/README.md`](../observability/README.md)):

- ServiceMonitor resources for Prometheus Operator
- Pod annotations for scraping
- Custom metrics endpoints

## Security Best Practices

1. **Use Secrets**: Never hardcode sensitive data in manifests
2. **RBAC**: Implement Role-Based Access Control
3. **Network Policies**: Restrict pod-to-pod communication
4. **Pod Security Standards**: Enforce security contexts
5. **Image Scanning**: Scan container images for vulnerabilities
6. **Non-root users**: All containers run as non-root

## Updates and Rollouts

### Rolling Updates

Kubernetes performs rolling updates by default:

```bash
# Update image
kubectl set image deployment/fitvibe-backend backend=fitvibe-backend:v2.0.1 -n fitvibe

# Monitor rollout
kubectl rollout status deployment/fitvibe-backend -n fitvibe
```

### Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/fitvibe-backend -n fitvibe

# Rollback to specific revision
kubectl rollout undo deployment/fitvibe-backend --to-revision=2 -n fitvibe
```

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl get pods -n fitvibe

# Describe pod for events
kubectl describe pod <pod-name> -n fitvibe

# Check logs
kubectl logs <pod-name> -n fitvibe
```

### Service Not Accessible

```bash
# Check service endpoints
kubectl get endpoints -n fitvibe

# Test service from within cluster
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- curl http://fitvibe-backend:4000/api/v1/health
```

### Database Connection Issues

1. Verify PostgreSQL pod is running
2. Check service endpoints
3. Verify secrets contain correct connection string
4. Test connection from backend pod

## CI/CD Integration

These manifests can be used in CI/CD pipelines:

```bash
# In CI/CD pipeline
kubectl apply -f infra/kubernetes/ --namespace=fitvibe-staging
kubectl rollout status deployment/fitvibe-backend -n fitvibe-staging
```

Consider using:

- **Helm**: For templating and versioning
- **Kustomize**: For environment-specific overlays
- **ArgoCD/Flux**: For GitOps deployments

## Related Documentation

- [Infrastructure README](../README.md)
- [Docker Configurations](../docker/README.md)
- [Observability Stack](../observability/README.md)
- [Backend README](../../apps/backend/README.md)
