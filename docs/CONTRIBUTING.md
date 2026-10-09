# Contributing to FitVibe

Thank you for helping improve FitVibe. This guide follows GitHub's recommendations for healthy open source projects and the Open Source Guides' best practices for maintainers. Please read it before opening a pull request.

---

## 1. Ways to Contribute

- **Bug reports:** open a GitHub issue with reproduction steps, expected behaviour, and environment details.
- **Feature proposals:** start a discussion issue so we can align with the Product Requirements Document (`docs/1.Product_Requirements/1.Product_Requirements_Document.md`).
- **Code contributions:** follow the workflow below and submit a pull request.
- **Documentation updates:** keep the Technical Design Document (`docs/2.Technical_Design_Document/`) and local README files in sync with your changes.

---

## 2. Prerequisites

- Node.js 24 or newer
- PNPM 10 (`corepack enable pnpm`)
- Git with SSH access configured
- Docker (optional but required for the local Postgres/NGINX stack under `infra/`)

Install dependencies after cloning:

```bash
pnpm install
```

Copy `.env.example` files in the root, `apps/backend`, `apps/frontend`, and `infra/` to `.env` and adjust values as needed.

---

## 3. Branching, Commits, and Pull Requests

- Permanent branches: `main` (production), `dev` (integration), `feature` (ongoing features).
- Create temporary `fix/<bug-name>` branches from current `dev` and open focused PRs targeting `dev`.
- Develop features on `feature`, promoting through PRs to `dev` and then `main` after CI succeeds.
- After merging a fix into `dev`, synchronize `dev` into `feature` before its next promotion, resolving any conflicts without overwriting bug fixes.
- Full CI and CodeQL run on `fix/*`; production releases remain `main`-only. Delete temporary fix branches after merge.
- Write conventional commits when possible (`feat:`, `fix:`, `docs:`, `chore:`).
- Sign commits (`git config --global commit.gpgSign true`) if you have a key configured.
- Keep pull requests focused; small, reviewable changes merge faster.

Every pull request should include:

- A summary of the change and its motivation.
- Screenshots or terminal output when the change affects UX or scripts.
- Links to the sections in PRD/TDD or other docs that you updated.
- A checklist covering tests, documentation, and security considerations.

---

## 4. Development Workflow

1. Start the stack (optional but recommended for end-to-end testing):
   ```bash
   pnpm dev
   ```
2. Apply code changes following the shared TypeScript configuration (`tsconfig.base.json`) and lint rules.
3. Run local quality gates before submitting:
   ```bash
   pnpm lint
   pnpm test
   pnpm typecheck
   ```
4. Format changed files with your editor's Prettier integration or `pnpm lint --fix`.
5. Update documentation, changelogs, or configuration affected by your change.

---

## 5. Testing Expectations

- Unit and integration tests live under `tests/` (organized by `tests/backend/` and `tests/frontend/`). Add or update tests when behaviour changes.
- Use test doubles for external services; do not hit live third-party APIs.
- For new endpoints, document the contract in the TDD and add an integration or contract test.
- Performance tests (k6) and security scans run in CI; trigger them locally when practical.

---

## 6. Documentation and Diagrams

- Product or UX changes: update the PRD (`docs/1.Product_Requirements/1.Product_Requirements_Document.md`).
- Technical changes: update the TDD (`docs/2.Technical_Design_Document/`) and regenerate any affected Mermaid diagrams stored under `docs/2.Technical_Design_Document/2.g.Diagrams/`.
- Architecture decisions: add or update an ADR in `docs/2.Technical_Design_Document/2.f.Architectural_Decision_Documentation/`.
- Infrastructure updates: document in `infra/README.md` and any relevant policy under `infra/security/`.

---

## 7. Security and Privacy

- Follow the guidance in `docs/SECURITY.md` for responsible disclosure and secure development requirements.
- Never commit secrets, API keys, or personal data. `.env` files are intentionally excluded from Git.
- Run `pnpm audit --prod` if you add or update critical dependencies and include the results in your pull request description.
- Report suspected vulnerabilities privately to `kpilpilidis@gmail.com` instead of opening an issue.

---

## 8. Code Review and Merging

- Address review feedback promptly and keep discussions on the pull request for transparency.
- Squash merges are enabled by default; ensure the final commit message captures the change clearly.
- A maintainer will merge once approvals, status checks, and documentation updates are complete.

---

## 9. Getting Help

- Check existing issues and discussions for similar questions.
- For development environment problems, see `apps/frontend/README.md`, `apps/backend/README.md`, and `infra/README.md`.
- Use GitHub Discussions or reach out to the maintainer directly for workflow clarifications.

We appreciate your contributions and the time you invest in making FitVibe better for every athlete.
