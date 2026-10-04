# US-9.6-AC01: Log Aggregation and Search

---

**AC ID**: US-9.6-AC01
**Story ID**: [US-9.6](../d.User_stories/US-9.6-log-aggregation.md)
**Status**: Proposed
**Priority**: Medium
**Test Method**: Ops review
**Created**: 2025-01-21
**Updated**: 2026-09-25

---

## Criterion

Log aggregation pipeline is configured (Loki or compatible); logs are ingested from all services and searchable by correlation ID, timestamp, service/route, and, where operationally necessary, a one-way hashed actor identifier. Raw user IDs are not indexed as a log search field.

**SMART Criteria Checklist**:

- **Specific**: Clear aggregation and search requirements
- **Measurable**: Pipeline configured, logs ingested, searchable
- **Achievable**: Standard log aggregation approach
- **Relevant**: Log analysis and debugging
- **Time-bound**: N/A

## Test Method

Ops review verifies log aggregation and search functionality.

## Evidence Required

- Log aggregation configuration
- Search functionality

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

- **Story**: [US-9.6](../d.User_stories/US-9.6-log-aggregation.md)
- **Epic**: [E9](../b.Epics/E9-observability.md)
- **Requirement**: [NFR-007](../a.Requirements/NFR-007-observability.md)
- **PRD Reference**: PRD §Observability
- **TDD Reference**: TDD §Observability

---

**Last Updated**: 2025-01-21
**Verified By**: {Name/Team}
**Verified Date**: {YYYY-MM-DD}
