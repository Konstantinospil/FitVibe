# NFR-005 — Availability & Backups

---

**Requirement ID**: NFR-005  
**Type**: Non-Functional Requirement  
**Title**: Availability & Backups  
**Status**: Progressing  
**Priority**: High  
**Gate**: SILVER  
**Owner**: OPS/ENG  
**Created**: 2025-11-21  
**Updated**: 2026-09-25

---

## Executive Summary

This non-functional requirement defines operations standards and constraints for the FitVibe platform.

Ensure platform availability and data protection through backups and monitoring.

## Business Context

- **Business Objective**: Ensure platform availability and data protection through backups and monitoring.
- **Success Criteria**: 99.0% monthly uptime, backups succeed nightly, and restore drills validate RTO/RPO.
- **Target Users**: All users (availability affects everyone)

## Traceability

- **PRD Reference**: PRD §Ops
- **TDD Reference**: TDD §Ops

## Non-Functional Requirements

### Availability

The system shall maintain high availability:

- **SLO**: Uptime ≥99.0% monthly
- **Outage Response**: Outages have RCA within 5 business days
- **Health Checks**: `/healthz` endpoint for monitoring (allowlisted, no sensitive data)
- **Read-Only Mode**: Read-only mode for maintenance (prevents all write operations)

### Backups

- **Automated Backups**: Nightly encrypted backups of all critical data
- **Backup Encryption**: Backups encrypted and verified
- **Backup Integrity**: Backup integrity checksums validated
- **Backup Rotation**: Retain 30 days daily, 12 months monthly

### Disaster Recovery

- **Restore Drills**: Quarterly full restore drills validate RTO≤4h/RPO≤24h
- **DR Procedures**: Disaster recovery procedures documented and tested
- **Data Integrity**: Restored data matches source; integrity verified
- **Between-Drill Verification**: Nightly backup jobs verify creation/encryption/checksums; automated integrity checks provide evidence between quarterly full restores

## Related Epics

- [E10: Availability & Backups](../b.Epics/E10-availability-and-backups.md)

## Dependencies

### Technical Dependencies

- Backup system
- Monitoring system
- Health check endpoint
- Restore procedures

### External Dependencies

- Backup storage
- Monitoring services

### Feature Dependencies

- [NFR-002: Privacy](./NFR-002-privacy.md) - Backup deletion propagation
- [NFR-007: Observability](./NFR-007-observability.md) - Monitoring

## Constraints

### Technical Constraints

- Uptime ≥99.0% monthly
- RTO ≤4h
- RPO ≤24h
- Backup encryption required

### Business Constraints

- Availability is critical for user trust
- Backups must be reliable

## Assumptions

- Backup storage is reliable
- Restore procedures are tested
- Monitoring is accurate

## Risks & Issues

- **Risk**: System outages may impact users
- **Risk**: Backup failures may cause data loss
- **Risk**: Restore drills may reveal issues

## Open Questions

- What is the acceptable downtime window?
- Should there be multiple backup locations?

## Related Requirements

- [NFR-002: Privacy](./NFR-002-privacy.md) - Backup deletion
- [NFR-007: Observability](./NFR-007-observability.md) - Monitoring

---

**Last Updated**: 2026-09-25  
**Next Review**: 2026-10-25
