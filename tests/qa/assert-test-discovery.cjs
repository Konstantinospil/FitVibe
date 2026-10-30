#!/usr/bin/env node
/* eslint-disable no-console */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
// Enforce stable smoke-test IDs and requirement-to-fixture traceability in CI.
require("./check-e2e-traceability.cjs");

const ROOT = path.resolve(__dirname, "../..");
const MANIFEST_PATH = path.join(__dirname, "test-ownership.json");
const WORKFLOW_PATH = path.join(ROOT, ".github", "workflows", "ci.yml");
const TEST_FILE_PATTERN = /\.(?:test|spec)\.(?:ts|tsx|js|jsx|cjs|mjs)$/;
const ALLOWED_SEVERITIES = new Set(["blocking", "advisory"]);
const ALLOWED_STATUSES = new Set(["active"]);
const NEGATIVE_CONTROL_PATH = "tests/__ownership_negative_control__.test.cjs";
const REQUIRED_SUITE_FIELDS = ["name","patterns","owner","ci_job_ids","contract_sources","fixture_dependencies","isolation_model","expected_artifacts","severity","status"];
const REQUIRED_JOB_FIELDS = ["id","name","owner","domain","severity","status","contract_sources","expected_artifacts"];

function isTestFile(filePath) { return TEST_FILE_PATTERN.test(filePath); }
function requireNonEmptyString(value, field, context) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${context}.${field} must be a non-empty string`);
}
function requireStringArray(value, field, context) {
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== "string" || entry.length === 0)) {
    throw new Error(`${context}.${field} must be a non-empty string array`);
  }
}
function compilePatterns(patterns, context) {
  requireStringArray(patterns, "patterns", context);
  return patterns.map((source) => {
    try { return new RegExp(source); }
    catch (error) { throw new Error(`${context} contains invalid regex ${JSON.stringify(source)}: ${error.message}`); }
  });
}
function extractWorkflowJobs(source) {
  const lines = source.split("\n");
  const jobs = new Map();
  let inJobs = false;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim() === "jobs:") { inJobs = true; continue; }
    if (!inJobs) continue;
    const match = lines[index].match(/^  ([A-Za-z0-9_-]+):\s*$/);
    if (!match) continue;
    const id = match[1];
    let end = lines.length;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (/^  [A-Za-z0-9_-]+:\s*$/.test(lines[cursor])) { end = cursor; break; }
    }
    const block = lines.slice(index, end);
    const nameLine = block.find((line) => /^    name:\s*/.test(line));
    const name = nameLine ? nameLine.replace(/^    name:\s*/, "").trim() : id;
    const advisory = block.some((line) => /^    continue-on-error:\s*true\s*$/.test(line));
    jobs.set(id, { id, name, severity: advisory ? "advisory" : "blocking" });
  }
  return jobs;
}
function validateWorkflowInventory(ciJobs) {
  const workflowJobs = extractWorkflowJobs(fs.readFileSync(WORKFLOW_PATH, "utf8"));
  const manifestJobs = new Map(ciJobs.map((job) => [job.id, job]));
  const missingFromManifest = [...workflowJobs.keys()].filter((id) => !manifestJobs.has(id));
  const missingFromWorkflow = [...manifestJobs.keys()].filter((id) => !workflowJobs.has(id));
  if (missingFromManifest.length || missingFromWorkflow.length) {
    throw new Error([
      missingFromManifest.length ? `CI jobs missing from test-ownership.json: ${missingFromManifest.join(", ")}` : null,
      missingFromWorkflow.length ? `Manifest CI jobs missing from ci.yml: ${missingFromWorkflow.join(", ")}` : null
    ].filter(Boolean).join("; "));
  }
  for (const [id, workflowJob] of workflowJobs) {
    const manifestJob = manifestJobs.get(id);
    if (manifestJob.name !== workflowJob.name) throw new Error(`CI job ${id} name drift: manifest=${JSON.stringify(manifestJob.name)} workflow=${JSON.stringify(workflowJob.name)}`);
    if (manifestJob.severity !== workflowJob.severity) throw new Error(`CI job ${id} severity drift: manifest=${manifestJob.severity} workflow=${workflowJob.severity}`);
  }
  return workflowJobs;
}
function loadManifest(manifestPath = MANIFEST_PATH) {
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")); }
  catch (error) { throw new Error(`Unable to read test ownership manifest ${manifestPath}: ${error.message}`); }
  if (parsed.version !== 1) throw new Error(`Unsupported test ownership manifest version: ${parsed.version}`);
  requireNonEmptyString(parsed.authority, "authority", "manifest");
  requireNonEmptyString(parsed.description, "description", "manifest");
  if (!Array.isArray(parsed.known_failures)) throw new Error("manifest.known_failures must be an array");
  if (!Array.isArray(parsed.ci_jobs) || parsed.ci_jobs.length === 0) throw new Error("manifest.ci_jobs must define every CI job");
  if (!Array.isArray(parsed.suites) || parsed.suites.length === 0) throw new Error("manifest.suites must define at least one test suite");
  if (!Array.isArray(parsed.exclusions)) throw new Error("manifest.exclusions must be an array");

  const jobIds = new Set();
  const ciJobs = parsed.ci_jobs.map((job, index) => {
    const context = `ci_jobs[${index}]`;
    for (const field of REQUIRED_JOB_FIELDS) if (job[field] === undefined || job[field] === null) throw new Error(`${context}.${field} is required`);
    requireNonEmptyString(job.id,"id",context); requireNonEmptyString(job.name,"name",context); requireNonEmptyString(job.owner,"owner",context); requireNonEmptyString(job.domain,"domain",context);
    requireStringArray(job.contract_sources,"contract_sources",context); requireStringArray(job.expected_artifacts,"expected_artifacts",context);
    if (!ALLOWED_SEVERITIES.has(job.severity)) throw new Error(`${context}.severity must be blocking or advisory`);
    if (!ALLOWED_STATUSES.has(job.status)) throw new Error(`${context}.status must be active`);
    if (jobIds.has(job.id)) throw new Error(`duplicate CI job id: ${job.id}`);
    jobIds.add(job.id); return job;
  });

  const suiteNames = new Set();
  const suites = parsed.suites.map((suite,index) => {
    const context = `suites[${index}]`;
    for (const field of REQUIRED_SUITE_FIELDS) if (suite[field] === undefined || suite[field] === null) throw new Error(`${context}.${field} is required`);
    requireNonEmptyString(suite.name,"name",context); requireNonEmptyString(suite.owner,"owner",context);
    requireStringArray(suite.ci_job_ids,"ci_job_ids",context); requireStringArray(suite.contract_sources,"contract_sources",context); requireStringArray(suite.fixture_dependencies,"fixture_dependencies",context); requireNonEmptyString(suite.isolation_model,"isolation_model",context); requireStringArray(suite.expected_artifacts,"expected_artifacts",context);
    if (!ALLOWED_SEVERITIES.has(suite.severity)) throw new Error(`${context}.severity must be blocking or advisory`);
    if (!ALLOWED_STATUSES.has(suite.status)) throw new Error(`${context}.status must be active`);
    if (suiteNames.has(suite.name)) throw new Error(`duplicate suite name: ${suite.name}`);
    suiteNames.add(suite.name);
    for (const jobId of suite.ci_job_ids) if (!jobIds.has(jobId)) throw new Error(`${context}.ci_job_ids references unknown job ${jobId}`);
    return { ...suite, compiledPatterns: compilePatterns(suite.patterns,context) };
  });

  const exclusionNames = new Set();
  const exclusions = parsed.exclusions.map((exclusion,index) => {
    const context = `exclusions[${index}]`;
    requireNonEmptyString(exclusion.name,"name",context); requireNonEmptyString(exclusion.reason,"reason",context);
    if (exclusionNames.has(exclusion.name)) throw new Error(`duplicate exclusion name: ${exclusion.name}`);
    exclusionNames.add(exclusion.name);
    return { ...exclusion, compiledPatterns: compilePatterns(exclusion.patterns,context) };
  });
  return { ...parsed, ci_jobs: ciJobs, suites, exclusions };
}
function matches(patterns,filePath) { return patterns.some((pattern) => pattern.test(filePath)); }
function classifyFiles(files,manifest) {
  const ownership = new Map(manifest.suites.map((suite)=>[suite.name,[]]));
  const excluded = new Map(manifest.exclusions.map((entry)=>[entry.name,[]]));
  const orphaned=[]; const ambiguous=[]; const active=[];
  for (const filePath of files.filter(isTestFile)) {
    const exclusion=manifest.exclusions.find((entry)=>matches(entry.compiledPatterns,filePath));
    if (exclusion) { excluded.get(exclusion.name).push(filePath); continue; }
    active.push(filePath);
    const matchingSuites=manifest.suites.filter((entry)=>matches(entry.compiledPatterns,filePath));
    if (matchingSuites.length===0) { orphaned.push(filePath); continue; }
    if (matchingSuites.length>1) { ambiguous.push({filePath,suites:matchingSuites.map((suite)=>suite.name)}); continue; }
    ownership.get(matchingSuites[0].name).push(filePath);
  }
  return {ownership,excluded,orphaned,ambiguous,active};
}
function assertNegativeControl(manifest) {
  const result=classifyFiles([NEGATIVE_CONTROL_PATH],manifest);
  if (result.orphaned.length!==1 || result.orphaned[0]!==NEGATIVE_CONTROL_PATH || result.ambiguous.length!==0) {
    throw new Error(`test ownership negative control failed: ${NEGATIVE_CONTROL_PATH} was unexpectedly claimed by a suite or exclusion`);
  }
}
function formatOrphanError(orphaned) {
  return ["Orphaned test files are not owned by any authoritative CI runner/contract entry:",...orphaned.map((filePath)=>`- ${filePath}`),"Add or refine a suite entry in tests/qa/test-ownership.json; do not add a broad catch-all pattern."].join("\n");
}
function formatAmbiguousError(ambiguous) {
  return ["Test files match more than one ownership suite:",...ambiguous.map(({filePath,suites})=>`- ${filePath}: ${suites.join(", ")}`),"Make suite patterns mutually exclusive so each active test has exactly one owner."].join("\n");
}
function main() {
  const manifest=loadManifest();
  const workflowJobs=validateWorkflowInventory(manifest.ci_jobs);
  assertNegativeControl(manifest);
  const files=execFileSync("git",["ls-files"],{encoding:"utf8"}).split("\n").map((line)=>line.trim()).filter(Boolean);
  const result=classifyFiles(files,manifest);
  if (result.ambiguous.length) { console.error(formatAmbiguousError(result.ambiguous)); process.exit(1); }
  if (result.orphaned.length) { console.error(formatOrphanError(result.orphaned)); process.exit(1); }
  for (const suite of manifest.suites) {
    const count=result.ownership.get(suite.name).length;
    if (count===0) { console.error(`Declared active ownership suite has no test files: ${suite.name}`); process.exit(1); }
    console.log(`${suite.name}: ${count} test files | ${suite.severity} | jobs=${suite.ci_job_ids.join(",")} | owner=${suite.owner}`);
  }
  for (const exclusion of manifest.exclusions) console.log(`${exclusion.name}: ${result.excluded.get(exclusion.name).length} excluded test files | ${exclusion.reason}`);
  console.log(`CI inventory: ${workflowJobs.size} workflow jobs declared; ${result.active.length} active test files have exactly one owner; negative ownership control passed.`);
  execFileSync(process.execPath, [path.join(__dirname, "collect-e2e-traceability.cjs")], {
    cwd: ROOT,
    stdio: "inherit",
    timeout: 180_000,
  });
}
if (require.main===module) {
  try { main(); } catch (error) { console.error(`Test ownership manifest validation failed: ${error.message}`); process.exit(1); }
}
module.exports={NEGATIVE_CONTROL_PATH,classifyFiles,extractWorkflowJobs,loadManifest,assertNegativeControl,formatAmbiguousError,formatOrphanError};
