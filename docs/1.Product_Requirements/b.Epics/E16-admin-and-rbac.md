# Epic 16: Admin & RBAC

---

**Epic ID**: E16  
**Requirement ID**: [FR-008](../a.Requirements/FR-008-admin-and-rbac.md)  
**Title**: Admin & RBAC  
**Status**: Done  
**Priority**: High  
**Gate**: GOLD  
**Estimated Total Effort**: 15-20 story points  
**Created**: 2025-01-21  
**Updated**: 2026-09-25

---

## Description

Enable administrative control and role-based access control for platform management. Administration is delivered through both product-integrated administration and a dedicated Backoffice surface, sharing the same authorization, audit, and domain rules.

## Business Value

Enables platform administration and supports coach functionality. Ensures proper authorization and audit logging for administrative actions.

## Related Activities

This is legacy-completed scope that predates the current activity-level traceability discipline. No retrospective activities will be fabricated solely to populate historical documentation. Future extensions must be represented as new canonical scope.

## Related User Stories

This is a **legacy-completed epic**. It predates the current story-level traceability discipline and is retained as completed historical scope. Do not fabricate retrospective backlog stories solely to populate this section. New administrative capabilities that are not part of the completed E16 scope require a new story/epic or an explicit extension of a still-open requirement.

## Dependencies

### Epic Dependencies

- [FR-008: Admin & RBAC](../a.Requirements/FR-008-admin-and-rbac.md): Parent requirement
- [FR-001: User Registration](../a.Requirements/FR-001-user-registration.md): User accounts required
- [NFR-001: Security](../a.Requirements/NFR-001-security.md): Security controls required

## Success Criteria

- Role-based access control functions correctly
- Authorized administrators/support users can manage supported operational state through product administration and/or Backoffice
- Both administration surfaces share authorization and audit semantics
- All state-changing administrative actions are audit-logged
- Proper authorization is enforced

## Risks & Mitigation

- **Risk**: Unauthorized access to admin functions
  - **Mitigation**: Strict RBAC enforcement and regular security audits
- **Risk**: Admin actions may affect user data
  - **Mitigation**: Comprehensive audit logging and confirmation dialogs

---

**Last Updated**: 2026-09-25  
**Next Review**: N/A (legacy-completed epic)
