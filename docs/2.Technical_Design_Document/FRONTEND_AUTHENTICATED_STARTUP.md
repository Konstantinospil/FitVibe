# Frontend authenticated startup path

**Status:** current as of branch `fix/auth-bootstrap-634` (issue #634).
**Scope:** what happens between an authenticated reload and the first protected page render, which parts are on the critical path, and the security invariants every optimisation must keep.

The authenticated Lighthouse gate (three valid runs per route, worst-of-three LCP ≤ 3,000 ms, simulated mobile profile with 4× CPU slowdown) measures this path. Each serial network round trip on it costs roughly one simulated RTT, so the design aim is that independent work starts together, as early as possible.

## 1. Sequence

| Step | Where                        | Starts                                                                                                                                                                                                                                                                                     | Waits for                                              |
| ---- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| 1    | `bootstrap.ts` (HTML entry)  | `import("./main")`; with a session flag also `prefetchProtectedEntry(path)`, which downloads the `ProtectedRoutes` chunk and the current page chunk                                                                                                                                        | nothing                                                |
| 2    | `main.tsx` module evaluation | login strings; with a session: the full translation bundle (`ensurePrivateTranslationsLoaded`) and `startSessionBootstrap()`, which sends `GET /users/me/preferences`, `GET /auth/legal-documents/status` and, if the role is unknown or administrative, `GET /auth/admin-password/status` | main chunk                                             |
| 3    | `main.tsx` mount             | `hydrateRoot`/`createRoot`                                                                                                                                                                                                                                                                 | `minimalTranslationsReady`                             |
| 4    | `ProtectedRoutes` effect     | adopts the early preferences request (or sends it) and applies the account language                                                                                                                                                                                                        | full translations **and** preferences, both settled    |
| 5    | `ProtectedRoute` effect      | adopts the early legal/admin requests for its identity key (or sends them)                                                                                                                                                                                                                 | legal status and, when required, admin-password status |
| 6    | Page                         | page component (chunk already prefetched); its own data queries                                                                                                                                                                                                                            | page chunk, page data                                  |

`ProtectedRoute` and `MainLayout` are imported eagerly by `ProtectedRoutes`. Each page has its own Suspense boundary _below_ the guard, so a pending page chunk can never unmount a settled guard.

Before #634, steps 1–6 discovered code one lazy boundary at a time (three serial login-string chunks → `ProtectedRoutes` → `ProtectedRoute` → `MainLayout` → page). After that, the API calls were still serial: preferences only started in step 4, and the guard checks only started in step 5, after preferences had settled.

## 2. Early bootstrap requests (`src/lib/sessionBootstrap.ts`)

The early requests change _when_ the guard's data is requested, not _how_ it is judged. Invariants:

1. **Session only.** Nothing starts without the session flag. The requests are ordinary GETs authorised by the HttpOnly session cookie. A 401 follows the usual refresh path in `httpApi.ts`.
2. **Identity binding.** Guard results are stored with `computeGuardKey(isAuthenticated, user)` as it was when they were requested. The guard uses the same function, and only adopts a result whose key is identical; otherwise it fetches fresh.
3. **Single use and bounded age.** Each result can be taken once and only within `SESSION_BOOTSTRAP_MAX_AGE_MS` (10 s) of being requested. Any later check, including StrictMode's development effect replay, fetches fresh.
4. **Discarded on identity change.** `signIn` and `signOut` in `auth.store.ts` call `discardSessionBootstrap()`.
5. **Failures still fail closed.** A rejected early request reaches the guard as a rejection, so a failed legal check still redirects ordinary routes to `/terms-reacceptance`, and a failed admin check still requires the password update (except `ADMIN_2FA_REQUIRED`).
6. **No extra requests.** A successful hand-off replaces the request the consumer would have made. Rate-limit consumption per navigation is unchanged.

Tests: `tests/frontend/lib/sessionBootstrap.test.ts` (module contract) and `tests/frontend/components/ProtectedRoute.bootstrap.test.tsx` (guard adoption, identity mismatch, fail-closed paths). Guard identity behaviour without early requests stays covered by `ProtectedRoute.identity.test.tsx`.

## 3. Other startup invariants from #634

- **Guard identity binding** (`ProtectedRoute.tsx`): the gate renders nothing until results for the current user id and role class arrive. One account's clearance never covers another.
- **Query cache isolation** (`auth.store.ts`): the shared React Query cache is cleared on sign-out and when a different or unknown account signs in.
- **Reserved layout space:** the Dashboard Vibeform box (240×320) and the password strength meter are reserved before their lazy content loads, to avoid CLS and moving click targets.
- **Consent status on 429:** retried once, honouring `Retry-After` (≤ 10 s). Visitors who already chose are not re-prompted while the status is unavailable.

## 4. Remaining known costs (not yet addressed)

- After a reload `user` is `null` until sign-in, so every athlete also triggers the admin-password check, and the identity key is `unknown-user|role-missing`. Hydrating the user would remove that request.
- The main bundle and its shared vendor chunk must be downloaded and evaluated before step 2. Splitting them further has to be justified by Lighthouse's own bootup and critical-request audits, not by guesswork.
- Page data requests (step 6) start only after the guard opens.

Every change to this path follows the experiment contract in issue #634: one hypothesis per change, baseline and patch SHAs, the unchanged worst-of-three gate, TBT/CLS counter-metrics, and an explicit retain/revert decision.
