# Frontend visual and component architecture

The active frontend follows one dependency direction and one visual authority.

## Ownership model

1. **Design tokens** — `apps/frontend/src/styles/tokens.css`
   - Figma typography, spacing, radii, opacity, elevations and shared component dimensions.
   - This is the canonical source for non-theme visual values.

2. **Themes** — `apps/frontend/src/styles/themes.css`
   - Semantic light/dark palette overrides.
   - Themes change token values; components do not duplicate theme-specific styling.

3. **Foundations and primitives**
   - `foundations.css`: reset, document defaults, focus/accessibility, scrollbar and shared motion.
   - `primitives.css`: reusable layout/content primitives.
   - `global.css`: import/orchestration entry point only.

4. **Reusable visual components** — `packages/ui`
   - Generic controls such as Button, Card, fields, Checkbox, Switch, Dropdown and Avatar.
   - React owns semantics, behavior and accessibility.
   - CSS owns reusable visual appearance and normal interaction states.
   - Component variants expose stable data attributes/classes and resolve visual values through design tokens.

5. **Reusable app composites** — `apps/frontend/src/components`
   - Application-level composition such as Modal, StatusPanel, Section, TrainingPanel and PageIntro.
   - May define component-specific geometry, but reusable aesthetics must resolve through the design system.

6. **Domain and page composition** — `apps/frontend/src/styles/surfaces.css` and route components
   - Pages own orchestration, data loading, sequencing and information-architecture-specific layout.
   - Domain geometry (for example calendar matrices or Vibeform constellation coordinates) may remain local.
   - Pages must not create independent colors, typography, radii, shadows, opacity or reusable control styling.

## Architectural rule

> Pages may compose. Domain components may define genuine domain geometry. Reusable components may define behavior. All reusable visual appearance must resolve from the central FitVibe design system.

## Dynamic aesthetic

The application's recognizable aesthetic is controlled through semantic tokens. Global changes such as light/dark theme, spacing rhythm, radii, typography, control sizing or future density variants should be possible primarily by changing token values rather than rewriting pages.

## Rules

- Figma Design System v2 remains the visual authority.
- Repeated visual or interaction patterns become components.
- When several components repeat the same lower-level arrangement, that arrangement becomes a composite or primitive.
- Generic controls belong in `@fitvibe/ui`; do not recreate app-local aliases.
- Normal hover/focus/active presentation belongs in CSS rather than JS state.
- Inline styles are reserved for genuinely runtime-calculated values or intrinsic data/visualization geometry.
- Hardcoded colors, typography, radius, opacity and shadows outside authority files are prohibited.
- Runtime/data colors require a narrow documented `architecture-token` exception.
- Bootstrap styling in `index.html` is a performance exception and must mirror the canonical semantic themes; it is not an independent palette.
- Archived frontend code is reference-only and may never be imported by active production code.
- Dependencies move downward only: primitives never import app code; composites/domain components never import pages.

## File responsibilities

```text
src/styles/
  tokens.css       # canonical non-theme visual values
  themes.css       # semantic light/dark values
  foundations.css  # document/global foundations
  primitives.css   # generic layout/content primitives
  components.css   # reusable app component presentation
  surfaces.css     # page/domain composition
  global.css       # imports design-system layers only

packages/ui/
  styles.css       # reusable generic component presentation
  *.tsx            # component semantics/behavior
```

The Architecture & Hardcoding QA job enforces design-token ownership and import direction. Exceptions must be narrow, explicit and justified rather than catch-all exclusions.
