# US-9.1: Structured Logging

---

**Story ID**: US-9.1  
**Epic ID**: [E9](../b.Epics/E9-observability.md)  
**Title**: Structured Logging  
**Status**: Progressing  
**Story Points**: 3  
**Priority**: Medium  
**Created**: 2025-01-21  
**Updated**: 2026-09-25

---

## User Story

**As a** developer  
**I want** structured logs with correlation IDs  
**So that** I can trace requests across services and debug issues

## Description

All logs are structured JSON with required operational fields such as timestamp, level, request/correlation ID, route, status, and latency. Raw user identifiers and other PII must not be logged. Where actor-level correlation is operationally necessary, only a one-way hashed actor identifier may be emitted. Correlation IDs are propagated across services and remain the primary key for request tracing.

## Related Acceptance Criteria

- [US-9.1-AC01](../e.Acceptance_Criteria/US-9.1-AC01.md): Structured JSON logs
- [US-9.1-AC02](../e.Acceptance_Criteria/US-9.1-AC02.md): Correlation ID propagation

## Dependencies

### Story Dependencies

- [NFR-007: Observability](../a.Requirements/NFR-007-observability.md): Parent requirement

## Technical Notes

- Structured JSON logging (Pino)
- Correlation ID propagation
- PII filtering

## Test Strategy

- Log format verification
- Correlation ID propagation tests
- PII scan tests

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Code implemented and reviewed
- [ ] Tests written and passing (≥80% coverage)
- [ ] Documentation updated
- [ ] Evidence collected for all ACs

---

**Last Updated**: 2025-01-21  
**Next Review**: 2025-02-21
