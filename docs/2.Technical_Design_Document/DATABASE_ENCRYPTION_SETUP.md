# Database Encryption Setup Guide

**Current deployment notice (2026-11-02):** The cloud-provider and AWS EBS examples below are historical design references, not installed infrastructure. The `infra/kubernetes/storage-class-encrypted.yaml` placeholder was removed. FitVibe currently uses local PostgreSQL in Docker Compose; encryption at rest depends on the Raspberry Pi host and disk configuration and must be verified separately. Do not interpret the examples below as evidence that volume encryption is enabled.

This guide explains how to configure database encryption (in transit and at rest) for FitVibe.

## Overview

FitVibe implements comprehensive database encryption:

- **Encryption in Transit**: TLS/SSL encryption for all database connections
- **Encryption at Rest**: Encrypted storage volumes for database data

See [ADR-023](../2.f.Architectural_Decision_Documentation/ADR-026-database-encryption.md) for the architectural decision.

## Encryption in Transit

### Configuration

SSL/TLS encryption is controlled via environment variables:

| Variable                    | Description                                                | Required | Default |
| --------------------------- | ---------------------------------------------------------- | -------- | ------- |
| `PGSSL`                     | Enable SSL/TLS (`true`/`false`)                            | No       | `false` |
| `PGSSL_REJECT_UNAUTHORIZED` | Force certificate verification outside production (`true`) | No       | -       |
| `PGSSL_CA`                  | Path or PEM for CA certificate                             | No       | -       |
| `PGSSL_CERT`                | Path or PEM for client certificate (mutual TLS)            | No       | -       |
| `PGSSL_KEY`                 | Path or PEM for client key (mutual TLS)                    | No       | -       |
| `NODE_ENV`                  | Environment (`production`/`development`/`test`)            | Yes      | -       |

### Environment-Specific Behavior

**Production (`NODE_ENV=production`):**

- SSL is **required** when `PGSSL=true`
- Certificate verification is **enabled** (`rejectUnauthorized: true`)
- CA certificate should be provided via `PGSSL_CA`

**Development/Test:**

- SSL is **optional**
- Self-signed certificates are **allowed** (`rejectUnauthorized: false`)
- Useful for local development with self-signed certificates

### Example Configuration

**Production:**

```bash
NODE_ENV=production
PGSSL=true
PGSSL_CA=/etc/ssl/certs/ca-cert.pem
# Optional: For mutual TLS
PGSSL_CERT=/etc/ssl/certs/client-cert.pem
PGSSL_KEY=/etc/ssl/private/client-key.pem
```

**Development:**

```bash
NODE_ENV=development
PGSSL=true  # Optional, allows self-signed certificates
```

### PostgreSQL Server SSL Setup

To enable SSL on the PostgreSQL server, configure `postgresql.conf`:

```conf
ssl = on
ssl_cert_file = '/var/lib/postgresql/server.crt'
ssl_key_file = '/var/lib/postgresql/server.key'
ssl_ca_file = '/var/lib/postgresql/ca.crt'  # Optional
```

Generate self-signed certificates for development:

```bash
# Generate CA
openssl req -new -x509 -days 3650 -nodes -text -out ca.crt \
  -keyout ca.key -subj "/CN=postgres-ca"

# Generate server certificate
openssl req -new -nodes -text -out server.csr -keyout server.key \
  -subj "/CN=postgres-server"

# Sign server certificate
openssl x509 -req -in server.csr -text -days 3650 \
  -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt
```

## Encryption at Rest

### Docker Compose

For Docker deployments, encryption is handled at the infrastructure level:

```yaml
volumes:
  db_data:
    # Encryption depends on Docker host configuration
    # For cloud providers, use encrypted EBS/disk volumes
```

**AWS:**

- Use encrypted EBS volumes
- Encryption is enabled by default for new volumes

**GCP:**

