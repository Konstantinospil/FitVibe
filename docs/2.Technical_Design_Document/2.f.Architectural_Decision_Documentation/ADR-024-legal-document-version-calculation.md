# ADR-024: Legal Document Version Calculation

> **Superseded by ADR-035 (2026-09-26).** Translation/database timestamps are no longer a runtime legal authority. Persisted legal publications and acceptances are authoritative.

**Date:** 2025-12-22  
**Status:** Superseded  
**Author:** FitVibe Engineering Team  
**Cross-References:** REQ-2025-01-20-001 (Terms and Conditions), E19 (Terms and Conditions Epic)

---

## Current Authority

For published legal documents, [ADR-032](./ADR-032-legal-document-publication-snapshots.md) is authoritative: immutable publication snapshots determine the published version and acceptance contract. The calculation described in this ADR remains relevant for editable/bootstrap translation state and migration compatibility, but must not override an existing publication snapshot.

## Context

FitVibe requires users to accept Terms and Conditions, Privacy Policy, and Cookie Policy documents. These documents are translated into multiple languages (English, German, Spanish, French, Greek). The system needs to track which version of each document a user has accepted to ensure legal compliance when documents are updated.

The challenge is that legal documents may be updated in different languages at different times. For example:

- German terms may not have changed since 2024
- Spanish terms section 4 was updated in December 2025
- English terms remain unchanged

Without a unified versioning strategy, the system would need to track which language version each user originally accepted, creating complexity in:

- User acceptance tracking (storing language-specific versions)
- Re-acceptance logic (determining when to prompt users)
- Database schema (multiple version fields per language)
- API responses (language-aware version checks)

Additionally, translations can be stored in two sources:

1. **JSON files** in `apps/frontend/src/i18n/locales/{lang}/{namespace}.json`
2. **Database table** `translations` for API-managed translations

The system must work with both sources and prioritize database values when available.

---

## Decision

For **mutable/bootstrap content where no publication snapshot governs the document**, implement a unified version calculation system that:

1. **Calculates version from the latest `effectiveDateValue` across ALL languages** for each document namespace (terms, privacy, cookie)
2. **Checks both translation sources** (JSON files and database table) with database taking precedence
3. **Uses a single version string** (YYYY-MM-DD format) for all languages of a document
4. **Produces the candidate cross-language version for mutable/bootstrap content**. Once content is published through ADR-032, re-acceptance is determined by authoritative snapshot publication rather than inferred from a translation-row edit.

### Implementation Details

- **Version Calculation Function**: `calculateLegalDocumentVersion(namespace)` in `apps/backend/src/config/legal-version.ts`
  - Queries database first for `effectiveDateValue` by namespace and language
  - Falls back to JSON files if database doesn't have the value
  - Parses dates in both ISO format (YYYY-MM-DD) and human-readable formats
  - Finds the maximum date across all languages
  - Returns the latest date as the version string

- **Caching**: 10-minute TTL cache to avoid repeated file reads and database queries

- **Fallback**: Uses `2024-06-01` as a safe default if no valid dates are found

- **Async Functions**: All version calculation functions are async to support database queries:
  - `getCurrentTermsVersion()`
  - `getCurrentPrivacyPolicyVersion()`
  - `getCurrentCookiePolicyVersion()`
  - `isTermsVersionOutdated(userVersion)`
  - `isPrivacyPolicyVersionOutdated(userVersion)`

### Example

If Spanish terms are updated in December 2025 but German terms haven't changed since 2024:

- **Version for ALL languages**: `2025-12-01` (the latest date)
- Before snapshot publication, the candidate cross-language version is `2025-12-01`.
- After ADR-032 publication, users re-accept only when a new **authoritative** snapshot advances the acceptance contract; a minor snapshot does not do so by itself.

---

## Consequences

### Positive

- **Simplified user tracking**: Single version field per document type, not per language
- **Consistent re-acceptance**: All users see updates simultaneously, regardless of language
- **Flexible translation management**: Works with both file-based and database-managed translations
- **Automatic version calculation**: No manual version bumping required when updating translations
- **Language-agnostic**: Users can switch languages without version conflicts
- **Graceful degradation**: System works even if translations table doesn't exist yet

### Negative

- **Performance overhead**: Requires reading files/database on each version check (mitigated by 10-minute cache)
- **Async complexity**: All version checks are now async, requiring `await` at call sites
- **Potential false positives**: Users may be prompted to re-accept even if their language hasn't changed (acceptable trade-off for simplicity)
- **Date parsing complexity**: Must handle multiple date formats (ISO and human-readable)

### Trade-offs

- **Simplicity vs. Precision**: We prioritize simplicity (single version) over precision (language-specific versions)
- **Consistency vs. Flexibility**: All users see the same version, ensuring consistent legal compliance across languages
- **Performance vs. Accuracy**: Cache reduces database/file reads but may delay version updates by up to 10 minutes

---

## Alternatives Considered

| Option                     | Description                                                   | Reason Rejected                                                                                              |
| -------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Language-specific versions | Track separate version per language in user record            | Too complex: requires multiple version fields, complex re-acceptance logic, and language-aware API responses |
| Manual version bumping     | Manually increment version constant when any language changes | Error-prone: easy to forget, requires coordination across teams, doesn't scale                               |
| Database-only approach     | Only check translations table, ignore JSON files              | Too rigid: breaks if translations table isn't set up, doesn't support file-based workflow                    |
| File-only approach         | Only check JSON files, ignore database                        | Too limited: doesn't support API-managed translations, less flexible                                         |
| Version per section        | Track version for each document section separately            | Over-engineered: adds complexity without clear benefit, harder to reason about                               |

---

## References

- **Requirement**: [REQ-2025-01-20-001 - Terms and Conditions](../1.Product_Requirements/a.Requirements/REQ-2025-01-20-001-terms-and-conditions.md)
- **Epic**: [E19 - Terms and Conditions](../1.Product_Requirements/b.Epics/E19-terms-and-conditions.md)
- **Implementation**: `apps/backend/src/config/legal-version.ts`
- **Related ADRs**:
  - ADR-011: Internationalization – Hybrid Model
  - ADR-015: API Design & Internationalization

---

## Status Log

| Version | Date       | Change        | Author                   |
| ------- | ---------- | ------------- | ------------------------ |
| v1.0    | 2025-12-22 | Initial draft | FitVibe Engineering Team |
