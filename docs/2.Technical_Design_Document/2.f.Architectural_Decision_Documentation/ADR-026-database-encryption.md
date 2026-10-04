# ADR-026: Database Encryption (In Transit and At Rest)

> Formerly numbered ADR-023; that ID is reserved for Server-Side Rendering.

**Date:** 2025-12-21  
**Status:** Accepted  
**Author:** FitVibe Development Team  
**Cross-References:** [NFR-008](../1.Product_Requirements/a.Requirements/NFR-008-database-encryption.md), [E20](../1.Product_Requirements/b.Epics/E20-database-encryption.md), TDD §3.4, §5.1, §9

---

## Context

Currently, FitVibe's database connections do not enforce SSL/TLS encryption, and database storage volumes are not encrypted at rest. This creates security vulnerabilities:

1. **Encryption in Transit**: Database connections may be unencrypted, exposing sensitive data during transmission
2. **Encryption at Rest**: Database files stored on disk are unencrypted, making data vulnerable if physical access is compromised

This violates security best practices and compliance requirements (GDPR, SOC 2, ISO 27001). The system needs comprehensive database encryption to protect user data both during transmission and when stored.

## Decision

We will implement comprehensive database encryption using a two-pronged approach:

### Encryption in Transit

1. **TLS/SSL Configuration**: All database connections will use TLS 1.3 (minimum TLS 1.2) with certificate verification enabled in production
2. **Environment-Specific Configuration**:
   - Production: Strict SSL with certificate verification (`rejectUnauthorized: true`)
   - Development: Relaxed SSL for local development (self-signed certificates allowed)
3. **Configuration Management**: SSL settings controlled via environment variables (`PGSSL`, `PGSSLMODE`, optional `PGSSL_CA`, `PGSSL_CERT`, `PGSSL_KEY`)
4. **Implementation**: Update `apps/backend/src/db/db.config.ts` and `apps/backend/src/db/knexfile.ts` to support secure SSL configuration

### Encryption at Rest

1. **Filesystem-Level Encryption**: Use encrypted storage volumes (encrypted EBS volumes, encrypted Kubernetes PersistentVolumes, or cloud provider managed encryption)
2. **Backup Encryption**: All database backups encrypted using AES-256
3. **Key Management**: Encryption keys managed according to KEY_MANAGEMENT_POLICY.md (rotation every 6 months)
4. **Performance Target**: Encryption overhead must not exceed 5% (measured via benchmarks)

### Application-level protection for recoverable authentication secrets

Phase 15 adds a narrower application-level control for TOTP seeds. This does **not** replace filesystem/database-volume encryption; it is defense in depth for a secret that must remain recoverable by the application.

- Persisted TOTP seeds are stored as versioned AES-256-GCM authenticated-encryption envelopes.
- Encryption key material is supplied through application secret/configuration mechanisms and is never stored alongside the ciphertext.
- Runtime authentication refuses plaintext TOTP seeds.
- Existing plaintext seeds are migrated forward to encrypted envelopes; rollback must not recreate plaintext.
- Envelope versioning permits an explicit future key/format migration rather than silently changing ciphertext semantics.
- The encryption key is operationally required anywhere TOTP is used or the plaintext-to-encrypted migration has work to perform.

This is intentionally field-level encryption for a recoverable credential secret. Other database fields remain governed by the filesystem/volume and backup encryption decision below unless a separate threat model justifies field-level encryption.

### Rationale

- **Security Compliance**: Meets GDPR, SOC 2, and ISO 27001 requirements for data protection
- **Defense in Depth**: Protects data both in transit and at rest
- **Minimal Performance Impact**: Filesystem encryption typically adds 2-5% overhead, which is acceptable
- **Standard Practice**: Industry-standard approach used by major cloud providers
- **Easy Implementation**: PostgreSQL and cloud providers provide built-in support for encryption

## Consequences

### Positive

- **Security**: Data protected during transmission and storage
- **Compliance**: Meets regulatory requirements (GDPR, SOC 2, ISO 27001)
- **User Trust**: Demonstrates commitment to data protection
- **Risk Mitigation**: Reduces risk of data breaches and unauthorized access

### Negative

- **Performance Overhead**: Encryption adds 1-5% performance overhead (acceptable)
- **Configuration Complexity**: SSL certificate management adds operational complexity
- **Cost**: Encrypted storage may have additional costs (minimal for most cloud providers)
- **Development Setup**: Local development requires SSL certificate setup (mitigated by relaxed SSL in dev)

### Trade-offs

- **Performance vs Security**: Acceptable 1-5% performance overhead for security benefits
- **Complexity vs Security**: Additional configuration complexity is justified by security requirements
- **Development vs Production**: Relaxed SSL in development balances security and developer experience

## Alternatives Considered

| Option                                       | Description                                            | Reason Rejected                                                                       |
| -------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Application-Level Encryption Only            | Encrypt specific sensitive fields at application level | Does not protect all data, complex key management, higher performance impact          |
| PostgreSQL TDE (Transparent Data Encryption) | Use PostgreSQL extensions for encryption               | More complex setup, requires additional extensions, higher performance impact (5-10%) |
| No Encryption                                | Accept risk of unencrypted data                        | Violates security best practices and compliance requirements                          |
| Managed Database Service Only                | Use cloud provider managed databases (RDS, Cloud SQL)  | Limits deployment flexibility, vendor lock-in, may not fit all deployment scenarios   |
| Encryption in Transit Only                   | Only implement SSL/TLS, skip at-rest encryption        | Incomplete protection, does not meet compliance requirements                          |

## References

- [NFR-008: Database Encryption](../1.Product_Requirements/a.Requirements/NFR-008-database-encryption.md)
- [E20: Database Encryption Epic](../1.Product_Requirements/b.Epics/E20-database-encryption.md)
- [KEY_MANAGEMENT_POLICY.md](../../5.Policies/5.a.Ops/KEY_MANAGEMENT_POLICY.md)
- TDD §3.4 (Backend Stack), §5.1 (Security), §9 (Infrastructure)
- PostgreSQL SSL Documentation: https://www.postgresql.org/docs/current/ssl-tcp.html
- AWS EBS Encryption: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/EBSEncryption.html
- Kubernetes Encrypted Volumes: https://kubernetes.io/docs/concepts/storage/volumes/#encrypted-volumes

---

## Status Log

| Version | Date       | Change        | Author                   |
| ------- | ---------- | ------------- | ------------------------ |
| v1.0    | 2025-12-21 | Initial draft | FitVibe Development Team |
| v1.1    | 2026-09-24 | Record Phase 15 field-level AES-256-GCM protection and forward-only migration policy for recoverable TOTP seeds | FitVibe Engineering / Product Owner |
