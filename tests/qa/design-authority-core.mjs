import postcss from "postcss";

const allowedUnits = /(?:^|[\s,(])[-+]?(?:\d*\.)?\d+(?:px|rem|em|vh|vw|dvh|dvw|svh|lvh|pt|ch|ex|ms|s|deg)\b/i;
const visualProperty = /^(?:width|height|(?:min|max)-(?:width|height)|margin(?:-.+)?|padding(?:-.+)?|gap|row-gap|column-gap|inset(?:-.+)?|top|right|bottom|left|border(?:-.+)?-width|border-radius|outline(?:-.+)?|font-size|line-height|letter-spacing|box-shadow|text-shadow|transform|animation(?:-.+)?|transition(?:-.+)?)$/;

export function analyzeDesignSources(sources, { authorities }) {
  const findings = [], definitions = new Map(), references = [];
  for (const [file, source] of Object.entries(sources)) {
    const tree = postcss.parse(source, { from: file });
    tree.walkDecls(decl => {
      const loc = `${file}:${decl.source?.start?.line ?? 1}`;
      if (decl.prop.startsWith("--")) {
        const defs = definitions.get(decl.prop) ?? [];
        defs.push({ loc, value: decl.value, selector: decl.parent?.selector ?? "" });
        definitions.set(decl.prop, defs);
        if (!authorities.has(file)) findings.push({ type: "unauthorized-definition", loc, detail: decl.prop });
      } else if (visualProperty.test(decl.prop)) {
        // Remove complete nested var() expressions, not just up to the first ')'.
        const withoutTokens = decl.value.replace(/var\(\s*--[\w-]+(?:\s*,\s*(?:var\(\s*--[\w-]+\s*\)|[^()]+))?\s*\)/g, "");
        if (allowedUnits.test(withoutTokens)) findings.push({ type: "magic-number", loc, detail: `${decl.prop}: ${decl.value}` });
      }
      for (const match of decl.value.matchAll(/var\(\s*(--[\w-]+)/g)) references.push({ from: decl.prop, name: match[1], loc });
    });
  }
  for (const ref of references) {
    if (!definitions.has(ref.name)) findings.push({ type: "unresolved-token", loc: ref.loc, detail: ref.name });
  }
  const adjacency = new Map();
  for (const [name, defs] of definitions) adjacency.set(name, new Set(defs.flatMap(d => [...d.value.matchAll(/var\(\s*(--[\w-]+)/g)].map(m => m[1])).filter(n => definitions.has(n))));
  const visiting = new Set(), visited = new Set(), reported = new Set();
  function visit(name, route) {
    if (visiting.has(name)) {
      const cycle = route.slice(route.indexOf(name)).concat(name).join(" -> ");
      if (!reported.has(cycle)) { findings.push({ type: "cyclic-token", loc: definitions.get(name)[0].loc, detail: cycle }); reported.add(cycle); }
      return;
    }
    if (visited.has(name)) return;
    visiting.add(name);
    for (const dependency of adjacency.get(name) ?? []) visit(dependency, [...route, dependency]);
    visiting.delete(name); visited.add(name);
  }
  for (const name of definitions.keys()) visit(name, [name]);
  return { findings, tokenCount: definitions.size };
}
