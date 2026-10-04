# ADR-032: Legal Document Publication Uses Immutable Snapshots

**Date:** 2026-09-25  
**Status:** Accepted  
**Author:** FitVibe Development Team  
**Cross-References:** ADR-024, FR-008/E16, REQ-2025-01-20-001/E19

---

## Context

Legal and policy content exists in several representations: Markdown policy files, locale JSON/bootstrap content, database-managed translations, and Backoffice editing surfaces. Treating any mutable representation as the published legal document makes historical reconstruction and acceptance evidence ambiguous.

The Backoffice must be able to publish an authoritative version. Constructing a legal document later from mutable line/translation elements is insufficient because the exact content accepted by a user must remain reproducible.

## Decision

### 1. Publication creates an immutable document snapshot

A publication stores the complete rendered/legal content and publication metadata needed to reconstruct exactly what was published.

The snapshot, not the mutable translation rows or Markdown source, is the authoritative record of a published legal document version.

A snapshot includes at minimum:

- document type/namespace;
- publication identifier and creation timestamp;
- complete content for each included language;
- effective date/version metadata;
- actor responsible for publication;
- publication classification;
- integrity/hash metadata sufficient to detect mutation.

Published snapshots are immutable. Corrections create a new snapshot.

### 2. Publication classification distinguishes legal effect

Every published snapshot is authoritative content. Publications are classified by change impact:

- **editorial** — editorial/translation correction that does not invalidate existing acceptance or consent;
- **material** — substantive change that requires an explicit user effect.

The user effect is persisted independently as `none`, `acknowledge`, `accept`, or `renew_consent`. This avoids incorrectly treating authority and acceptance impact as the same boolean distinction.

### 3. Acceptance refers to an authoritative snapshot

User acceptance records refer to the exact published version acted upon. A later material publication can require renewed action according to its persisted user effect.

Editorial publications remain part of publication history and become the current authoritative text without independently invalidating a still-satisfied material acceptance requirement.

### 4. Backoffice is the publication surface

Backoffice is the operational surface for reviewing and publishing versioned legal content. Authoring data may remain editable before publication.

The public/user-facing legal pages render from the applicable published snapshot. They do not reconstruct a historical legal document from current mutable translation rows.

### 5. Source representations are not competing SSOTs

- database translation rows: editable authoring state;
- locale JSON: bootstrap/fallback/development source;
- Markdown policy files: governance/readable mirrors and authoring references;
- published snapshot: authoritative runtime/legal publication record.

Where these disagree for an already published version, the snapshot wins.

## Consequences

### Positive

- Exact historical content remains reproducible.
- Acceptance evidence points to immutable content.
- Translation/editorial changes can be distinguished from legal version changes.
- Backoffice publication has explicit semantics.
- Documents can be rendered directly from snapshots instead of reassembled from mutable line elements.

### Trade-offs

- Publication requires snapshot storage.
- Authoring and published state must be treated separately.
- A correction after publication creates another publication rather than editing history.

## Relationship to ADR-024

ADR-024's cross-language effective-date calculation remains useful for mutable/bootstrap content and migration compatibility. For published legal documents, ADR-032 supersedes the idea that the current authoritative acceptance version can be derived solely from live translation rows. The authoritative version is established by an authoritative publication snapshot.

## Verification intent

Before implementation backlog is created, live `dev` must be compared against this decision to determine which snapshot/publication semantics already exist and which remain gaps.

---

## Status Log

| Version | Date | Change |
| --- | --- | --- |
| v1.0 | 2026-09-25 | Adopt immutable Backoffice publication snapshots with editorial/material classification with explicit user effect |