- Use encrypted persistent disks
- Encryption keys managed by Google Cloud KMS

**Azure:**

- Use encrypted managed disks
- Encryption enabled by default

### Kubernetes

For Kubernetes deployments, use an encrypted storage class:

1. **Apply the encrypted storage class:**

   ```bash
   kubectl apply -f infra/kubernetes/storage-class-encrypted.yaml
   ```

2. **Update PersistentVolumeClaim to use encrypted storage:**

   ```yaml
   storageClassName: encrypted-ssd
   ```

3. **Cloud Provider Specific Configuration:**

   **AWS EKS:**

   ```yaml
   apiVersion: storage.k8s.io/v1
   kind: StorageClass
   metadata:
     name: encrypted-ssd
   provisioner: kubernetes.io/aws-ebs
   parameters:
     type: gp3
     encrypted: "true"
   ```

   **GCP GKE:**

   ```yaml
   apiVersion: storage.k8s.io/v1
   kind: StorageClass
   metadata:
     name: encrypted-ssd
   provisioner: kubernetes.io/gce-pd
   parameters:
     type: pd-ssd
     encryptionKey: projects/PROJECT_ID/locations/LOCATION/keyRings/KEY_RING/cryptoKeys/KEY_NAME
   ```

   **Azure AKS:**

   ```yaml
   apiVersion: storage.k8s.io/v1
   kind: StorageClass
   metadata:
     name: encrypted-ssd
   provisioner: kubernetes.io/azure-disk
   parameters:
     storageaccounttype: Premium_LRS
     kind: managed
     # Encryption is enabled by default on Azure managed disks
   ```

## Backup Encryption

Database backups should also be encrypted. See [E10: Availability & Backups](../../1.Product_Requirements/b.Epics/E10-availability-and-backups.md) for backup encryption requirements.

Example encrypted backup script:

```bash
# Create encrypted backup
pg_dump -h $PGHOST -U $PGUSER -d $PGDATABASE | \
  gzip | \
  openssl enc -aes-256-gcm -salt -pbkdf2 -out backup-$(date +%Y%m%d).sql.gz.enc

# Restore encrypted backup
openssl enc -d -aes-256-gcm -pbkdf2 -in backup-20251221.sql.gz.enc | \
  gunzip | \
  psql -h $PGHOST -U $PGUSER -d $PGDATABASE
```

## Testing SSL Configuration

Run the SSL configuration tests:

```bash
pnpm --filter @fitvibe/backend test tests/backend/db/db.config.test.ts
```

## Troubleshooting

### SSL Connection Errors

1. **Check SSL is enabled:**

   ```bash
   echo $PGSSL
   ```

2. **Verify certificate paths:**

   ```bash
   ls -la $PGSSL_CA
   ls -la $PGSSL_CERT  # If using mutual TLS
   ls -la $PGSSL_KEY   # If using mutual TLS
   ```

3. **Test SSL connection:**

   ```bash
   psql "host=$PGHOST port=$PGPORT dbname=$PGDATABASE user=$PGUSER sslmode=require"
   ```

4. **Check PostgreSQL SSL configuration:**
   ```sql
   SHOW ssl;
   ```

### Performance Impact

Encryption overhead should be ≤5%. Monitor performance:

```bash
# Benchmark query performance
psql -c "EXPLAIN ANALYZE SELECT * FROM users LIMIT 1000;"
```

## Related Documentation

- [ADR-023: Database Encryption](../2.f.Architectural_Decision_Documentation/ADR-026-database-encryption.md)
- [E20: Database Encryption Epic](../../1.Product_Requirements/b.Epics/E20-database-encryption.md)
- [NFR-008: Database Encryption](../../1.Product_Requirements/a.Requirements/NFR-008-database-encryption.md)
- [KEY_MANAGEMENT_POLICY.md](../../5.Policies/5.a.Ops/KEY_MANAGEMENT_POLICY.md)
