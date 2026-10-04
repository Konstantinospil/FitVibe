# FR-009 — Profile & Settings

---

**Requirement ID**: FR-009  
**Type**: Functional Requirement  
**Title**: Profile & Settings  
**Status**: Done  
**Priority**: Medium  
**Gate**: SILVER  
**Owner**: ENG/QA  
**Created**: 2025-01-20  
**Updated**: 2026-09-25  
**Completed**: 2025-01-21

---

## Executive Summary

This functional requirement specifies user profile management and settings capabilities that the system must provide.

Enable users to manage their profile information, preferences, and account settings with appropriate data validation and privacy controls.

## Business Context

- **Business Objective**: Enable users to customize their profile and settings to personalize their FitVibe experience.
- **Success Criteria**: Users can edit profile information, update preferences, and manage account settings with data validation and persistence.
- **Target Users**: All authenticated users

## Traceability

- **PRD Reference**: PRD §4.2 (FR-2 Profile & Settings)
- **TDD Reference**: TDD §Users Module

## Functional Requirements

### Profile Information Management

#### Editable Fields

The system shall allow users to edit the following profile fields:

- **Alias**: User's display name (text, max length TBD)
- **Weight**: User's current weight with unit selection (kg/lbs)
- **Fitness Level**: User's self-assessed fitness level (enum: beginner, intermediate, advanced, elite)
- **Avatar**: Profile image (max 5MB, formats: JPEG, PNG, WebP)
- **Training Frequency**: User's typical training frequency for personalization

#### Immutable Fields

The following fields shall be immutable after initial registration:

- **Date of Birth**: Set during registration, cannot be changed
- **Gender**: Set during registration, cannot be changed
  - Options: man, woman, diverse, prefer not to say

### Avatar Handling

- **Upload**: Users can upload avatar images up to 5MB
- **Preview**: System generates 128×128 pixel preview
- **Placeholder**: System displays placeholder if no avatar is uploaded
- **Validation**: File type and size validation before upload

### Settings Management

- **Training Frequency**: Stored for personalization algorithms
- **Language Preference**: Managed via [FR-008](./FR-008-admin-and-rbac.md) (i18n)
- **Privacy Settings**: Managed via [NFR-002](./NFR-002-privacy.md) (Privacy)

## Related Epics

- [E1: Profile & Settings](../b.Epics/E1-profile-and-settings.md)

## Dependencies

### Technical Dependencies

- Image processing library for avatar preview generation
- File upload handling
- Database for profile storage
- Validation framework

### Feature Dependencies

- [FR-001: User Registration](./FR-001-user-registration.md) - Profile created during registration
- [FR-002: Login & Session](./FR-002-login-and-session.md) - Authentication required
- [FR-008: Admin & RBAC](./FR-008-admin-and-rbac.md) - Admin may need to view/edit profiles

## Constraints

### Technical Constraints

- Avatar file size: max 5MB
- Avatar formats: JPEG, PNG, WebP only
- Avatar preview: 128×128 pixels
- Profile update persistence: ≤500ms
- Avatar preview generation: ≤2s

### Business Constraints

- Date of birth and gender are immutable after registration
- Weight must be positive and within reasonable range
- Alias must meet content policy requirements

## Assumptions

- Users have access to image files for avatar upload
- Image processing is reliable and performant
- Users understand which fields are editable vs immutable
- Training frequency data improves personalization

## Risks & Issues

- **Risk**: Large avatar uploads may impact performance
- **Risk**: Image processing may fail for corrupted files
- **Risk**: Immutable fields may frustrate users who made mistakes during registration
- **Risk**: Training frequency may not accurately reflect user behavior

## Open Questions

- What is the maximum length for alias/display name?
- What are the valid weight ranges (min/max)?
- Should there be avatar moderation/review?
- Should training frequency be auto-calculated from logged sessions?

## Scope Boundary

FR-009 covers ordinary profile and preference management completed under E1. The later Profile Measurements subsystem (global measurement definitions, measurement values, unit metadata/conversion, discovery, and derived measurements) is intentionally separated into [FR-014](./FR-014-profile-measurements.md) rather than reopening completed FR-009.

## Related Requirements

- [FR-001: User Registration](./FR-001-user-registration.md) - Profile creation
- [FR-002: Login & Session](./FR-002-login-and-session.md) - Authentication
- [FR-008: Admin & RBAC](./FR-008-admin-and-rbac.md) - Admin profile management
- [NFR-002: Privacy](./NFR-002-privacy.md) - Profile data privacy
- [NFR-004: Accessibility](./NFR-004-a11y.md) - Profile form accessibility

---

## Implementation Summary

**Implementation Date**: 2025-01-21  
**Status**: Complete

### Implemented Features

✅ **Profile Fields**:

- Alias editing (3-50 characters, URL-safe, case-insensitive unique)
- Weight editing with unit selection (kg/lb, range 20-500 kg)
- Fitness level selection (beginner, intermediate, advanced, elite)
- Training frequency selection (rarely, 1_2_per_week, 3_4_per_week, 5_plus_per_week)

✅ **API Endpoint**: `PATCH /api/v1/users/me` extended to support all new fields

✅ **Data Storage**:

- Alias stored in `profiles` table
- Weight, fitness level, and training frequency stored as time-series data in `user_metrics` table (preserves historical records)

✅ **Validation**:

- All fields validated with Zod schemas
- Alias uniqueness enforced (case-insensitive)
- Weight range validation (20-500 kg)
- Unit conversion (lb → kg) handled automatically

✅ **Testing**:

- 100% coverage of new functionality
- Unit tests (repository, service, controller)
- Integration tests (API endpoints)
- Frontend tests (Settings page)

✅ **Security Review**: Approved (Score: 98/100)

✅ **Documentation**:

- TDD updated
- API documentation updated
- Requirements Catalogue updated

### Technical Details

- **Backend**: TypeScript, Express.js, Knex.js, Zod validation
- **Frontend**: React 18, TypeScript, React Query, i18next
- **Database**: PostgreSQL with time-series storage for metrics
- **Security**: Input validation, authorization checks, rate limiting, audit logging

### Related Documentation

- [Technical Design Document](../../2.Technical_Design_Document/FR-009-Profile-Settings-Design.md)
- [TDD Users Module](../../2.Technical_Design_Document/2b.Technical_Design_Document_Modules.md#42-users--profile-fr-2)
- [API Design Documentation](../../2.Technical_Design_Document/2d.Technical_Design_Document_APIDesign.md#78-users--profile-fr-2)

---

**Last Updated**: 2026-09-25  
**Next Review**: N/A (completed scope)
