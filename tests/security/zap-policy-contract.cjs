'use strict';

// Guard the ZAP security gate's integration contract, not just policy syntax.
// This script runs before the scanner so an ignored policy cannot silently pass CI.
const assert = require('node:assert/strict');
const fs = require('node:fs');

const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
const policy = fs.readFileSync('.zap/rules.tsv', 'utf8');
const scan = workflow.match(/      - name: Run ZAP baseline scan\n([\s\S]*?)(?=\n      - name: |\n  [a-z_]+:|$)/);
assert(scan, 'ZAP scan step must exist');
assert.match(scan[1], /fail_action:\s*true\b/, 'ZAP must fail on actionable findings');
assert.doesNotMatch(scan[1], /rules_file_name:/, 'Do not duplicate policy input: action v0.15.0 does not forward it');
assert.match(scan[1], /cmd_options:\s*[^\n]*\s-c\s+\.zap\/rules\.tsv(?:\s|$)/, 'ZAP must explicitly load the repository policy');
assert.equal((scan[1].match(/(?:^|\s)-c\s+\.zap\/rules\.tsv/g) || []).length, 1, 'Pass policy only once');
assert.doesNotMatch(scan[1], /(?:^|\s)-I(?:\s|$)|(?:^|\s)-i(?:\s|$)/, 'Do not suppress warnings through scanner flags');

const entries = new Map();
for (const line of policy.split(/\r?\n/)) {
  if (!line.trim() || line.startsWith('#')) continue;
  const cells = line.split('\t');
  assert(cells.length >= 3, 'Invalid ZAP rule entry: ' + line);
  const [id, level, justification] = cells;
  assert.match(id, /^\d+$/, 'Invalid ZAP rule ID');
  assert(['INFO', 'WARN', 'FAIL', 'IGNORE'].includes(level), 'Invalid ZAP action for ' + id);
  assert(justification.trim(), 'Missing rationale for ZAP rule ' + id);
  assert(!entries.has(id), 'Duplicate rule ID ' + id);
  entries.set(id, level);
}
for (const id of ['10049', '10050', '10109']) {
  assert.equal(entries.get(id), 'INFO', 'Expected explicitly reviewed informational rule ' + id);
}
assert(entries.size > 0, 'Security policy must not be empty');

// Negative control: an actionable finding is not blanket-classified as informational.
assert.equal(entries.has('10038'), false, 'CSP security finding must remain actionable');
console.log('ZAP policy contract valid: one scanner policy, explicit classifications, fail-on-alert enabled');
