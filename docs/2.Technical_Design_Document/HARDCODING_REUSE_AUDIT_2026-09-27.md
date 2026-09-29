# Issue #302 — Hardcoding & Reuse Audit Inventory

**Audit branch:** `audit/302-hardcoding-reuse-inventory`  
**Baseline:** `dev@7ad6f5e53e9d600471e9098dcec685b9cbf18672`  
**Date:** 2026-09-27  
**Parent:** #301

## Purpose

This is the authoritative classification inventory required by #302. It records existing repository debt before remediation. It does not change runtime behavior.

Classification categories:

1. governed global application setting;
2. environment / secret / infrastructure configuration;
3. code-level implementation constant;
4. frontend design-token violation;
5. duplicated/reimplemented UI primitive;
6. canonical domain data / database-backed policy;
7. human decision required.

## Governing rules

- No existing violation is grandfathered.
- Secrets and deployment topology remain outside application settings.
- System-wide runtime behavior belongs in governed settings when a superadmin should be able to change it without source changes.
- Product/domain catalogue data belongs in canonical persisted data where history/versioning matters.
- Pure implementation constants stay in code.
- Frontend feature code should consume semantic design tokens and shared primitives.
- Remediation must not be achieved by blanket suppressions or meaningless constant extraction.

---

## A. Environment / infrastructure configuration — retain outside governed app settings

These values are correctly environment-, secret-, or deployment-owned and should remain outside the app-settings mechanism:

- database host/port/name/user/password/URL and TLS material;
- JWT signing keys and key file paths;
- Vault address/token/namespace;
- Redis host/port/password/database and whether Redis is provisioned;
- SMTP credentials/host/port;
- storage root;
- service ports and public/base URLs;
- trusted proxy topology and allowed proxy IPs;
- ClamAV host/port;
- TOTP encryption key;
- cookie domain and secure transport deployment flags.

Primary source: `apps/backend/src/config/env.ts`.

### Classification

**Disposition:** environment / secret / infrastructure configuration.

### Remediation note

#303 must not import these into governed runtime settings. Validation may be tightened, but authority stays with deployment configuration.

---

## B. Global runtime policy currently mixed into environment configuration

The following are globally meaningful runtime policies rather than infrastructure topology:

| Current value/source | Current default | Preliminary classification | Target |
|---|---:|---|---|
| access-token TTL | 900 s | security policy | deployment/security configuration |
| refresh-token TTL | 14 d | security policy | deployment/security configuration |
| email-verification TTL | 15 min | security policy | governed setting candidate |
| password-reset TTL | 15 min | security policy | governed setting candidate |
| global API rate-limit points | 120 | abuse/security policy | governed setting candidate |
| global API rate-limit duration | 60 s | abuse/security policy | governed setting candidate |
| type-cache TTL | 60 s | operational policy | likely implementation/runtime setting |
| DSR purge delay | 15 min | privacy/operations policy | governed setting candidate |
| DSR backup purge | 14 d | privacy/retention policy | governed setting candidate |
| maintenance message | text | application behavior/content | governed setting |
| JWT key rotation interval | 90 d | security operations policy | decision required |
| BullMQ worker concurrency | 5 | deployment capacity | environment/infrastructure |
| BullMQ rate-limit max/duration | 100 / 60 s | queue operations | environment/infrastructure unless product semantics depend on it |
| feed blocked keywords | env list | moderation policy | governed setting / persisted policy candidate |

Source: `apps/backend/src/config/env.ts`.

### Classification

This file currently combines deployment configuration and product/security policy in one authority surface. #303/#305 must separate them.

---

## C. Authentication/security policy hardcoded in code

### Password policy

`apps/backend/src/modules/auth/passwordPolicy.ts`

Current policy:
- minimum 12 characters;
- at least one lowercase character;
- at least one uppercase character;
- at least one digit;
- at least one non-word/non-space character;
- password may not contain username/alias;
- password may not contain email local part.

**Classification:** system-wide authentication policy. This is not a local implementation constant.

**Target:** partly configurable governed security policy with non-disableable security floors/invariants in code. Runtime-configurable parameters must never permit weakening below the coded safety floor.

