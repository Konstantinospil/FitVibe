// ESLint's repository configuration owns TS/TSX formatting via the Prettier rule.
// JavaScript and documentation files are formatted with Prettier directly;
// ESLint explicitly ignores JS/CJS/MJS in eslint.config.js.
function chunk(items, size) {
  const groups = [];
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }
  return groups;
}

function quote(value) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function commands(filenames, tools, size, eligible = () => true) {
  const filtered = filenames.filter(
    (file) => !/(?:^|[\\/])(?:dist|node_modules)[\\/]/.test(file) && eligible(file),
  );
  return chunk(filtered, size).flatMap((files) =>
    tools.map((tool) => `${tool} ${files.map(quote).join(" ")}`),
  );
}

export default {
  "*.{ts,tsx}": (files) => commands(files, ["prettier --write", "eslint --fix --max-warnings=0"], 30),
  "*.{js,jsx,cjs,mjs}": (files) => commands(files, ["prettier --write"], 30),
  "*.{json,md,yml,yaml}": (files) =>
    commands(
      files,
      ["prettier --write"],
      40,
      (file) => !/(?:^|[\\/])(?:pnpm-lock\.yaml|package-lock\.json)$/.test(file),
    ),
};
