# Frontend component pyramid

The active frontend follows one dependency direction:

1. **Design tokens and generic primitives** — `packages/ui`
2. **Reusable app composites** — `apps/frontend/src/components/composites`
3. **Domain components** — `apps/frontend/src/components/domain`
4. **Layouts and page sections** — app shell and page-scale composition
5. **Pages and routes** — orchestration, data loading, and page-specific flow only

## Rules

- Repeated visual or interaction patterns become components.
- When several components repeat the same lower-level arrangement, that arrangement becomes a composite.
- Generic controls belong in `@fitvibe/ui`; do not recreate app-local aliases.
- Domain-specific visuals such as Vibe badges remain app/domain components.
- Pages may own state, data fetching, navigation flow, and page-specific sequencing, but reusable visual construction belongs below the page layer.
- Dependencies move downward only. Primitives never import app code; composites/domain components never import pages.
- Archived frontend code is reference-only and may never be imported by active production code.
- Figma palette, typography, radius, opacity, spacing, and predefined component sizes remain the visual authority.

The architecture QA job enforces the import direction and rejects a reintroduced `components/ui` alias layer.