### Authentication timing normalization

`apps/backend/src/modules/auth/timing.utils.ts`

Observed policy includes:
- minimum authentication operation duration;
- random jitter;
- maximum timing-variance acceptance threshold.

**Classification:** security implementation + policy mix.

**Target:** cryptographic/timing mechanics stay in code; system-wide thresholds that may require operational tuning should be explicitly classified rather than scattered literals.

### TOTP / backup-code policy

`apps/backend/src/modules/auth/two-factor.service.ts`

Current policy includes:
- issuer/app name `FitVibe`;
- TOTP step 30 s;
- verification window ±1 step;
- 10 backup codes;
- 8 characters per backup code;
- bcrypt work factor hardcoded at 10 for backup-code hashing.

**Classification:**
- TOTP algorithm mechanics: code-level security invariant;
- issuer/app display name: application identity, derived from canonical app name;
- backup-code count/length: security policy;
- bcrypt cost: security policy / implementation security parameter.

**Important:** recovery codes are valid for ordinary account 2FA recovery today, but #303/#304 explicitly prohibit them for privileged configuration commits and privileged role changes.

---

## D. Rate-limit policy scattered across middleware

`apps/backend/src/middlewares/rate-limit.ts`

Current defaults include:
- generic limiter: 60 requests / 60 seconds;
- contact IP+email limiter: 5 requests / 3600 seconds;
- route-specific callers may supply additional values.

**Classification:** rate limiting is a security/abuse-control policy. Generic algorithm and limiter implementation remain in code; globally meaningful limits should come from a canonical policy/settings authority.

**Remediation:** #305 should inventory each caller and remove unexplained route-local magic numbers. #303 should expose only settings that are safe and meaningful for runtime governance.

---

## E. Gamification and product policy hardcoded in backend services

### Seasonal events

`apps/backend/src/modules/points/seasonal-events.service.ts`

The service explicitly states that production events should come from a database table, but currently embeds 2025 campaigns with:
- campaign codes/names;
- start/end timestamps;
- point multipliers;
- session thresholds;
- bonus points.

All three embedded campaigns are historical as of this audit.

**Classification:** canonical domain/catalogue data, not application code and not a simple global scalar setting.

**Target:** persisted, versioned seasonal-event catalogue controlled by the product/design authority. Gamification is explicitly outside both normal-admin and superadmin authority. Do not move campaign fields into generic app settings. The exact designer authoring workflow/interface remains a later design decision.

### Streak rules

`apps/backend/src/modules/points/streaks.service.ts`

Current hardcoded product rules:
- 90-day lookback/safety cap;
- bonus tiers: 3→5, 7→10, 14→20, 30→50 points.

**Classification:** gamification product policy.

**Target:** persisted, versioned designer-owned gamification ruleset so historical point calculations remain explainable and reproducible by algorithm version. Admins and superadmins must not be able to alter these rules.

### Badge criteria

`apps/backend/src/modules/points/badge-criteria.ts`

Observed:
- canonical vibe codes are embedded in code;
- default distinct-window is 7 days;
- badge thresholds otherwise arrive as criterion data.

**Classification:**
- six vibe codes are canonical domain enum semantics and may remain a shared domain enum if authoritative elsewhere;
- default 7-day window is product policy and must not be an unexplained fallback;
- badge thresholds belong to catalogue data.

---

## F. Maintenance/read-only authority conflict

`apps/backend/src/config/env.ts` currently exposes `READ_ONLY_MODE` as an environment-derived boolean.

The agreed #301/#303 model requires:
- maintenance/read-only state to persist across restart;
- superadmin-controlled activation/deactivation;
- settings revision and loaded-runtime revision comparison;
- maintenance may end only after persisted and loaded revisions match.

**Classification:** current environment-only read-only authority is incompatible with the agreed target architecture.

**Target:** persistent database-backed maintenance state with deployment/runtime integration. Environment configuration may retain an emergency override only if explicitly designed as a fail-safe and documented in the ADR.

---

## G. Frontend design-token violations

Repository search and direct inspection found feature code with raw visual constants even where semantic tokens already exist.

