# ADR-031: User Preference Ownership and Locale Separation

**Date:** 2026-09-24  
**Status:** Accepted  
**Author:** FitVibe Engineering / Product Owner  
**Cross-References:** ADR-013, ADR-029; Backend Technical-Debt Reduction Pass 2 Phase 9

---

## Context

Phase 9 separated user preferences from general profile editing. The current backend exposes language and measurement-system preferences through the user-preferences service/repository while the user model also contains a separate `locale` field.

Without an explicit ownership decision, later changes could make profile, locale, frontend state, and preferences competing sources of truth.

## Decision

### Preference authority

The persisted user row is the authority for the current preference values:

- `preferred_lang` owns the user's explicit application-language preference exposed as `preferences.language`.
- `units` owns the user's measurement-system preference exposed as `preferences.measurementSystem`.

The preferences API/service is the canonical application boundary for reading and changing these preference values. Profile editing must not create a second preference representation.

### Locale is distinct

`locale` remains a distinct user/account value. It must not be silently treated as an alias for `preferred_lang`, nor should changing one implicitly overwrite the other unless a future product decision explicitly defines such synchronization.

This distinction permits locale to represent broader regional/localization context while `preferred_lang` remains the explicit language preference.

### Compatibility surfaces

A broader user DTO may expose preference fields for compatibility or display, but that does not create another authority. Such fields must be projections of the same persisted values.

Frontend-local state may stage an edit but must not be treated as persisted authority after the server preference has been saved.

### Evolution

If FitVibe later decides that locale and preferred language are redundant, that is a schema/product migration and requires an explicit decision. They must not drift together through ad-hoc synchronization.

## Consequences

- Preference ownership is explicit and remains inside the users domain.
- Profile updates cannot independently redefine language or units.
- Code may expose the same values through multiple DTOs without creating multiple sources of truth.
- Locale/language semantics remain intentionally separate until a later product decision changes them.

## Alternatives Considered

| Option | Reason rejected |
| --- | --- |
| Store preferences only in frontend local storage | Not portable across clients and creates client-specific authority. |
| Treat `locale` and `preferred_lang` as aliases | Current schema and Phase 9 behavior distinguish them; implicit synchronization would invent behavior. |
| Move preferences to a separate persistence table now | No demonstrated requirement justifies another persistence model at current scale. |

## Implementation Mapping

- `apps/backend/src/modules/users/users.preferences.service.ts`
- `apps/backend/src/modules/users/users.preferences.repository.ts`
- `apps/backend/src/modules/users/users.types.ts`
- Phase 9 implementation history.

## Status Log

| Version | Date | Change | Author |
| --- | --- | --- | --- |
| v1.0 | 2026-09-24 | Retrospectively document the durable Phase 9 preference/locale ownership boundary after debt-confrontation audit | FitVibe Engineering / Product Owner |
