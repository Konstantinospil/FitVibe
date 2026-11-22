# Frontend authenticated startup path

**Status:** current as of branch `fix/auth-bootstrap-634` (issue #634).
**Scope:** what happens between an authenticated reload and the first protected page render, which parts measurably matter for the authenticated Lighthouse gate, and the security invariants every optimisation must keep.

The authenticated Lighthouse gate (three valid runs per route, worst-of-three LCP ≤ 3,000 ms, simulated mobile profile with 4× CPU slowdown) measures this path.

## 1. Sequence

| Step | Where                        | Starts                                                                                                                                              | Waits for                                              |
| ---- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1    | `bootstrap.ts` (HTML entry)  | `import("./main")`; with a session flag also `prefetchProtectedEntry(path)`, which downloads the `ProtectedRoutes` chunk and the current page chunk | nothing                                                |
| 2    | `main.tsx` module evaluation | login strings; with a session also the full translation bundle (`ensurePrivateTranslationsLoaded`)                                                  | main chunk                                             |
| 3    | `main.tsx` mount             | `hydrateRoot`/`createRoot`                                                                                                                          | `minimalTranslationsReady`                             |
| 4    | `ProtectedRoutes` effect     | `GET /users/me/preferences`, then applies the account language                                                                                      | full translations **and** preferences, both settled    |
| 5    | `ProtectedRoute` effect      | `GET /auth/legal-documents/status` and, if the role is unknown or administrative, `GET /auth/admin-password/status`                                 | legal status and, when required, admin-password status |
| 6    | Page                         | page component (chunk already prefetched); its own data queries                                                                                     | page chunk, page data                                  |

`ProtectedRoute` and `MainLayout` are imported eagerly by `ProtectedRoutes`. Each page has its own Suspense boundary _below_ the guard, so a pending page chunk can never unmount a settled guard.

## 2. What the measurements show

| Change                                                                                        | Result on route-worst simulated LCP                                                                                                                                                                                                                                                                              | Decision               |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Halve guard API calls (nested Suspense, #635 experiment B)                                    | no change (~4.05–4.07 s)                                                                                                                                                                                                                                                                                         | not an LCP fix         |
| Collapse the serial chunk waterfall (#636)                                                    | ~4.1 s → ~3.4–3.6 s on all 8 routes                                                                                                                                                                                                                                                                              | **retained**           |
| Start preferences and guard checks together at `main.tsx` evaluation (#637, commit `2297988`) | mean 3,526 → 3,532 ms; per-route Δ −89 … +136 ms, the same size as the drift seen on public routes that make none of these calls (CI [#45060720945](https://github.com/Konstantinospil/FitVibe/actions/runs/45060720945) vs [#45067153231](https://github.com/Konstantinospil/FitVibe/actions/runs/45067153231)) | **rejected, reverted** |

Conclusion so far: the authenticated API round trips (steps 4–5) are **not** what Lighthouse's simulated LCP is sensitive to; the code-discovery chain was. Public routes, which make none of these calls, sit at ~3.0–3.2 s on the same runner. That suggests the remaining shared floor is downloading and evaluating the main/vendor JavaScript and rendering it under 4× CPU slowdown. This is still a hypothesis (H9 in #634) and must be checked against Lighthouse's own bootup-time, main-thread and critical-request-chain audits before any change.

## 3. Security invariants from #634

- **Guard identity binding** (`ProtectedRoute.tsx`): every guard result is stored with the identity key it was fetched for (user id + role class, or `unknown-user|role-missing` before the profile is known). The gate renders nothing until results for the current key arrive. One account's clearance never covers another.
- **Fail closed:** a failed legal check sends ordinary routes to `/terms-reacceptance`; a failed admin check requires the password update (except `ADMIN_2FA_REQUIRED`).
- **Query cache isolation** (`auth.store.ts`): the shared React Query cache is cleared on sign-out and when a different or unknown account signs in.
- **Reserved layout space:** the Dashboard Vibeform box (240×320) and the password strength meter are reserved before their lazy content loads, to avoid CLS and moving click targets.
- **Consent status on 429:** retried once, honouring `Retry-After` (≤ 10 s). Visitors who already chose are not re-prompted while the status is unavailable.

## 4. Remaining known costs (not yet addressed)

- The main bundle and its shared vendor chunk must be downloaded and evaluated before step 2 (H9, next candidate; see section 2).
- After a reload `user` is `null` until sign-in, so every athlete also triggers the admin-password check. This is request hygiene, not an expected LCP win, given the H7 result.
- Page data requests (step 6) start only after the guard opens.

Every change to this path follows the experiment contract in issue #634: one hypothesis per change, baseline and patch SHAs, the unchanged worst-of-three gate, TBT/CLS counter-metrics, and an explicit retain/revert decision.