Representative examples:

- `apps/frontend/src/contexts/ToastContext.tsx`
  - raw `12px` radius and `1rem` spacing;
- `apps/frontend/src/components/ConfirmDialog.tsx`
  - raw `16px` radius, spacing and layout values;
- `apps/frontend/src/components/ui/Card.tsx`
  - primitive itself embeds raw radius/blur values rather than fully consuming canonical tokens;
- `apps/frontend/src/components/ui/Chart.tsx`
  - raw RGBA tooltip colors, radius and spacing;
- `apps/frontend/src/pages/Home.tsx`
  - raw `400px`, `1400px`, glow constants and local layout values;
- `apps/frontend/src/pages/Planner.tsx`
  - raw radius/font-size values;
- `apps/frontend/src/styles/global.css`
  - raw RGBA, shadow, letter-spacing and font-size values remain outside the token layer;
- multiple feature pages use local inline style objects for values that should be semantic tokens/classes.

**Classification:** #306 remediation, with a distinction between:
1. values that belong in design tokens;
2. component-internal geometry that is legitimately owned by the primitive;
3. one-off layout values that remain local but should use named layout tokens if reused/systemic.

---

## H. Reimplemented controls / component duplication

The athlete frontend already contains shared primitives such as:
- `Button`;
- `Input`;
- `Select`;
- `Textarea`;
- `Card`;
- `Modal`.

However raw native controls are still implemented directly in feature pages, including representative occurrences in:
- `apps/frontend/src/pages/Feed.tsx`;
- `apps/frontend/src/pages/Exercises.tsx`;
- `apps/frontend/src/pages/Logger.tsx`;
- `apps/frontend/src/pages/Planner.tsx`;
- `apps/frontend/src/pages/Home.tsx`;
- `apps/frontend/src/pages/admin/Translations.tsx`.

Backoffice has its own `Button` and `Card` primitives but feature pages still reimplement controls and styling directly, notably:
- `apps/backoffice/src/pages/Users.tsx`;
- `apps/backoffice/src/pages/AuditLogs.tsx`;
- `apps/backoffice/src/pages/Translations.tsx`.

`apps/backoffice/src/pages/Users.tsx` is a high-value remediation target: it duplicates button styles repeatedly, manually implements role-change modal/control styling, and even constructs an avatar fallback element imperatively with raw CSS.

**Classification:** duplicated/reimplemented UI primitives → #306.

---

## I. Cross-application design-system duplication

Athlete frontend and backoffice each define their own implementations of common primitives such as `Button` and `Card`, with similar structure but diverging visual constants.

**Classification:** architecture/reuse decision.

**Decision:** maximize reuse between athlete frontend and backoffice. Use a shared low-level primitive/token foundation wherever behavior, accessibility and interaction contracts can be common. Application-specific feature composites and genuinely different interaction patterns may remain separate, but duplication should require a concrete reason rather than being the default.

---

## J. Legitimate implementation constants / exceptions

The audit must not convert all literals into settings.

Examples expected to remain code-owned include:
- HTTP status codes;
- cryptographic algorithm identifiers such as RS256;
- database table/column names;
- fixed protocol syntax and MIME types;
- mathematical conversion factors;
- DOM/layout mechanics local to a component when not part of a system-wide visual rule;
- invariant enums whose change would require a schema/domain migration rather than runtime configuration.

Every exception used by the future CI rule must be narrow and machine-checkable.

---

## Human decisions

### D302-01 — Security TTL authority — DECIDED

Access-token and refresh-token TTLs remain **deployment/security configuration**. They are not editable from backoffice or the governed app-settings interface. User-facing recovery/verification TTLs may still be governed settings.

### D302-02 — Password-policy configurability — DECIDED

Password policy is **partly configurable with non-disableable minimum security floors/invariants in code**. Runtime configuration must never permit a weaker policy than the coded floor.

### D302-03 — Gamification policy authority — DECIDED

Gamification rules are **designer-owned domain policy**, not administrator-controlled application settings. Normal admins and superadmins have no authority to change seasonal events, streak tiers, badge criteria, points rules or similar gamification semantics.

