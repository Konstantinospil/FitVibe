# REQ-2025-01-20-001 — Terms and Conditions

---

**Requirement ID**: REQ-2025-01-20-001  
**Type**: Functional Requirement  
**Title**: Terms and Conditions Acceptance  
**Status**: Done  
**Priority**: High  
**Gate**: GOLD  
**Owner**: Legal/ENG  
**Created**: 2025-01-20  
**Updated**: 2026-09-25

---

## Executive Summary

This functional requirement specifies Terms and Conditions acceptance capabilities that the system must provide.

Add a Terms and Conditions acceptance requirement to the user registration flow. Users must explicitly accept the Terms and Conditions before completing registration.

## Business Context

- **Business Objective**: Ensure legal compliance and protect the platform by requiring explicit user consent to Terms and Conditions during registration.
- **Success Criteria**:
  - 100% of new registrations include terms acceptance
  - Terms acceptance is recorded and auditable
  - Registration cannot be completed without terms acceptance
- **Target Users**: All new users registering for FitVibe accounts

## Traceability

- **PRD Reference**: PRD §Legal Compliance
- **TDD Reference**: TDD §Registration Flow

## Functional Requirements

### Terms and Conditions Document

The system shall provide access to Terms and Conditions:

- **Document Storage**: Mutable authoring content is separated from immutable published legal-document snapshots per ADR-032
- **Public Access**: Terms document accessible via public route (e.g., `/terms` or `/terms-and-conditions`)
- **Document Content**: Terms document includes standard sections: user obligations, service description, liability limitations, dispute resolution
- **Versioning**: Published Terms are immutable snapshots with explicit publication classification (`minor` or `authoritative`) and effective/version metadata
- **Viewing Options**: Terms document can be viewed in modal or new page from registration form

### Terms Acceptance in Registration

- **Required Checkbox**: Registration form includes required checkbox for Terms and Conditions acceptance
- **Link to Terms**: Checkbox includes link to view Terms document
- **Validation**: Registration cannot be completed without terms acceptance
- **Clear Messaging**: Clear error message if user attempts to register without accepting terms

### Acceptance Recording

- **Database Storage**: Terms acceptance is recorded in database with timestamp and version
- **Audit Trail**: Terms acceptance is audit-logged for compliance
- **Version Tracking**: System tracks the authoritative publication snapshot/version accepted by the user

## Related Epics

- [E19: Terms and Conditions](../b.Epics/E19-terms-and-conditions.md)

## Dependencies

### Technical Dependencies

- Terms document storage
- Registration form system
- Database for acceptance tracking
- Audit logging system

### Feature Dependencies

- [FR-001: User Registration](./FR-001-user-registration.md) - Registration flow

## Constraints

### Technical Constraints

- Terms acceptance must be recorded before registration completion
- Terms version must be tracked
- Terms document must be accessible without authentication

### Business Constraints

- Legal compliance required
- Terms acceptance must be explicit and recorded
- Terms document must be versioned

## Assumptions

- Users understand they must accept Terms to register
- Terms document is legally compliant
- Terms versioning is managed properly

## Risks & Issues

- **Risk**: Users may not read Terms before accepting
- **Risk**: Terms updates may require re-acceptance
- **Risk**: Legal requirements may change

## Decisions

- A new **authoritative** publication advances the acceptance contract and may require re-acceptance.
- A **minor** publication remains versioned/auditable but does not independently invalidate prior acceptance.
- The exact published content accepted by a user must be reproducible from the immutable publication snapshot.
- Backoffice is the governed publication surface; see ADR-032.
- Communication of a required re-acceptance is a product-delivery concern under E19 and must not be inferred merely from mutable translation edits.

## Related Requirements

- [FR-001: User Registration](./FR-001-user-registration.md) - Registration flow

---

**Last Updated**: 2026-09-25  
**Next Review**: after implementation comparison
