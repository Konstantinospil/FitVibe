# FitVibe filesystem blueprint

Canonical **intended** layout. Do not dump the working tree (including `.git`) into this file.

```text
fitvibe/
├── apps/
│   ├── backend/          # Express API (default PORT 4000)
│   ├── frontend/         # React + Vite SPA / optional SSR
│   └── backoffice/       # Admin SPA
├── packages/
│   ├── types/
│   ├── ui/
│   ├── i18n/
│   ├── utils/
│   ├── eslint-config/
│   └── tsconfig/
├── docs/                 # Product SSOT (PRD, TDD, ADRs, QA, policies)
├── infra/                # Docker Compose, Kubernetes, scripts
├── tests/                # E2E, integration, performance
├── .github/workflows/
└── package.json          # packageManager: pnpm@12.5.1 (single pnpm pin: CI, lockfile, Docker)
```

Identifiers are UUID v4. Role codes: `athlete`, `admin`, `coach`, `support`. A session is a workout.
