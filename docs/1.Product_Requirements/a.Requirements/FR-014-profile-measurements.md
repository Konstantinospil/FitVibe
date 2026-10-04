# FR-014 — Profile Measurements

---

**Requirement ID**: FR-014  
**Type**: Functional Requirement  
**Title**: Profile Measurements  
**Status**: Progressing  
**Priority**: High  
**Gate**: SILVER  
**Owner**: ENG/UX  
**Created**: 2026-09-25  
**Updated**: 2026-09-25

---

## Executive Summary

FitVibe shall provide a structured measurement subsystem for biometric and performance measurements without reopening the completed Profile & Settings scope in FR-009/E1.

The subsystem covers measurement definitions, user measurement values, unit metadata and conversion, discovery/customization of visible measurements, validation, and derived measurements.

## Business Context

- **Business Objective**: Give users a consistent way to record and compare biometric and performance measurements over time.
- **Target Users**: Authenticated users; administrators where global measurement definitions require administration.
- **Scope Boundary**: Basic profile fields and preferences remain under completed FR-009/E1.

## Functional Requirements

### Measurement definitions

- Support global biometric and performance measurement definitions.
- Definitions have stable identity, display metadata, unit type, granularity, valid ranges, and category.
- Duplicate definitions that differ only by insignificant casing/whitespace are prevented.
- Definitions may support metric and imperial representations where meaningful.

### User measurement values

- Users can record values against measurement definitions they have enabled.
- Values are validated against definition constraints.
- Historical values remain attributable to the definition semantics under which they were recorded.

### Discovery and profile presentation

- Users can search available measurement definitions.
- Users can add or remove measurements from their profile presentation.
- Search results expose enough metadata to understand the measurement before adding it.

### Derived measurements

- The model may support deterministic derived measurements based on source measurements.
- Derived measurement definitions must identify their source measurements and calculation rule.
- A derived result changes when its source values change; the original recorded source values remain authoritative.

## Non-Goals

- FR-014 does not redefine ordinary profile fields, account settings, privacy controls, or avatar management.
- FR-014 does not make arbitrary user-authored executable formulas a requirement.
- FR-014 does not prescribe implementation tables; TDD/data-model decisions may evolve while preserving these semantics.

## Related Epic

- [E21: Profile Measurements](../b.Epics/E21-profile-measurements.md)

## Dependencies

- [FR-009: Profile & Settings](./FR-009-profile-and-settings.md)
- [NFR-006: Internationalization](./NFR-006-i18n.md)
- [NFR-004: Accessibility](./NFR-004-a11y.md)

## Success Criteria

- Measurement definitions and values have unambiguous ownership and validation semantics.
- Metric/imperial presentation is consistent and reversible where conversion is supported.
- Users can discover and manage measurements shown on their profile.
- Derived measurements are deterministic and traceable to source measurements.
- Canonical stories and acceptance criteria are defined under E21 before implementation backlog is created.

---

**Last Updated**: 2026-09-25  
**Next Review**: after implementation comparison
