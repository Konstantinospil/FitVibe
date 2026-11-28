/**
 * Unit tests for the maintainability audit. Each "catches" case reproduces an
 * error that reached review because no existing gate looked for it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RULES,
  analyzeStylesheets,
  analyzeTypeScript,
  countFindings,
  hasException,
  ratchet,
} from "./maintainability-core.mjs";

const tsRules = (sources, options) => analyzeTypeScript(sources, options).map((f) => f.rule);
const cssRules = (sources, options) => analyzeStylesheets(sources, options).map((f) => f.rule);
const FRONTEND = "apps/frontend/src/lib/a.ts";

// --- magic-number ---------------------------------------------------------------

test("catches an unnamed rounding factor (load.ts * 100)", () => {
  assert.ok(
    tsRules({ [FRONTEND]: "export const r = (v: number) => Math.round(v * 100) / 100;" }).includes(
      RULES.magicNumber,
    ),
  );
});

test("accepts neutral numbers, named constants, types and enums", () => {
  const source = [
    "export const MAX_SETS = 12;",
    "export const LIMITS = { min: 20, max: 250 };",
    "type Pair = [0, 1];",
    "enum Level { Low = 2 }",
    "export const next = (i: number) => i + 1 - 0;",
  ].join("\n");
  assert.deepEqual(tsRules({ [FRONTEND]: source }), []);
});

test("accepts HTTP statuses, radix arguments and index access", () => {
  const source = [
    "throw new HttpError(404, 'NOT_FOUND');",
    "res.status(201).json({});",
    "const n = parseInt(value, 10);",
    "const hex = n.toString(16);",
    "const third = list[2];",
  ].join("\n");
  assert.deepEqual(tsRules({ "apps/backend/src/a.ts": source }), []);
});

test("ignores configuration and constants modules", () => {
  const source = "export const config = { staleMs: 30000 };";
  assert.deepEqual(
    tsRules({ "apps/frontend/src/config/x.ts": source }, { constantModules: [/\/config\//] }),
    [],
  );
});

// --- duplicate-function and duplicate-literal-list -------------------------------

const ROUND =
  "export function round(value: number, decimals: number) { const factor = Math.pow(BASE, decimals); return Math.round(value * factor) / factor; }";

test("catches a helper copied into a second module (round)", () => {
  const findings = analyzeTypeScript({
    "apps/frontend/src/lib/units/load.ts": ROUND,
    "apps/frontend/src/lib/vibeform/m.ts": ROUND,
  });
  assert.equal(findings.filter((f) => f.rule === RULES.duplicateFunction).length, 2);
});

test("does not report copies that cannot share an import (frontend vs backend)", () => {
  assert.deepEqual(
    tsRules({ "apps/frontend/src/a.ts": ROUND, "apps/backend/src/a.ts": ROUND }),
    [],
  );
});

test("treats @fitvibe/ui as shared with the web app", () => {
  const findings = analyzeTypeScript({
    "packages/ui/src/a.ts": ROUND,
    "apps/frontend/src/a.ts": ROUND,
  });
  assert.ok(findings.some((f) => f.rule === RULES.duplicateFunction));
});

test("catches the same string list in two modules, in any order (vibe keys)", () => {
  const findings = analyzeTypeScript({
    "apps/frontend/src/constants/v.ts":
      'export const VIBE_KEYS = ["strength", "agility", "endurance", "explosivity"];',
    "apps/frontend/src/components/c.tsx":
      'const ORDER = ["agility", "strength", "explosivity", "endurance"];',
  });
  assert.ok(findings.some((f) => f.rule === RULES.duplicateList));
});

// --- unquoted-css-url ------------------------------------------------------------

test("catches an unquoted url() built from a value (VibeIcon)", () => {
  assert.ok(
    tsRules({ [FRONTEND]: "const style = { mask: `url(${icon}) center` };" }).includes(
      RULES.unquotedCssUrl,
    ),
  );
});

test("accepts a url() quoted with JSON.stringify", () => {
  assert.deepEqual(
    tsRules({ [FRONTEND]: "const style = { mask: `url(${JSON.stringify(icon)}) center` };" }),
    [],
  );
});

// --- exceptions ------------------------------------------------------------------

test("honours a marker with a reason on the same or previous line", () => {
  const source = "// maintainability: magic-number -- the ISO week has seven days\nconst days = 7;";
  assert.equal(hasException(source, 2, RULES.magicNumber), true);
  assert.deepEqual(tsRules({ [FRONTEND]: source }), []);
});

test("rejects a marker without a real reason", () => {
  const source = "// maintainability: magic-number -- ok\nconst days = 7;";
  assert.equal(hasException(source, 2, RULES.magicNumber), false);
  assert.ok(tsRules({ [FRONTEND]: source }).includes(RULES.magicNumber));
});

// --- stylesheets -----------------------------------------------------------------

const COMPONENTS = "apps/frontend/src/styles/components.css";
const COMPONENT_CSS =
  '[data-component="form-actions"] { display: flex; flex-wrap: wrap; gap: var(--space-sm); justify-content: flex-end; }';

test("catches a page rule that re-implements a component (FormActions)", () => {
  const rules = cssRules(
    {
      [COMPONENTS]: COMPONENT_CSS,
      "apps/frontend/src/styles/surfaces.css":
        ".live-finish__actions { display: flex; flex-wrap: wrap; gap: var(--space-sm); }",
    },
    { componentStylesheets: [COMPONENTS] },
  );
  assert.ok(rules.includes(RULES.cssReimplementsComponent));
});

test("does not flag a rule that only shares one declaration with a component", () => {
  const rules = cssRules(
    {
      [COMPONENTS]: COMPONENT_CSS,
      "apps/frontend/src/styles/surfaces.css":
        ".a { display: flex; color: var(--color-text-primary); padding: var(--space-md); }",
    },
    { componentStylesheets: [COMPONENTS] },
  );
  assert.ok(!rules.includes(RULES.cssReimplementsComponent));
});

test("catches identical blocks in two rules", () => {
  const block = "{ display: grid; gap: var(--space-md); margin: 0; padding: 0; list-style: none; }";
  assert.ok(
    cssRules({ "a.css": `.log-list ${block}`, "b.css": `.live-outline ${block}` }).includes(
      RULES.cssDuplicateBlock,
    ),
  );
});

test("does not treat the same block under different media queries as a duplicate", () => {
  const block = "{ display: grid; gap: var(--space-md); padding: 0; }";
  assert.ok(
    !cssRules({ "a.css": `.x ${block} @media (min-width: 40rem) { .y ${block} }` }).includes(
      RULES.cssDuplicateBlock,
    ),
  );
});

test("catches a selector containing an escaped newline (#671)", () => {
  assert.ok(
    cssRules({ "a.css": ".a,\\n.b { color: var(--color-text-primary); }" }).includes(
      RULES.cssInvalidSelector,
    ),
  );
});

test("reports a stylesheet that does not parse", () => {
  assert.ok(cssRules({ "a.css": ".a { color: red;" }).includes(RULES.cssParseError));
});

test("catches a fixed column count tied to today's fields", () => {
  assert.ok(
    cssRules({
      "a.css": ".summary { grid-template-columns: repeat(6, minmax(0, 1fr)); }",
    }).includes(RULES.cssFixedColumns),
  );
});

test("accepts responsive auto-fit columns and two-column splits", () => {
  const source =
    ".a { grid-template-columns: repeat(auto-fit, minmax(calc(var(--space-3xl) * 2), 1fr)); } .b { grid-template-columns: repeat(2, 1fr); }";
  assert.ok(!cssRules({ "a.css": source }).includes(RULES.cssFixedColumns));
});

test("forwards literal CSS sizes from the design-authority audit", () => {
  assert.ok(
    cssRules({ "a.css": ".a { max-width: 760px; }" }).some((rule) =>
      rule.startsWith(RULES.cssDesignAuthority),
    ),
  );
});

// --- ratchet ---------------------------------------------------------------------

test("counts findings per rule and file", () => {
  const counts = countFindings([
    { rule: "r", file: "a" },
    { rule: "r", file: "a" },
    { rule: "r", file: "b" },
  ]);
  assert.deepEqual(counts, { r: { a: 2, b: 1 } });
});

test("a new finding in a file is a regression, even when another file improved", () => {
  const { regressions, improvements } = ratchet({ r: { a: 2, c: 1 } }, { r: { a: 3 } });
  assert.deepEqual(regressions, [{ rule: "r", file: "c", current: 1, allowed: 0 }]);
  assert.deepEqual(improvements, [{ rule: "r", file: "a", current: 2, allowed: 3 }]);
});

test("a fully cleaned file is reported as an improvement to lock in", () => {
  const { regressions, improvements } = ratchet({}, { r: { a: 1 } });
  assert.deepEqual(regressions, []);
  assert.equal(improvements.length, 1);
});
