# FitVibe

> A full-stack fitness platform for planning, executing, logging, sharing, and analysing training across multiple fitness domains ("Vibes").

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Node.js](https://img.shields.io/badge/Node.js-24%2B-339933)
![pnpm](https://img.shields.io/badge/pnpm-12-F69220)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6)

## Status

FitVibe is under active development. The `main` branch is the production/release baseline and currently reports version **2.1.0**.

This README describes the repository as it exists today. The product requirements under
[`docs/1.Product_Requirements/`](docs/1.Product_Requirements/) define the intended product scope; open GitHub issues and roadmap items may therefore describe capabilities that are still being completed or verified.

## Product concept

FitVibe is designed around six complementary training domains. The goal is not only to record individual workouts, but to make training structure, consistency, progress, and balance visible over time.

| Vibe | Element | Focus |
| --- | --- | --- |
| Strength | Earth | Force, resistance and strength-oriented training |
| Agility | Air | Coordination, movement quality and skill |
| Endurance | Water | Sustained aerobic and work-capacity training |
| Explosivity | Fire | Speed, power and short high-intensity efforts |
| Intelligence | Shadow | Skill, strategy and cognitively demanding activities |
| Regeneration | Aether | Recovery, mobility and restorative work |

## Current repository capabilities

The implementation has grown beyond the original minimal fitness tracker. Current code includes:

- **Authentication and account security** — registration, login, email verification, password reset, session management, CSRF protection, rate limiting and two-factor authentication support.
- **Training planning and execution** — calendar, exercise library, exercises, sessions and training-plan backend modules.
- **Progress and profile data** — dashboard/progress APIs, points, measurements and Vibeform-related domain support.
- **Social and sharing services** — feed, reactions/bookmarks/sharing and moderation-oriented backend capabilities.
- **Privacy and legal controls** — cookie-consent handling, legal-document flows, user settings and consent persistence.
- **Administration** — a separate Backoffice application for user administration, translations, contact messages and operational controls.
- **Operations** — health endpoints, structured logging, metrics/telemetry, background jobs, Redis integration and ClamAV-backed upload scanning.
- **Quality engineering** — unit, integration, contract, end-to-end, accessibility, visual-regression, performance, architecture and security checks.

Not every backend capability is necessarily exposed as a completed end-user workflow. The issue tracker and canonical product documentation remain the source of truth for incomplete acceptance criteria and planned work.

## Architecture

FitVibe is a **pnpm/Turborepo monorepo** with three applications and shared packages:

```text
FitVibe/
├── apps/
│   ├── backend/          # Express 5 + TypeScript REST API
│   ├── frontend/         # Main Vite/React user application
│   └── backoffice/       # Separate administrative UI
├── packages/
│   ├── ui/               # Shared UI primitives
│   ├── i18n/             # Shared internationalisation resources/tooling
│   ├── types/            # Shared types
│   ├── utils/            # Shared utilities
│   ├── eslint-config/    # Shared lint configuration
│   └── tsconfig/         # Shared TypeScript configuration
├── tests/                # Cross-application QA, E2E, visual and security tests
├── docs/                 # Product, design, architecture, QA and policy documentation
├── infra/                # Docker, Nginx, observability and deployment configuration
└── scripts/              # Repository and deployment validation scripts
```

### Main technology stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, Preact-compatible tooling, Vite 8, TypeScript 6, TanStack Query, Zustand, i18next |
| Backoffice | React 19 / Vite 8, shared `@fitvibe/ui` components |
| Backend | Node.js 24+, Express 5, TypeScript 6, Knex |
| Persistence | PostgreSQL |
| Jobs/cache | Redis + BullMQ |
| File processing | ClamAV, Sharp |
| Security | Helmet, CSRF protection, JWT, bcrypt, TOTP/2FA, rate limiting |
| Observability | OpenTelemetry, Prometheus-compatible metrics, Grafana/Loki/Tempo assets |
| Delivery | Docker Compose, Nginx, GitHub Actions, GHCR |

Kubernetes manifests remain in the repository for infrastructure documentation/experimentation, while the authoritative current production runtime contract is Docker Compose.

## Main application surfaces

The user frontend currently contains routes/pages for authentication and account recovery, Home, Calendar, Library, Dashboard, Settings, legal/privacy/cookie flows and two-factor verification.

The Backoffice is intentionally separate from the user application and is designed for trusted administrative access.

## Quick start

### Prerequisites

- **Node.js 24+**
- **pnpm 12** via Corepack
- **PostgreSQL 14+** for local backend development
- **Docker with Compose** if you prefer the containerised development stack

### Install

```bash
git clone https://github.com/Konstantinospil/FitVibe.git
cd FitVibe

corepack enable
pnpm install
```

Copy the relevant example environment files before starting services:

```bash
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
```

Review the remaining application/infrastructure examples before using non-default configuration. Do not commit real secrets or credentials.

### Run locally

The repository provides a helper for local development:

```bash
./scripts/run-local.sh
```

Or start the workspace applications directly:

```bash
pnpm dev
```

Typical development endpoints are:

| Service | Address |
| --- | --- |
| User frontend | `http://localhost:5173` |
| Backoffice | `http://localhost:5174` |
| Backend API | `http://localhost:4000` |

Run migrations explicitly when required:

```bash
pnpm --filter @fitvibe/backend run db:migrate
```

Optional seed data:

```bash
pnpm --filter @fitvibe/backend run db:seed
```

For the detailed non-container workflow, see [Local Development](docs/LOCAL_DEVELOPMENT.md).

### Containerised development

```bash
docker compose -f infra/docker/dev/compose.dev.yml up --build
```

See [Docker configuration](infra/docker/README.md) for environment-specific details.

## Development and verification

Common repository commands:

```bash
# Development
pnpm dev
pnpm build

# Static quality
pnpm lint:check
pnpm typecheck
pnpm architecture:check

# Tests
pnpm test
pnpm test:backend
pnpm test:frontend
pnpm test:integration
pnpm test:contract
pnpm test:e2e:smoke
pnpm test:a11y
pnpm test:visual:ci

# Security / dependency checks
pnpm security:scan
pnpm quality:package-json

# API / localisation
pnpm openapi:build
pnpm i18n:check
```

The CI pipeline also validates deployment contracts, dependency governance, test lifecycle/discovery ownership, coverage, security scanning, accessibility, visual regressions and other release gates.

## Branching and releases

The permanent branches are:

- `feature` — ongoing feature integration
- `dev` — integration/staging line
- `main` — production/release line

Temporary `fix/*` branches are used for focused corrections. Changes are promoted through pull requests and CI; release governance on `main` requires merged-PR provenance rather than direct release pushes.

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for the detailed workflow.

## Deployment

The authoritative production Compose contract is:

```text
infra/docker/prod/compose.yml
```

Production currently consists of separate ingress, frontend, backoffice and backend services plus PostgreSQL, Redis and ClamAV. Persistent database, Redis, ClamAV signature and user-media data are explicitly managed by the production stack.

Validate production Compose changes with:

```bash
bash scripts/validate-production-compose.sh
```

Deployment is automated by [`.github/workflows/cd.yml`](.github/workflows/cd.yml). Production images are expected to be immutable digest references.

See [Production Docker contract](infra/docker/prod/README.md) before changing deployment behaviour.

## Security, privacy and accessibility

FitVibe treats security, privacy and accessibility as release-quality concerns rather than documentation claims.

The repository includes controls and automated checks for authentication/session security, CSRF, rate limiting, dependency vulnerabilities, file scanning, security headers, secrets handling, accessibility and privacy/consent behaviour. Compliance and accessibility acceptance criteria must still be verified against the canonical requirements; the presence of controls alone is not a blanket claim of legal compliance or complete WCAG conformance.

- [Security policy](docs/SECURITY.md)
- [Policies](docs/5.Policies/)
- [Testing & QA plan](docs/4.Testing_and_Quality_Assurance_Plan/)
- [Product requirements](docs/1.Product_Requirements/)

## Documentation

| Area | Documentation |
| --- | --- |
| Product requirements | [docs/1.Product_Requirements/](docs/1.Product_Requirements/) |
| Technical design & ADRs | [docs/2.Technical_Design_Document/](docs/2.Technical_Design_Document/) |
| Design system | [docs/3.Sensory_Design_System/](docs/3.Sensory_Design_System/) |
| Testing & QA | [docs/4.Testing_and_Quality_Assurance_Plan/](docs/4.Testing_and_Quality_Assurance_Plan/) |
| Policies | [docs/5.Policies/](docs/5.Policies/) |
| Implementation notes | [docs/6.Implementation/](docs/6.Implementation/) |
| API documentation | [docs/api/](docs/api/) |
| Documentation hub | [docs/README.md](docs/README.md) |

Application-specific documentation:

- [Backend README](apps/backend/README.md)
- [Frontend README](apps/frontend/README.md)
- [Backoffice README](apps/backoffice/README.md)
- [Infrastructure README](infra/README.md)

## Contributing

Contributions should follow the repository's branching, test, security and documentation rules. Start with [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).

When behaviour changes, update or add tests and keep the relevant product/technical documentation aligned with the implementation.

## License

FitVibe is licensed under the [MIT License](LICENSE).
