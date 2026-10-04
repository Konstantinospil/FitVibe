# ADR-034: Endogenous vibe progression and derived gamification recovery

- **Status:** Accepted
- **Date:** 2026-09-26
- **Issue:** #266

## Context

The vibe-level implementation was labelled Glicko-2 even though FitVibe does not model opponent matches. It derives a normalized outcome from the user's own workout performance and applies a domain-impact factor. The social follow path also evaluated follower badges synchronously but silently discarded evaluation failures.

## Decision

1. Vibe progression remains an endogenous FitVibe model. It is not represented as standards-conformant Glicko-2.
2. The current mathematical behaviour is preserved in this residue-quality phase; misleading Glicko-2 names and dead constants are removed. Algorithm changes require a separate product decision and versioned migration/reconciliation plan.
3. A social follow is authoritative primary state. Badge awards are derived gamification state and must not cause a successful follow to roll back.
4. If follow-triggered badge evaluation fails, the failure is logged, the existing gamification projection is marked stale with rebuild required, and the existing projection reconciliation mechanism is scheduled.
5. JWT signing and verification use the auth session-token contract. Parallel token issuers with different refresh/session claims are not permitted.

## Consequences

The implementation describes what the product actually does rather than claiming conformance to an external competitive-rating standard. Derived badge state becomes observable and recoverable through the existing reconciliation path. Authentication middleware and issuance share one claim contract, reducing drift risk.
