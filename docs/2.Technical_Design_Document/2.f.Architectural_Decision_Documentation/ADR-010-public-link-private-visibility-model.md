# ADR-010 — Session Visibility and Access Grant Model

> **File:** docs/2.Technical_Design_Document/2.f.Architectural_Decision_Documentation/ADR-010-public-link-private-visibility-model.md  
> **Purpose:** Define resource visibility for sessions, plans, and profiles with privacy‑first defaults.

---

id: ADR-010
title: "Session Visibility and Access Grant Model"
status: "Accepted"
date: "2025-10-13"
owners: ["Dr. Konstantinos Pilpilidis"]
version: "1.1"
links:

- TDD §4.7: "Feed & sharing"
- TDD §7.8: "Security & privacy controls"

---

## Context

Users need to keep data **private by default**, share via **unlisted (link)** URLs, or make some content **public** (e.g., for a community feed). We must support **revocable links** and feature‑flagged public discovery to remain privacy‑first.

## Decision

Use session visibility values **`private` (default)**, **`followers`**, **`link`**, and **`public`**. Visibility controls how new access can be obtained, but visibility is not the only access grant. Ownership, valid bookmarks, valid link tokens, and eligible follower relationships can independently grant access. Explicit stronger-denial rules such as blocking or session deletion override those grants.

### Model

- Column: `visibility visibility_enum NOT NULL DEFAULT 'private'`, supporting `private`, `followers`, `link`, and `public`.
- `link` remains a first-class visibility value, but the **current live schema intentionally has no `share_links` table**. Tokenized/revocable link grants are target behavior, not current Phase 12 implementation. Reintroducing persistent link-token state requires a separate explicit architecture/schema decision.
- `public` visibility enables inclusion in public feeds **only if** feature `public_feed_enabled` is on.
- A bookmark is a durable user-specific access grant created only while that user already has legitimate access to the session.
- Feed/index visibility is materialized state for query/discovery purposes only and is never an independent authorization grant.

### Access Rules

A session is accessible when at least one positive grant applies:

1. **Owner** — the owner always has access to their own non-deleted session.
2. **Bookmark grant** — a user who validly bookmarked the session retains access through that bookmark even after a later visibility restriction.
3. **Public** — a `public` session is accessible to all users allowed by platform-level policy.
4. **Followers** — a `followers` session is accessible to users who currently satisfy the required follower relationship.
5. **Valid link** — a `link` session is accessible through a currently valid, non-revoked link token.
6. **Authorized roles** — administrative/support access, where separately authorized by policy.

These grants are subject to stronger denial rules:

- **Session deletion** overrides all access grants.
- **Blocking** by the owner overrides an existing bookmark, follower relationship, public visibility, or link grant for the blocked user.
- Other future stronger-denial rules must be explicit and documented before implementation.

Bookmark semantics:

- A bookmark can only be created while the user currently has legitimate access through another rule.
- Once created, the bookmark is its own durable access grant ("key-door" logic).
- **Unbookmarking removes the bookmark grant immediately.** The user may still retain access through another rule such as public visibility, follower status, ownership, or a valid link.
- The owner does **not** have a separate per-user "revoke bookmark" mechanism in the current model. Such a mechanism would be a new sharing/access-control feature.
- **Revoking or expiring a link does not invalidate an already-created bookmark.** The user had legitimate access when the bookmark grant was created.
- **Blocking does invalidate bookmark-based access.**

In logical form:

```text
allowed =
  notDeleted
  AND notBlocked
  AND (
    isOwner
    OR hasValidBookmark
    OR isPublic
    OR isEligibleFollower
    OR hasValidLink
    OR hasAuthorizedRole
  )
```

Feed/index state may be stale for discovery purposes but cannot grant access unless this authoritative access evaluation also succeeds.

### Security & Abuse

- When tokenized link grants are implemented, token endpoints must be rate-limited and audited, and tokens must be single-resource scoped. Phase 12 does not invent a replacement token store.
- Bookmark creation must validate current legitimate access before persisting the access grant.
- Blocking is a stronger denial and must be checked before positive grants.
- Public feeds moderated; report/removal pipeline (Phase 2).

## Consequences

- Access has explicit grant semantics rather than being inferred only from the current visibility enum.
- Users can intentionally preserve access to a workout by bookmarking it while legitimately authorized.
- Owners cannot selectively revoke a single bookmark without using a stronger existing denial such as blocking; per-user bookmark revocation is intentionally not introduced.
- Link revocation prevents future link-based entry but does not retroactively remove durable bookmark grants already created.
- Feed materialization cannot become a privacy authority.
- Additional authorization checks are required on session/feed/bookmark read paths.

## Alternatives Considered

- **Only private/link**: Simpler but limits community features.
- **Public by default**: Violates privacy‑by‑default principle.

## QA & Acceptance

- Public access works for `public` sessions.
- Eligible followers can access `followers` sessions; ineligible users cannot unless another grant applies.
- Once a tokenized link-grant mechanism is explicitly implemented, a valid link must grant access while valid and revocation must block new link-based access while preserving an already-created bookmark grant.
- Until that architecture exists, `link` sessions are non-feed-visible and do not gain an implicit UUID-as-secret bypass.
- A bookmark can only be created while the user already has legitimate access.
- A bookmark preserves access after a later visibility downgrade.
- Unbookmarking removes only the bookmark grant.
- Blocking overrides an existing bookmark and all other user-specific positive grants.
- Deleted sessions are inaccessible regardless of bookmark/public/follower/link state.
- Feed results do not authorize access independently of the authoritative access rule.

## Backout Plan

Disable `public_feed_enabled`; public discovery can be removed without changing owner/bookmark/follower grants. No token backout applies until a link-token mechanism is explicitly implemented.

## Change Log

- **1.0 (2025-10-13):** Initial proposal.
- **1.1 (2026-09-22):** Accepted first-class `followers` visibility and explicit key-door access model: owner/bookmark/public/follower/link grants with block/deletion overrides.
- **1.2 (2026-09-22):** Reconciled the target link-grant rule with the live schema decision that `share_links` must not be recreated; Phase 12 does not implement an implicit or substitute link-token store.
