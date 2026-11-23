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

| Change                                                                                                                                                | Result on simulated LCP                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Decision               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Halve guard API calls (nested Suspense, #635 experiment B)                                                                                            | no change (~4.05–4.07 s)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | not an LCP fix         |
| Collapse the serial chunk waterfall (#636)                                                                                                            | ~4.1 s → ~3.4–3.6 s on all 8 routes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | **retained**           |
| H7: start preferences and guard checks together at `main.tsx` evaluation (`2297988`)                                                                  | CI mean 3,526 → 3,532 ms; per-route Δ −89 … +136 ms, the same size as drift on public routes (CI [#45060720945](https://github.com/Konstantinospil/FitVibe/actions/runs/45060720945) vs [#45067153231](https://github.com/Konstantinospil/FitVibe/actions/runs/45067153231))                                                                                                                                                                                                                                           | **rejected, reverted** |
| H9a: stop re-downloading SSR-inlined CSS (§2), `9cb78ff`                                                                                              | Local interleaved A/B, 10 runs/variant, median: public `/terms` −182, auth `/terms` −234, `/dashboard` −302, `/calendar` −242 ms. **CI** [#45072807563](https://github.com/Konstantinospil/FitVibe/actions/runs/45072807563): route-worst mean 3,543 → 3,330 ms (−213), every route improved; public real-backend Lighthouse 48/48 valid with **no budget breaches** (previously 10–11 at 3.03–3.17 s). FCP/CLS unchanged.                                                                                             | **retained**           |
| H10: group small shared modules into one chunk (`codeSplitting` group `shared-small`), `ba17c0c`                                                      | Local interleaved A/B on top of H9a, 6 runs/variant, median: `/login` −142, public `/terms` −174, `/dashboard` −371, `/calendar` −270 ms; 6–9 fewer requests per page; FCP/CLS unchanged. All 15 routes render identically with no new errors. **CI** [#45075247857](https://github.com/Konstantinospil/FitVibe/actions/runs/45075247857): route-worst mean 3,330 → 3,083 ms (−247), every route improved, `/settings` score back ≥ 0.6; all other CI jobs pass.                                                       | **retained**           |
| H11: ship the minimal English strings (`auth`, `cookie`, `minimal-login-common`) in the entry graph instead of 3 requests (local only, not committed) | Local interleaved A/B on top of H10, 6 runs/variant, median: `/login` +37, public `/terms` +144, `/dashboard` +232, auth `/terms` +173 ms; TBT +50…65 ms. Removing 3 requests cost more than it saved, because the bytes and JSON evaluation moved onto the entry graph that every route waits for.                                                                                                                                                                                                                    | **rejected**           |
| H12: one `entry-shell` chunk for the 10 modules `main` already loads before mount (5 small chunks); local only, not committed                         | Pre-checks passed: identical modules and bytes before mount (217 modules, 561,543 B raw); `main`'s first wave 7 + 2 nested scripts → 5 in one round, ending ~170 ms earlier in the 150 ms/response timeline; 4 fewer requests per page; all 15 routes render as before. Local interleaved A/B, 10 runs/variant, median LCP: `/login` +5, public `/terms` +4, `/` +23, `/dashboard` −28, `/calendar` +84, `/settings` −14 ms; FCP, CLS unchanged. Retain criterion (≥ 80 ms better on most routes, none worse) not met. | **rejected**           |

### Repeat-run verification of H9a + H10

Authenticated route-worst LCP across every CI run of the same frontend code (`5183be4`, `a95b8bf`, `1c08120`; each commit ran as both `push` and `pull_request`). Older logs listed only breaching routes; full tables are printed since `714c664`.

| CI run                                                                                                 | Commit    | Mean of route-worst LCP | Routes ≤ 3,000 ms | Worst route        |
| ------------------------------------------------------------------------------------------------------ | --------- | ----------------------- | ----------------- | ------------------ |
| [45069996172](https://github.com/Konstantinospil/FitVibe/actions/runs/45069996172) (baseline, pre-H9a) | `d95c6e9` | 3,559 ms                | 0/8               | 3,666              |
| [45075247857](https://github.com/Konstantinospil/FitVibe/actions/runs/45075247857)                     | `5183be4` | 3,083 ms                | 0/8               | `/` 3,275          |
| [45075242078](https://github.com/Konstantinospil/FitVibe/actions/runs/45075242078)                     | `5183be4` | (breaches only)         | 4/8               | `/dashboard` 3,139 |
| [45077739973](https://github.com/Konstantinospil/FitVibe/actions/runs/45077739973)                     | `a95b8bf` | 3,047 ms                | 0/8               | `/` 3,132          |
| [45077744634](https://github.com/Konstantinospil/FitVibe/actions/runs/45077744634)                     | `a95b8bf` | (breaches only)         | 4/8               | `/` 3,042          |
| [45127000965](https://github.com/Konstantinospil/FitVibe/actions/runs/45127000965)                     | `1c08120` | 3,006 ms                | 6/8               | `/dashboard` 3,142 |
| [45126994096](https://github.com/Konstantinospil/FitVibe/actions/runs/45126994096)                     | `1c08120` | 3,005 ms                | 6/8               | `/dashboard` 3,111 |

The ~500 ms reduction persists in all six runs. Within a run, the 3 runs per route are usually within 50 ms, but routes now sit within ±60 ms of the 3,000 ms budget, so **pass/fail of the gate is currently dominated by noise**. The worst results come from single outlier runs (e.g. `/dashboard` 2,982, 3,142, 2,982). The public real-backend gate passed in every run (2.64–2.73 s in the full tables).

**Not asserted, found in the new tables:** `/settings` CLS 0.326–0.440 (above the 0.25 "poor" threshold). It is intermittent and identical on the pre-H9a build locally, so it is pre-existing, not caused by #634 work. CLS is not part of `lighthouserc.ci.json`'s assertions.

## 3a. The common critical path (all routes)

Request timeline of the H10 build, with every response delayed a fixed 150 ms (the same shape on all 8 authenticated routes; public routes share W0–W4). Times are when requests start/finish:

| Wave | ~ms      | Requests                                                                                                                      | Waits for                                                               |
| ---- | -------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| W0   | 0–165    | HTML                                                                                                                          | –                                                                       |
| W1   | 190–360  | `main` (low priority, by design)                                                                                              | parser                                                                  |
| W2   | 360–700  | `main`'s 7 static chunks (`src`, vendor, `shared-small`, `index`, `CookieConsent`, `TwoFactorManagement`, `LanguageSwitcher`) | `main`; **7 requests on 6 HTTP/1.1 connections → 2 rounds**             |
| W3   | 540–700  | `idleScheduler`, `CustomScrollbar`                                                                                            | imports of `shared-small`                                               |
| W4   | 700–1040 | `ProtectedRoutes` + page chunks (prefetched by `bootstrap.ts`) and the 6 i18n string chunks                                   | the whole entry graph having evaluated; 12 requests → 2 rounds          |
| W5   | ~1070    | `/users/me/preferences`, `/auth/2fa/status`                                                                                   | mount, which waits for the minimal strings (`minimalTranslationsReady`) |
| W6   | ~1240    | `/auth/legal-documents/status`, `/auth/admin-password/status`                                                                 | preferences / full translations (`ProtectedRoutes`)                     |
| W7   | ~1420    | page data                                                                                                                     | the guard                                                               |

Two consequences for the simulated gate:

- Lighthouse's simulation models a data request as depending on the script that issued it, not on the `await` chain before it. That is why moving W5/W6 earlier (H7) did not change simulated LCP, while removing code requests from W2–W4 (H9a, H10) did.
- Moving bytes _into_ the entry graph to save requests (H11) made every route slower.
- Collapsing W2 from 2 rounds to 1 with **identical bytes** (H12) made real loading ~170 ms faster in the timeline but did **not** change simulated LCP. So connection contention in W2 is not what Lighthouse's simulation charges; the wave picture above describes real loading, not the simulated critical path. The next step is to read the simulated critical path directly (Lighthouse's Lantern LCP graph from a saved trace) instead of inferring it from waves.

**Checked:** with a mocked API, the LCP element on authenticated routes was the first-login two-factor prompt overlay. In CI (real backend) it is page content on all 8 routes (headings, legal text, the calendar date), so the gate times the pages themselves. The report table prints each route's worst-run LCP element.

## 3b. Measurement validity and bounded recoveries

A run counts only if it is valid: right route and identity, same-navigation content readiness, the required backend responses, no error/loading fallback, and no consent overlay as LCP (`tests/perf/lighthouse-measurement-validity.cjs`). Coverage requires exactly 3 valid runs per route (and per scenario on public routes). Two kinds of run may be re-collected once, and only because they **measured nothing about the page**:

| Recovery                                    | Condition                                                                                                                     | Never applies to                                                                       | Limit                       |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------- |
| Consent-status 429 (authenticated)          | the real `/api/v1/consent/cookie-status` returned 429; `Retry-After` is honoured                                              | valid runs                                                                             | 1 retry per run             |
| Trace collection (public and authenticated) | Lighthouse runtime error `NO_NAVSTART`, `NO_TRACING_STARTED` or `TRACING_ALREADY_STARTED` **and** the report has no LCP value | any run with an LCP value, however slow; `NO_FCP`, document-request failures, timeouts | 1 retry per run, 3 per step |

Every attempt's report is kept (`-retry-N`), and recoveries are logged and written to `consent-recovery-events.json` / `trace-recoveries.json`. Since a recovered run measured nothing, re-collecting it cannot select a faster result. The cap keeps systematic breakage failing.

The job log and step summary print each runner's full table: worst-of-three per route, every run's LCP, and the worst run's LCP element.

## 4. Security invariants from #634

- **Guard identity binding** (`ProtectedRoute.tsx`): every guard result is stored with the identity key it was fetched for (user id + role class, or `unknown-user|role-missing` before the profile is known). The gate renders nothing until results for the current key arrive. One account's clearance never covers another.
- **Fail closed:** a failed legal check sends ordinary routes to `/terms-reacceptance`; a failed admin check requires the password update (except `ADMIN_2FA_REQUIRED`).
- **Query cache isolation** (`auth.store.ts`): the shared React Query cache is cleared on sign-out and when a different or unknown account signs in.
- **Reserved layout space:** the Dashboard Vibeform box (240×320) and the password strength meter are reserved before their lazy content loads, to avoid CLS and moving click targets.
- **Consent status on 429:** retried once, honouring `Retry-After` (≤ 10 s). Visitors who already chose are not re-prompted while the status is unavailable.
- **Inlined-CSS registration** only accepts same-origin `/assets/…css` paths from the SSR template's `data-href` attributes.

## 5. Remaining known costs (not yet addressed)

After H9a and H10, authenticated route-worst LCP averages 3.0–3.08 s across six CI runs, with 0–6 of 8 routes under budget depending on noise (§3, repeat-run verification). Public real-backend routes pass.

- **Simulated critical path unknown in detail** (§3a). H12 showed that W2's connection contention is not charged by the simulation. Before another code change, extract the nodes on Lantern's LCP critical path from saved traces (local reproduction, same settings), then target what is actually on it. Candidates still open: starting the i18n string requests earlier _without_ inlining them; the `fontLoader`/`appFontLoader` requests before LCP.
- After a reload `user` is `null` until sign-in, so every athlete also triggers the admin-password check. This is request hygiene, not an expected LCP win, given the H7 result.
- Page data requests (step 6) start only after the guard opens.
- **Measurement context (policy, not a fix):** the budget is measured over HTTP/1.1. If production serves HTTP/2 at its TLS edge, per-request round trips cost less there than in CI.

Every change to this path follows the experiment contract in issue #634: one hypothesis per change, baseline and patch SHAs, the unchanged worst-of-three gate, TBT/CLS counter-metrics, and an explicit retain/revert decision.
