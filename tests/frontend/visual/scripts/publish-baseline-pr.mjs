import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { changedSnapshots } from "./baseline-contract.mjs";

const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GH_TOKEN;
const source = process.env.SOURCE_REF;
const scope = process.env.REFRESH_SCOPE ?? "all";
const run = process.env.GITHUB_RUN_ID;
const summary = process.env.GITHUB_STEP_SUMMARY;

async function appendSummary(message) {
  if (summary) {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(summary, message + "\n");
  }
}

export async function publish({ files, testedSha, sourceBranch, runId, repository, request, loadFile }) {
  if (!/^(feature|dev|main|fix\/[a-z0-9][a-z0-9._-]*)$/.test(sourceBranch)) {
    throw new Error("Source branch is not allowed by FitVibe branch policy");
  }
  if (!/^[0-9]+$/.test(runId)) throw new Error("Invalid run identifier");
  if (!files.length) return { status: "unchanged" };

  const current = await request("/git/ref/heads/" + sourceBranch);
  if (current.object.sha !== testedSha) {
    throw new Error("Source branch advanced during refresh; refusing stale baselines");
  }

  const base = await request("/git/commits/" + testedSha);
  const treeEntries = [];
  for (const path of files) {
    const blob = await request("/git/blobs", {
      method: "POST",
      body: JSON.stringify({
        encoding: "base64",
        content: (await loadFile(path)).toString("base64"),
      }),
    });
    treeEntries.push({ path, mode: "100644", type: "blob", sha: blob.sha });
  }

  const tree = await request("/git/trees", {
    method: "POST",
    body: JSON.stringify({ base_tree: base.tree.sha, tree: treeEntries }),
  });
  const commit = await request("/git/commits", {
    method: "POST",
    body: JSON.stringify({
      message: "test(visual): refresh reviewed Linux baselines",
      tree: tree.sha,
      parents: [testedSha],
    }),
  });

  const head = "fix/visual-baselines-" + runId;
  await request("/git/refs", {
    method: "POST",
    body: JSON.stringify({ ref: "refs/heads/" + head, sha: commit.sha }),
  });
  const pr = await request("/pulls", {
    method: "POST",
    body: JSON.stringify({
      title: "test(visual): review " + files.length + " refreshed Linux baseline(s)",
      head,
      base: sourceBranch,
      draft: true,
      body: [
        "## Visual baseline review",
        "Source commit: \`" + testedSha + "\`",
        "Refresh scope: \`" + scope + "\`",
        "Updated snapshots: **" + files.length + "**",
        "Regenerated in the pinned Linux Playwright environment, followed by a complete read-only VRT run.",
        "Check the [workflow run](https://github.com/" + repository + "/actions/runs/" + runId + ") for the visual artifacts and summary.",
        "",
        "### Snapshot files",
        ...files.map((file) => "- \`" + file + "\`"),
        "",
        "Do not approve the PR without visually reviewing the changes. CI triggered by a pull request created with GITHUB_TOKEN may require an additional manual workflow run.",
      ].join("\n"),
    }),
  });
  return { status: "created", url: pr.html_url, commit: commit.sha, branch: head };
}

async function main() {
  if (!repo || !token || !source || !run) {
    throw new Error("Missing required GitHub workflow environment variables");
  }
  const files = changedSnapshots(scope);
  if (!files.length) {
    await appendSummary("### Visual baseline refresh\nNo snapshot changes; no commit or pull request required.");
    console.log("No changed Linux snapshots.");
    return;
  }
  const testedSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const request = async (path, options = {}) => {
    const response = await fetch("https://api.github.com/repos/" + repo + path, {
      ...options,
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) throw new Error((options.method ?? "GET") + " " + path + ": HTTP " + response.status + " " + await response.text());
    return response.json();
  };
  const result = await publish({
    files, testedSha, sourceBranch: source, runId: run, repository: repo,
    request, loadFile: readFile,
  });
  console.log(result);
  await appendSummary("### Visual baseline refresh\n" + files.length + " changed Linux snapshots; draft PR: " + result.url);
}

if (process.argv[1]?.endsWith("publish-baseline-pr.mjs")) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
