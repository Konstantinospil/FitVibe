# ADR-035: Persisted legal publications are the sole runtime authority

- **Status:** Accepted
- **Date:** 2026-09-26
- **Scope:** Phase 21 / DD-02

## Decision

Runtime legal requirements are determined only from persisted `legal_document_versions`,
`legal_document_snapshots`, and `legal_document_acceptances`.

Authentication uses `getLegalActionStatus(userId, "terms")`. Login, completed 2FA login,
and refresh may issue tokens only when that persisted status reports `needsAction: false`.

A publication with `user_action = none` is editorial and does not invalidate an acceptance
that satisfies the latest required publication. A later material publication must define a
user action and blocks token issuance until that persisted requirement is accepted.

Registration and explicit re-acceptance record the exact persisted publication ID. The
`users.terms_version` columns remain compatibility/read-model fields; they are not an
authentication authority.

## Transition for re-acceptance

A material publication can make an existing session fail refresh. The existing access token
remains usable until its normal expiry, allowing the authenticated legal-status and
`/auth/terms/accept` flow to record the new acceptance. Authentication then succeeds again.
Clients receiving `TERMS_VERSION_OUTDATED` must route the user to that re-acceptance flow
rather than repeatedly retry refresh.

## Retired authorities

The translation/file-timestamp calculator in `config/legal-version.ts` is removed.
`config/terms.ts` is retained only as an explicitly deprecated fixture for historical
tests; production authentication must not import it.

## Consequences

- Editorial translation/content publication does not spuriously log users out.
- Material re-publication has one auditable authority and one acceptance history.
- Backoffice publication, registration, re-acceptance, login, 2FA and refresh share the same
  publication semantics.
