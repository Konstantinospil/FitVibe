# Epic 21: Profile Measurements

---

**Epic ID**: E21  
**Requirement ID**: [FR-014](../a.Requirements/FR-014-profile-measurements.md)  
**Title**: Profile Measurements  
**Status**: Progressing  
**Priority**: High  
**Gate**: SILVER  
**Estimated Total Effort**: To be re-estimated after implementation comparison  
**Created**: 2026-09-25  
**Updated**: 2026-09-25

---

## Description

Deliver the Profile Measurements subsystem introduced after completion of E1 without changing the historical meaning of E1/FR-009.

The epic separates measurement catalogue semantics, user-specific measurement values, presentation/discovery, and derived measurements so each can be compared independently against the live implementation before backlog items are created.

## Related User Stories

- [US-21.1: Measurement Definition Catalogue](../d.User_stories/US-21.1-measurement-definition-catalogue.md)
- [US-21.2: User Measurement Values](../d.User_stories/US-21.2-user-measurement-values.md)
- [US-21.3: Measurement Discovery & Profile Presentation](../d.User_stories/US-21.3-measurement-discovery-profile-presentation.md)
- [US-21.4: Derived Measurements](../d.User_stories/US-21.4-derived-measurements.md)

## Dependencies

- [FR-014](../a.Requirements/FR-014-profile-measurements.md)
- [FR-009](../a.Requirements/FR-009-profile-and-settings.md)
- [NFR-004](../a.Requirements/NFR-004-a11y.md)
- [NFR-006](../a.Requirements/NFR-006-i18n.md)

## Success Criteria

- Measurement definitions have stable identity and unit/range metadata.
- User values are validated and historically attributable.
- Users can discover and manage visible measurements.
- Derived measurements are deterministic and traceable.
- Documentation-to-code comparison determines which stories are already implemented and which become future project work.

---

**Last Updated**: 2026-09-25  
**Next Review**: after implementation comparison
