# US-9.6: Log Aggregation

---

**Story ID**: US-9.6  
**Epic ID**: [E9](../b.Epics/E9-observability.md)  
**Title**: Log Aggregation  
**Status**: Progressing  
**Story Points**: 3  
**Priority**: Medium  
**Created**: 2025-01-21  
**Updated**: 2026-09-25

---

## User Story

**As a** developer  
**I want** logs aggregated and searchable  
**So that** I can find and analyze log entries efficiently

## Description

Log aggregation pipeline is configured (Loki or compatible). Logs are ingested from all services and searchable by correlation ID, timestamp, service/route, and—where explicitly needed—a one-way hashed actor identifier. Raw user IDs are not an allowed search field. Log retention is configurable with a 30-day default target; log storage and normal operational queries must remain performant.

## Related Acceptance Criteria

- [US-9.6-AC01](../e.Acceptance_Criteria/US-9.6-AC01.md): Log aggregation and search
- [US-9.6-AC02](../e.Acceptance_Criteria/US-9.6-AC02.md): Log retention and performance

## Dependencies

### Story Dependencies

- [NFR-007: Observability](../a.Requirements/NFR-007-observability.md): Parent requirement
- [US-9.1: Structured Logging](../d.User_stories/US-9.1-structured-logging.md): Log source

## Technical Notes

- Loki or compatible log aggregation
- Log ingestion configuration
- Retention policy management

## Test Strategy

- Log aggregation verification
- Search functionality tests
- Performance validation

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Code implemented and reviewed
- [ ] Tests written and passing (≥80% coverage)
- [ ] Documentation updated
- [ ] Evidence collected for all ACs

---

**Last Updated**: 2025-01-21  
**Next Review**: 2025-02-21
