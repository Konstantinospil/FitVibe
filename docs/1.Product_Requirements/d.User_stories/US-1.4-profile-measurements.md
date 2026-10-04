# US-1.4: Profile Measurements

---

**Story ID**: US-1.4  
**Epic ID**: [E1](../b.Epics/E1-profile-and-settings.md)  
**Title**: Profile Measurements  
**Status**: Superseded  
**Story Points**: 8  
**Priority**: High  
**Created**: 2026-01-04  
**Updated**: 2026-09-25

---

## Supersession

This story was created after E1/FR-009 had already been completed. It is retained for traceability but is not active scope. Its product intent has been restructured under [FR-014](../a.Requirements/FR-014-profile-measurements.md) / [E21](../b.Epics/E21-profile-measurements.md):

- [US-21.1: Measurement Definition Catalogue](./US-21.1-measurement-definition-catalogue.md)
- [US-21.2: User Measurement Values](./US-21.2-user-measurement-values.md)
- [US-21.3: Measurement Discovery & Profile Presentation](./US-21.3-measurement-discovery-profile-presentation.md)
- [US-21.4: Derived Measurements](./US-21.4-derived-measurements.md)

The original text below remains historical context only.

## User Story

**As a** authenticated user  
**I want** to manage biometric and performance measurements on my profile  
**So that** I can track progress with consistent, validated metrics

## Description

The profile page provides two measurement areas (Biometrical and Performance) with separate sections and a sidebar layout aligned with the backoffice Settings aesthetic. Measurements are organized into four tables: `bio_attributes`, `bio_attribute_values`, `perf_attributes`, `perf_attribute_values`. Attribute records are global and searchable, while attribute values are user-specific.

Attributes require a unit type (e.g., length, weight, volume, ratio), granularity (e.g., mm, cm, m), and min/max ranges. The measurement system (imperial/metric) is provided at creation so min/max values are stored in both systems. Duplicate attributes are prevented (e.g., whitespace or casing differences).

Users can add attributes via a search bar that queries existing attributes as they type and also supports defining new attributes. Search results display a short tooltip card with unit, granularity, and min/max values. Users can add (+) or remove (-) which attributes are shown on their profile. The system provides global defaults for both areas (biometrics: weight, body fat, bone weight, body water, height, and standard circumferences; performance: VO2 max, FTP, running and strength benchmarks, jumps, flexibility). Users can also define combined measurements (e.g., ratio of measure A to measure B). Input values are validated against logical min/max ranges.

## Related Acceptance Criteria

- [US-1.4-AC01](../e.Acceptance_Criteria/US-1.4-AC01.md): Attribute creation and duplicate prevention
- [US-1.4-AC02](../e.Acceptance_Criteria/US-1.4-AC02.md): Measurement systems and min/max conversion
- [US-1.4-AC03](../e.Acceptance_Criteria/US-1.4-AC03.md): Attribute search, add/remove, and tooltip details
- [US-1.4-AC04](../e.Acceptance_Criteria/US-1.4-AC04.md): Combined measures and value validation

## Dependencies

### Story Dependencies

- [FR-009: Profile & Settings](../a.Requirements/FR-009-profile-and-settings.md): Parent requirement

## Technical Notes

- Attribute identity normalization (trim, case-fold) before uniqueness checks.
- Store unit metadata and min/max values in both metric and imperial systems.
- Provide ratio/derived attribute definitions based on two source attributes.

## Test Strategy

- Attribute search/add/remove flows, including duplicate detection.
- Validation of min/max input ranges across measurement systems.
- UI tests for tooltip metadata and sidebar navigation between sections.

## Definition of Done

- [x] Story superseded by FR-014/E21; original acceptance criteria are not active backlog
- [ ] Code implemented and reviewed
- [ ] Tests written and passing (≥80% coverage)
- [ ] Documentation updated
- [ ] Evidence collected for all ACs

---

**Last Updated**: 2026-09-25  
**Next Review**: 2026-02-04
