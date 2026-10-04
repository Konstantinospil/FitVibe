# @fitvibe/types

Shared TypeScript contracts used by FitVibe applications and tooling.

The package currently exposes:

- API contract unions from `src/contracts.d.ts` such as `UserStatus`, `SessionStatus`, and `SessionVisibility`.
- Vibeform types from `src/vibeform.d.ts`.

Application code may also resolve the API unions through the `@fitvibe/contracts` path alias. Do not add parallel app-local copies of these shared unions.

## Build

```bash
pnpm --filter @fitvibe/types build
```

## Usage

```ts
import type { SessionVisibility, UserStatus } from "@fitvibe/types";
```

### Adding or changing a shared contract

1. Update the appropriate definition under `src/`.
2. Export it from `src/index.ts` when it belongs to the package surface.
3. Update consumers rather than introducing duplicate local unions.
4. Run the package and application type checks.
