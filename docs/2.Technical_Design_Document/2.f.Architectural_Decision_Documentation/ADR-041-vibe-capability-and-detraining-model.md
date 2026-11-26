# ADR-041: Vibe capability and detraining model for the Vibeform

**Date:** 2026-11-26
**Status:** Proposed
**Author:** FitVibe team (drafted with Claude)
**Cross-References:** ADR-034 (endogenous Vibe progression), Issue #271 (mount Vibeform), Issue #348 (Dashboard and Vibeform), Issue #353 (fitness benchmark research), `apps/backend/src/modules/vibeforms/`, `apps/backend/src/modules/points/vibe-level.service.ts`

---

## Context

The Vibeform is meant to be both an identity and a mirror. The athlete chooses a base form, and their current training state shapes it, both as they train and as they stop training.

Today the six Vibe inputs to the Vibeform are the ADR-034 Vibe levels, normalised as `(L − 100) / 2900`. Levels are bounded to 100–3,000 and never decrease without training. Only the regional body loads fade, using a 12-week window and a 42-day half-life (`VIBEFORM_CALCULATION_VERSION = "2"`). So the Vibeform cannot show detraining.

Points, Vibe levels and leaderboards represent lifetime achievement. Making them decay would punish holidays, illness and injury, so detraining needs its own quantity.

## Decision

### 1. A per-Vibe capability with experience-softened decay

For each athlete and each Vibe _v_, capability is:

```
Retention(E, R) = exp( − k0_v / ln(E + e) · R^p )        p = 1.5
C               = V · ln(E + 1) · Retention(E, R)
```

| Symbol | Meaning                                                                  |
| ------ | ------------------------------------------------------------------------ |
| V      | Stored training volume on the Vibe (see 2)                               |
| E      | Experience: days since the athlete's first session that trained the Vibe |
| R      | Rest: days since the last session that trained the Vibe                  |
| k0_v   | Decay factor for the Vibe (see 5)                                        |
| p      | 1.5, so the decay starts slowly and speeds up as the rest gets longer    |

More experience softens the decay, but only logarithmically.

### 2. Decay applies to the stored volume

Lost capability has to be rebuilt; one session after a long break does not restore it. The calculation runs at read time, with no scheduled job:

- **Stored per athlete and Vibe:** `V`, `first_trained_at`, `last_trained_at`, `peak_capability`.
- **On read:** `V_now = V · Retention(E, R)`, then `C = V_now · ln(E + 1)`.
- **On a session that trains the Vibe:** `V ← V · Retention(E, R) + session_volume`. Then `last_trained_at ← session time` and `peak_capability ← max(peak_capability, C)`.

A long gap therefore gives the same result whether it is read once or many times.

### 3. A floor relative to the athlete's own peak

The capability used for display is `max(C, 0.15 · peak_capability)`. After a long break, an experienced athlete stays ahead of a beginner, and nobody drops to zero.

### 4. Form is relative to the athlete's own peak, with a starter peak

```
form_v = max(C, 0.15 · peak_capability) / max(peak_capability, starter_peak_v)     ∈ [0, 1]
```

`starter_peak_v` is a fixed baseline per Vibe, so a first session does not show full form.

### 5. k0 is set per Vibe

Structural Vibes (for example Strength) get a slower decay than metabolic ones (for example Endurance). Every exercise that trains a Vibe uses that Vibe's k0, whatever the sport.

### 6. The Vibeform input is level × form

Form alone would put every trained Vibe at 1.0, and an endurance athlete and a strength athlete would look the same. The six inputs to the Vibeform are therefore:

```
input_v = N(level_v) · form_v        N(L) = (L − 100) / 2900, clamped to [0, 1]
```

The ADR-034 levels keep the athlete's specialisation visible. Form shrinks that shape while the athlete isn't training. Vibe balance may show form per Vibe next to the levels.

### 7. Scope

- Capability and form drive only the Vibeform and Vibe balance.
- Points, Vibe levels, the below-average balance bonus, badges and leaderboards stay exactly as ADR-034 defines them.
- The frontend never calculates capability; it reads it from `GET /api/v1/vibeforms/me`.
- The change ships as `VIBEFORM_CALCULATION_VERSION = "3"`.

### 8. Accepted risk: token sessions

With p = 1.5, the decay restarts slowly after every session. A near-empty session every two weeks keeps about 20 % of capability after six months, against about 0.3 % for stopping completely. This is accepted for the MVP's private group. If it is abused, the fix is that a session resets R only when it adds a minimum share of the stored volume.

## Calibration (to be fixed before implementation)

| Parameter      | Needed                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------- |
| Volume unit    | One unit per Vibe for `session_volume`, for example Vibe points, sets × load or minutes        |
| k0_v           | A value per Vibe. Reference: k0 = 0.0147 keeps 50 % after 30 days off at 30 days of experience |
| starter_peak_v | A value per Vibe                                                                               |
| Floor          | 15 % of peak, adjustable                                                                       |

Reference retention with k0 = 0.0147 and no floor:

| Experience | 1 week off | 4 weeks | 8 weeks | 26 weeks |
| ---------- | ---------- | ------- | ------- | -------- |
| 1 month    | 93 %       | 59 %    | 25 %    | 0 %      |
| 1 year     | 96 %       | 69 %    | 36 %    | 0 %      |
| 3 years    | 96 %       | 73 %    | 42 %    | 1 %      |

## Consequences

- **Detraining is visible:** the Vibeform shows it without touching lifetime achievements.
- **Recomputable state:** the per-Vibe state comes from completed sessions alone, so it can be rebuilt from history for existing athletes and after any recalibration.
- **No validated benchmark:** capability is a training-derived estimate, not a measured capability. Benchmarks remain with #353, and the UI must not present capability as a test result.
- **Migration:** a new per-athlete, per-Vibe table, plus a backfill from session history.

## Alternatives considered

- **Divide levels by `ln(days since joining)`:** rejected. It shrinks every athlete's levels over time, even those who train daily, and is undefined on day 1.
- **Decaying ADR-034 levels:** rejected. It would punish breaks in points and leaderboards.
- **A stateless formula that recomputes from R only:** rejected. One session after a long break restores full capability.
- **p = 1 (plain exponential):** timing couldn't be gamed, but early detraining would be too steep and late detraining too flat for the intended curve.
