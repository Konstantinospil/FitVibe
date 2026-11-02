# Security exception: deepmerge (Jest-only)

- **Advisory:** GHSA-gcqx-w48m-w2h4 / CVE-2026-93753 (high severity).
- **Component:** deepmerge@4.3.1, solely a transitive dependency of jest-config@30.5.2; Jest is a backend devDependency.
- **Scope:** Temporary OSV suppression of this *single advisory ID*, not an exemption of a package or whole dependency class. Other vulnerabilities stay blocking.
- **Reason:** No patched upstream version confirmed at the time of review. No FitVibe runtime imports found. The production Dockerfile now copies only the `pnpm deploy --prod` output, not builder backend node_modules.
- **Evidence:** [CI run 40600868520](https://github.com/Konstantinospil/FitVibe/actions/runs/40600868520): amd64 production smoke printed `PASS: deepmerge and jest-config absent from runtime image`, backend started, and arm64 production image build passed. This is not proof against malicious Jest configuration in CI; untrusted code/PRs must still be treated cautiously.
- **Review deadline:** 2026-11-28 (OSV exception `ignoreUntil`). Review earlier if new Jest/deepmerge fix is released or dependency path changes.
- **Removal criteria:** Upgrade to a patched upstream dependency (or remove the dependency path), delete `[[IgnoredVulns]]` and this exception after verifying clean OSV and image checks.
- **Owner:** FitVibe maintainers. Avoid carrying exception onto another unrelated vulnerability; re-evaluate immediately if deepmerge appears in any production image.

The finding is **risk-accepted temporarily**, not remediated upstream or declared nonexistent.
