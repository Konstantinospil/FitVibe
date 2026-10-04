# US-9.1-AC01: Structured JSON Logs

---

**AC ID**: US-9.1-AC01
**Story ID**: [US-9.1](../d.User_stories/US-9.1-structured-logging.md)
**Status**: Proposed
**Priority**: Medium
**Test Method**: Integration
**Created**: 2025-01-21
**Updated**: 2026-09-25

---

## Criterion

All application logs are structured JSON and include the operational fields required for diagnosis, including timestamp, level, request/correlation ID, route, status, and latency where applicable. Raw user IDs and other PII are excluded. If actor-level correlation is required, only a one-way hashed actor identifier may be logged.

**SMART Criteria Checklist**:

- **Specific**: Clear log format and field requirements
- **Measurable**: Logs are JSON, required fields present, no PII
- **Achievable**: Standard structured logging approach
- **Relevant**: Observability and debugging
- **Time-bound**: N/A

## Test Method

Integration tests verify log format and PII scanning.

## Evidence Required

- Log samples
- PII scan results

## Related Tests

{Note: Test files will be created and linked here}

## Related Evidence

{Note: Evidence files will be created and linked here}

## Verification

- [ ] Criterion is specific and measurable
- [ ] Test method is appropriate
- [ ] Evidence requirements are clear
- [ ] Related tests are identified

## Related Artifacts

- **Story**: [US-9.1](../d.User_stories/US-9.1-structured-logging.md)
- **Epic**: [E9](../b.Epics/E9-observability.md)
- **Requirement**: [NFR-007](../a.Requirements/NFR-007-observability.md)
- **PRD Reference**: PRD §Observability
- **TDD Reference**: TDD §Observability

---

**Last Updated**: 2025-01-21
**Verified By**: {Name/Team}
**Verified Date**: {YYYY-MM-DD}
