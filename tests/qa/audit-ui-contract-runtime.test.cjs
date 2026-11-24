"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { inspectServer, inspectClient, codeCoverage } = require("./audit-ui-data-contracts.cjs");
const { analyzeSnapshot, flat } = require("./audit-ui-runtime.cjs");

test("data-contract AST finds HTTP error copy and its stable code", () => {
  const result = inspectServer("apps/backend/src/a.ts", 'throw new HttpError(400, "BAD_REQUEST", "Invalid request");');
  assert.equal(result.codes[0].code, "BAD_REQUEST");
  assert.equal(result.items[0].classification, "ui");
  assert.equal(result.items[0].reason, "http-error-message");
});

test("data-contract AST captures persisted display labels and dynamic expressions", () => {
  const result = inspectServer("apps/backend/src/seeds/a.ts", 'const row = { label: "Training", description: \`Hello \${user}\` };');
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].text, "Training");
  assert.equal(result.items[1].text, "Hello {expression}");
});

test("localized email resources and ambiguous database fields remain separately classified", () => {
  assert.equal(inspectServer("apps/backend/src/services/i18n.service.ts", 'const x = { subject: "Hello" };').items[0].classification, "localized");
  assert.equal(inspectServer("apps/backend/src/db/a.ts", 'const x = { name: "Squat" };').items[0].classification, "review");
});

test("data-contract AST finds raw API error messages passed to clients", () => {
  const result = inspectClient("apps/frontend/src/a.ts", 'setError(err.response.data.error.message); const x = { label: "Streak" };');
  assert.ok(result.some((f) => f.reason === "raw-api-message-consumer"));
  assert.ok(result.some((f) => f.reason === "client-field:label" && f.text === "Streak"));
});

test("error-code translations are checked independently for every locale", () => {
  const bundles = Object.fromEntries(["en","de","fr","es","el"].map(l => [l, { common: { errors: l === "de" ? {} : { BAD_REQUEST: "Error" } }, auth: {} }]));
  const coverage = codeCoverage("BAD_REQUEST", bundles);
  assert.equal(coverage.de, false);
  assert.equal(coverage.fr, true);
});

test("runtime audit flags untranslated English values but accepts translated German", () => {
  const english = { "auth.login.submit": "Sign in" }, localized = { "auth.login.submit": "Anmelden" };
  const snapshot = { url: "/login", htmlLang: "de", entries: [
    { text: "Sign in", kind: "text", selector: "button" },
    { text: "Anmelden", kind: "text", selector: "button" },
    { text: "Hardcoded heading", kind: "text", selector: "h2" }
  ] };
  const result = analyzeSnapshot(snapshot, "de", english, localized, ["Hardcoded heading"]);
  assert.equal(result.counts.englishFallbacks, 1);
  assert.equal(result.counts.renderedSourceLiterals, 1);
});

test("runtime audit handles translated string keys without inventing English failures", () => {
  const snapshot = { url: "/", htmlLang: "fr", entries: [
    { text: "auth.login.submit", kind: "text", selector: "button" },
    { text: "FitVibe", kind: "text", selector: "strong" }
  ] };
  const result = analyzeSnapshot(snapshot, "fr", {}, {}, []);
  assert.equal(result.counts.unresolvedKeys, 1);
  assert.equal(result.counts.englishFallbacks, 0);
});

test("flattening nested translations retains namespaced keys", () => {
  assert.deepEqual(flat({ auth: { login: { submit: "Anmelden" } } }, "common"), {
    "common.auth.login.submit": "Anmelden"
  });
});
