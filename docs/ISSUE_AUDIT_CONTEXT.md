# FitVibe issue audit — documentation alignment gate

**Scope:** Every open and closed issue, including epics, successor/absorbed issues and implementation work. This document sets review procedure, not completion claims.

## Source hierarchy and conflict resolution

1. Read repository instructions, `docs/README.md`, and the domain-specific documentation before assessing the issue. Record the exact branch and commit SHA. Archived/generated/transient materials are evidence only, not requirements.
2. **Product intent:** `docs/1.Product_Requirements/a.Requirements/` (FR/NFR/REQ identifiers), `d.User_stories/`, and **`e.Acceptance_Criteria/` as authoritative AC definitions**. The narrative PRD is explanatory and must not silently override canonical requirement IDs or acceptance criteria.
3. **Implementation contracts:** applicable technical-design module/API/data documents, currently applicable accepted ADRs, security/privacy/operations policies, and the design system (including tokens, globally controlled aesthetics and reusable components). Read actual current code and integration contracts.
4. **Quality:** `docs/4.Testing_and_Quality_Assurance_Plan/`, declared test ownership, suite contracts and the relevant workflow definitions. Check tests test **intended behavior**, not defects, fixtures, bypasses, skips or rewritten expectations.
5. In case of conflict or stale documentation, report both sides with paths and pinpointed criteria. Never assume code supersedes product intent merely because it was merged. Do not silently rewrite specification to match implementation. Create/retain an explicit documentation decision or defect to resolve the conflict.

## Mandatory issue-by-issue checklist

- [ ] Preserve all original issue acceptance criteria and explicitly enumerate each criterion, including those carried from closed historical issues.
- [ ] Resolve canonical successor/parent and dependencies at **criterion level**. Migration requires an open owner's acceptance checklist and cross-references in both directions.
- [ ] Identify authoritative product, technical, architectural, design-system, policy and test documentation relevant to the issue, and check for contradictions or outdated requirements.
- [ ] Compare actual `feature` implementation (pinned SHA, code paths and runtime behavior where applicable) to each requirement, ADR and design/policy constraint. Record **aligned / partially aligned / contradicted / not assessed** for each.
- [ ] Verify tests reflect the documented acceptance criteria; record test owner, automated/manual coverage, missing assertions and representative negative cases. Tests must not be modified to conceal a product defect.
- [ ] Inspect relevant CI result **on the applicable SHA**, required jobs, artifact evidence and known flaky/unowned tests. A green unrelated run does not prove the issue.
- [ ] Make a specific disposition with links: **verified implemented**, **fully migrated to open canonical owner**, **partial or contradictory**, **unresolved insufficient evidence**. Closed issues may retain their closed state during audit, but must never be labeled complete without proof.
- [ ] Record discrepancies as actionable subtasks/issues: missing implementation, documentation correction requiring explicit decision, design-system violation, missing test/ownership, or CI issue. Link and avoid duplicate owners.
- [ ] For verified closure, add a traceable summary to the issue with requirement/AC IDs, docs paths, commit SHA, test ownership, CI run, and successor details if transferred.

## Label semantics

- `audit:successor-check`: historical closed issue with proposed successor; migration **not yet verified**.
- `audit:closure-check`: other closed issue awaiting implementation-or-migration verification.
- `status:triage`: open issue requiring evidence-based review; **not** a statement of implementation progress.
- **Do not** apply `audit:implemented`, `audit:migrated`, `status:close-ready`, or equivalent until every applicable documentation and acceptance gate above passes.

## Definition of done for audit

One reviewed record per issue and per acceptance criterion. Final decision must distinguish (1) code missing, (2) code exists but conflicts with documentation, (3) documentation is demonstrably obsolete requiring an explicit product/architecture decision, (4) tests or CI not reliable, (5) verified implementation, and (6) complete scope migration.

No code/CI policy mutation, mass reopening, or bulk closure is authorized by this procedure.