These rules must be versioned so historical awards remain reproducible. The designer authoring workflow/interface is intentionally deferred until that module is implemented.

### D302-04 — Shared athlete/backoffice UI foundation — DECIDED

Athlete frontend and backoffice should **reuse as much low-level UI infrastructure as reasonably possible**: shared semantic tokens, accessible primitives, interaction contracts and common implementation should be preferred. Feature-level components remain application-specific only where their behavior or context genuinely differs.

### D302-05 — Emergency maintenance override — DECIDED

Retain an environment/deployment-level emergency read-only override in addition to the persisted governed maintenance state.

Effective state is fail-closed:

`effectiveReadOnly = persistedMaintenanceReadOnly OR emergencyReadOnly OR activationSafetyReadOnly`

The emergency override may only force read-only **ON**. It can never force the application writable when persisted maintenance is active.

Read-only is forced only under explicit, deterministic conditions:

1. **Persisted maintenance is active** — a superadmin deliberately opened a maintenance window.
2. **Emergency deployment override is active** — the server/deployment operator explicitly forces read-only through deployment configuration.
3. **Settings activation is incomplete or inconsistent** — a governed settings revision has been committed but the loaded runtime revision does not match the persisted active revision, or an activation is still pending verification after restart.

Read-only must **not** be triggered automatically by generic application errors, transient dependency failures, high load, failed background jobs, or monitoring alerts. Those conditions should degrade or fail according to their own health/error policy rather than silently changing application authority.

If the database or settings authority cannot be read safely at startup, privileged/write paths must fail closed; the implementation may expose a maintenance/unavailable state, but must not assume writable operation.

The UI/API must expose the source(s) of read-only state so operators can distinguish persisted maintenance, emergency override and activation-safety lock.

---

## Child issue mapping

- **#303 Govern global application settings**
  - governed runtime policy registry;
  - persisted maintenance state;
  - revision/activation semantics;
  - appropriate operational/privacy/moderation settings.

- **#304 Superadmin role, sudo step-up and admin privilege management**
  - privileged authority model; no change to this inventory except consuming classified policies.

- **#305 Remove backend hardcoded policy and semantic values**
  - password/rate-limit/auth policy cleanup;
  - gamification/domain policy extraction;
  - environment-vs-setting separation;
  - unexplained semantic literals.

- **#306 Remove frontend design-token hardcoding and component duplication**
  - raw visual constants;
  - raw native controls where canonical primitives exist;
  - backoffice duplication;
  - shared frontend/backoffice foundation according to D302-04.

- **#307 Architecture & Hardcoding CI gate**
  - enforce the classifications above after remediation;
  - no baseline/grandfather file.

## Current #302 status

**Decision-complete.** D302-01 through D302-05 are decided. The audit inventory is ready for final review/merge and #302 closure.


### Implementation status — #303

The governed application-settings implementation is currently under CI validation. This documentation update does not change runtime behavior.


### Implementation status — #305

Backend remediation applies the #302 authority decisions as follows:

- governed settings own password minimum length (above the coded floor), email-verification TTL, password-reset TTL, global API rate-limit parameters, DSR timing, maintenance message and feed moderation keywords;
- deployment configuration retains secrets, infrastructure endpoints, access/refresh token TTLs and the emergency read-only override;
- authentication cryptographic/mechanical invariants are code-owned in a canonical security policy and cannot be weakened by app settings;
- route-specific abuse-control thresholds remain code-reviewed security policy, but are centralized in one canonical map rather than repeated as route-local magic numbers;
- seasonal events, streak lookback and streak bonus tiers are designer-owned, persisted and versioned in the database; point awards record the policy version used;
- badge criteria that depend on a time window must carry that window explicitly in persisted catalog data; there is no implicit product-policy fallback;
- the exercise-type cache TTL remains a narrow implementation constant because it changes cache mechanics rather than product, security or administrative semantics;
- the legacy normal-admin read-only mutation endpoints are removed; persisted maintenance changes remain under the superadmin governed-settings workflow.

Future designer tooling may author new gamification policy versions, but it must not grant gamification authority to normal admins or superadmins.
