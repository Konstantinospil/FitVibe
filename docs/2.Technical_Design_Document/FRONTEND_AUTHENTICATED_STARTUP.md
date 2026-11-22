# Frontend authenticated startup path

**Status:** current as of branch `fix/auth-bootstrap-634` (issue #634).
**Scope:** what happens between an authenticated reload and the first protected page render, which parts measurably matter for the authenticated Lighthouse gate, and the security invariants every optimisation must keep.

The authenticated Lighthouse gate (three valid runs per route, worst-of-three LCP ≤ 3,000 ms, Lighthouse's default mobile profile with simulated throttling: 150 ms RTT, ~1.6 Mbps, 4× CPU slowdown) measures this path. The CI ingress is nginx over **HTTP/1.1** (`listen 80`), so Lighthouse simulates at most 6 connections per origin.

## 1. Sequence (production SSR)

| Step | Where                           | Starts                                                                                                                                                                                                                                                                                                                             | Waits for                                              |
| ---- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 0    | SSR HTML (`src/ssr/render.tsx`) | Server-rendered markup; the entry's CSS **inlined** as `<style data-href="/assets/css/…">`; one `<script type="module" src="/assets/js/main-*.js" fetchpriority="low">`. No `modulepreload` hints, on purpose (they compete with the login page's first paint).                                                                    | –                                                      |
| 1    | `bootstrap.ts` top-level code   | Runs on SSR pages too, because Rolldown puts it in the same chunk as `routes/protectedPageLoaders.ts`, which `main` imports. Registers the inlined CSS for Vite's preload helper (§2), calls `import("./main")` and, with a session flag, `prefetchProtectedEntry(path)` (the `ProtectedRoutes` chunk and the current page chunk). | `main`'s static imports                                |
| 2    | `main.tsx` module evaluation    | login strings; with a session also the full translation bundle (`ensurePrivateTranslationsLoaded`)                                                                                                                                                                                                                                 | –                                                      |
| 3    | `main.tsx` mount                | `hydrateRoot`/`createRoot`                                                                                                                                                                                                                                                                                                         | `minimalTranslationsReady`                             |
| 4    | `ProtectedRoutes` effect        | `GET /users/me/preferences`, then applies the account language                                                                                                                                                                                                                                                                     | full translations **and** preferences, both settled    |
| 5    | `ProtectedRoute` effect         | `GET /auth/legal-documents/status` and, if the role is unknown or administrative, `GET /auth/admin-password/status`                                                                                                                                                                                                                | legal status and, when required, admin-password status |
| 6    | Page                            | page component (chunk already prefetched); its own data queries (e.g. the published legal document, which is the LCP element on `/terms`, `/privacy`, `/cookie`)                                                                                                                                                                   | page chunk, page data                                  |

`ProtectedRoute` and `MainLayout` are imported eagerly by `ProtectedRoutes`. Each page has its own Suspense boundary _below_ the guard, so a pending page chunk can never unmount a settled guard.

## 2. Inlined CSS and Vite's preload helper

Vite's dynamic-import helper (`__vitePreload`) downloads each CSS file a dynamic import depends on, and **waits for it to load before running the imported module**. It only treats CSS as present if the page already has a `<link rel="stylesheet">` with that `href`; it does not recognise the SSR `<style data-href>` tags. Before #634's H9a fix, every page downloaded the 4 inlined entry stylesheets (~19.5 KB) a second time, at VeryHigh priority, and the route and page chunks waited for those duplicates.

`src/ssr/registerInlinedStylesheets.ts` adds a **disabled** `<link rel="stylesheet">` for each inlined `/assets/…css` file before the first dynamic import (`bootstrap.ts`, step 1). A link created from script with `disabled` set before `href` is neither fetched nor applied, so styling is unchanged. A `disabled` link written into the HTML would not work: Chrome's preload scanner fetches it anyway.

## 3. What the measurements show

**Where simulated LCP time goes.** Local reproduction, using the CI runner's Lighthouse settings against the production SSR build with a mocked API, gives LCP of 3.2–3.9 s. In each variant below, one throttling factor is neutralised:

| Variant             | Public `/terms` | Auth `/terms`, `/dashboard` |
| ------------------- | --------------- | --------------------------- |
| CI profile          | 3.25–3.42 s     | 3.59–3.91 s                 |
| No CPU slowdown     | 2.98–3.02 s     | 3.56–3.57 s (≈ no change)   |
| Unlimited bandwidth | 2.39–2.43 s     | 2.39–2.59 s                 |
| No RTT              | 0.59–0.60 s     | 0.50–0.63 s                 |

Round trips dominate, bandwidth comes second, and CPU barely matters on authenticated routes. The cost is the **number and depth of requests** through 6 HTTP/1.1 connections (36–48 requests per page, most under 5 KB), not JavaScript evaluation.

| Change                                                                                           | Result on simulated LCP                                                                                                                                                                                                                                                                                                                                                                                                    | Decision               |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Halve guard API calls (nested Suspense, #635 experiment B)                                       | no change (~4.05–4.07 s)                                                                                                                                                                                                                                                                                                                                                                                                   | not an LCP fix         |
| Collapse the serial chunk waterfall (#636)                                                       | ~4.1 s → ~3.4–3.6 s on all 8 routes                                                                                                                                                                                                                                                                                                                                                                                        | **retained**           |
| H7: start preferences and guard checks together at `main.tsx` evaluation (`2297988`)             | CI mean 3,526 → 3,532 ms; per-route Δ −89 … +136 ms, the same size as drift on public routes (CI [#45060720945](https://github.com/Konstantinospil/FitVibe/actions/runs/45060720945) vs [#45067153231](https://github.com/Konstantinospil/FitVibe/actions/runs/45067153231))                                                                                                                                               | **rejected, reverted** |
| H9a: stop re-downloading SSR-inlined CSS (§2), `9cb78ff`                                         | Local interleaved A/B, 10 runs/variant, median: public `/terms` −182, auth `/terms` −234, `/dashboard` −302, `/calendar` −242 ms. **CI** [#45072807563](https://github.com/Konstantinospil/FitVibe/actions/runs/45072807563): route-worst mean 3,543 → 3,330 ms (−213), every route improved; public real-backend Lighthouse 48/48 valid with **no budget breaches** (previously 10–11 at 3.03–3.17 s). FCP/CLS unchanged. | **retained**           |
| H10: group small shared modules into one chunk (`codeSplitting` group `shared-small`), `ba17c0c` | Local interleaved A/B on top of H9a, 6 runs/variant, median: `/login` −142, public `/terms` −174, `/dashboard` −371, `/calendar` −270 ms; 6–9 fewer requests per page; FCP/CLS unchanged. All 15 routes render identically with no new errors. CI pending.                                                                                                                                                                 | pending CI             |

## 4. Security invariants from #634

- **Guard identity binding** (`ProtectedRoute.tsx`): every guard result is stored with the identity key it was fetched for (user id + role class, or `unknown-user|role-missing` before the profile is known). The gate renders nothing until results for the current key arrive. One account's clearance never covers another.
- **Fail closed:** a failed legal check sends ordinary routes to `/terms-reacceptance`; a failed admin check requires the password update (except `ADMIN_2FA_REQUIRED`).
- **Query cache isolation** (`auth.store.ts`): the shared React Query cache is cleared on sign-out and when a different or unknown account signs in.
- **Reserved layout space:** the Dashboard Vibeform box (240×320) and the password strength meter are reserved before their lazy content loads, to avoid CLS and moving click targets.
- **Consent status on 429:** retried once, honouring `Retry-After` (≤ 10 s). Visitors who already chose are not re-prompted while the status is unavailable.
- **Inlined-CSS registration** only accepts same-origin `/assets/…css` paths from the SSR template's `data-href` attributes.

## 5. Remaining known costs (not yet addressed)

After H9a and H10 (CI #45075247857), authenticated worst-of-three LCP is 3,018–3,098 ms on 7 routes and 3,275 ms on `/`. Public real-backend routes pass.

- **Request count and depth** (§3). Remaining candidates, each to be tested on its own (sub-2 KB shared chunks are addressed by H10): loading the i18n string chunks (`common`, `auth`, `terms`, `privacy`, `cookie`, `minimal-login-common`, 6 requests) with fewer requests or earlier; and the late `fontLoader`/`appFontLoader` requests before LCP.
- After a reload `user` is `null` until sign-in, so every athlete also triggers the admin-password check. This is request hygiene, not an expected LCP win, given the H7 result.
- Page data requests (step 6) start only after the guard opens.
- **Measurement context (policy, not a fix):** the budget is measured over HTTP/1.1. If production serves HTTP/2 at its TLS edge, per-request round trips cost less there than in CI.

Every change to this path follows the experiment contract in issue #634: one hypothesis per change, baseline and patch SHAs, the unchanged worst-of-three gate, TBT/CLS counter-metrics, and an explicit retain/revert decision.
