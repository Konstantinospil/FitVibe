import { changedSnapshots } from "./baseline-contract.mjs";

const scope = process.argv[2] ?? "all";
try {
  const files = changedSnapshots(scope);
  console.log("Validated " + files.length + " changed Linux visual baseline(s) for scope " + scope);
  files.forEach((file) => console.log("- " + file));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
