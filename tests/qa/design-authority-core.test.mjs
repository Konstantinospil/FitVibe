import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeDesignSources } from "./design-authority-core.mjs";

const run = (source, authority = false) => analyzeDesignSources(
  { "consumer.css": source },
  { authorities: new Set(authority ? ["consumer.css"] : []) },
).findings.map(f => f.type);

test("flags unauthorized token definition", () => {
  assert.ok(run(":root { --space-custom: 17px }").includes("unauthorized-definition"));
});
test("flags undeclared token even inside nested calc", () => {
  assert.ok(run(".a { padding: calc(var(--missing) * 2) }").includes("unresolved-token"));
});
test("flags literal dimensions in component CSS", () => {
  assert.ok(run(".a { max-width: 760px; gap: 13px }").includes("magic-number"));
});
test("accepts token-based component geometry", () => {
  assert.deepEqual(analyzeDesignSources({
    "tokens.css": ":root { --space: 1rem }",
    "consumer.css": ".a { padding: var(--space); width: 100%; display: grid }",
  }, { authorities: new Set(["tokens.css"]) }).findings, []);
});
test("detects indirect circular references", () => {
  assert.ok(run(":root { --a: var(--b); --b: var(--c); --c: var(--a) }", true).includes("cyclic-token"));
});
