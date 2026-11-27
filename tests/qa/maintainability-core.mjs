/**
 * Maintainability audit core: hard-coded values, duplicated code and styles, and
 * CSS that re-implements a shared component. Pure functions over { path: source }
 * maps so every rule is unit-tested (maintainability-core.test.mjs).
 *
 * Existing findings are tracked per rule and file in a committed baseline and may
 * only go down (see ratchet()). A justified exception carries a marker comment on
 * the same or the previous line:
 *
 *   // maintainability: <rule> -- <reason of at least ten characters>
 *   /* maintainability: <rule> -- <reason> *\/
 */
import ts from "typescript";
import postcss from "postcss";
import { analyzeDesignSources } from "./design-authority-core.mjs";

export const RULES = {
  magicNumber: "magic-number",
  duplicateFunction: "duplicate-function",
  duplicateList: "duplicate-literal-list",
  unquotedCssUrl: "unquoted-css-url",
  cssParseError: "css-parse-error",
  cssInvalidSelector: "css-invalid-selector",
  cssDuplicateBlock: "css-duplicate-block",
  cssReimplementsComponent: "css-reimplements-component",
  cssFixedColumns: "css-fixed-columns",
  cssDesignAuthority: "css-design-authority",
};

/** Numbers that carry no hidden meaning: none, one, the sign flip. */
const NEUTRAL_NUMBERS = new Set([0, 1, -1]);
const UPPER_CONSTANT = /^[A-Z][A-Z0-9_]*$/;
const HTTP_STATUS = { min: 100, max: 599 };
/** Shorter bodies are one-liners that may legitimately coincide. */
const MIN_DUPLICATE_BODY_CHARS = 50;
const MIN_LIST_ITEMS = 4;
const MIN_BLOCK_DECLARATIONS = 3;
/** A rule this similar to a shared component's rule should use the component. */
const COMPONENT_SIMILARITY = 0.75;
const FIXED_COLUMNS = /repeat\(\s*([3-9]|\d{2,})\s*,/;

const lineOf = (source, index) => source.slice(0, index).split("\n").length;

/** True when a `maintainability: <rule> -- reason` marker sits on `line` or the line above. */
export function hasException(source, line, rule) {
  const lines = source.split("\n");
  const marker = new RegExp(`maintainability:\\s*${rule}\\s*--\\s*.{10,}`);
  return [lines[line - 1] ?? "", lines[line - 2] ?? ""].some((text) => marker.test(text));
}

function finding(rule, file, line, detail) {
  return { rule, file, line, detail };
}

// --- TypeScript ---------------------------------------------------------------

function isFunctionBoundary(node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isClassDeclaration(node)
  );
}

/** A literal belongs to a named constant: `const NAME = ...`, nested objects and arrays included. */
function insideNamedConstant(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (isFunctionBoundary(current)) {
      return false;
    }
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) {
      return UPPER_CONSTANT.test(current.name.text);
    }
    if (ts.isEnumMember(current)) {
      return true;
    }
  }
  return false;
}

function isHttpStatusArgument(node, value) {
  if (value < HTTP_STATUS.min || value > HTTP_STATUS.max) {
    return false;
  }
  const call = node.parent;
  if (!call || (!ts.isCallExpression(call) && !ts.isNewExpression(call))) {
    return false;
  }
  if (call.arguments?.[0] !== node) {
    return false;
  }
  const callee = call.expression;
  const name = ts.isPropertyAccessExpression(callee) ? callee.name.text : callee.getText();
  return /^(HttpError|status|sendStatus)$/.test(name);
}

/** A radix (`parseInt(x, 10)`, `n.toString(16)`) or an index (`parts[2]`) names itself. */
function isRadixOrIndex(node) {
  const parent = node.parent;
  if (!parent) {
    return false;
  }
  if (ts.isElementAccessExpression(parent) && parent.argumentExpression === node) {
    return true;
  }
  if (!ts.isCallExpression(parent)) {
    return false;
  }
  const callee = parent.expression;
  const name = ts.isPropertyAccessExpression(callee) ? callee.name.text : callee.getText();
  return (
    (name === "parseInt" && parent.arguments[1] === node) ||
    (name === "toString" && parent.arguments[0] === node)
  );
}

function numericValue(node) {
  if (ts.isNumericLiteral(node)) {
    const parent = node.parent;
    const negative =
      parent && ts.isPrefixUnaryExpression(parent) && parent.operator === ts.SyntaxKind.MinusToken;
    return {
      value: (negative ? -1 : 1) * Number(node.text.replace(/_/g, "")),
      node: negative ? parent : node,
    };
  }
  return null;
}

function inTypePosition(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isTypeNode(current)) {
      return true;
    }
    if (ts.isStatement(current) || ts.isExpressionStatement(current)) {
      return false;
    }
  }
  return false;
}

const normalizeCode = (text) => text.replace(/\s+/g, "");

/**
 * Code can only be shared where one side can import the other: the web app and
 * the back office each with @fitvibe/ui, the backend on its own. A copy across
 * apps (a backend list mirrored in the frontend) has no shared home, so it is not
 * a duplicate here; contract tests keep such mirrors aligned.
 */
export const DEFAULT_SCOPES = [
  { pattern: /^apps\/frontend\//, scopes: ["web"] },
  { pattern: /^apps\/backoffice\//, scopes: ["backoffice"] },
  { pattern: /^packages\/ui\//, scopes: ["web", "backoffice"] },
  { pattern: /^apps\/backend\//, scopes: ["backend"] },
];

function scopesOf(file, scopeMap) {
  return scopeMap.find(({ pattern }) => pattern.test(file))?.scopes ?? [file];
}

/** For each entry, the other files in the group it could share code with. */
function sharedDuplicates(entries, scopeMap) {
  const result = [];
  for (const entry of entries) {
    const mine = scopesOf(entry.file, scopeMap);
    const others = [
      ...new Set(
        entries
          .filter(
            (other) =>
              other.file !== entry.file &&
              scopesOf(other.file, scopeMap).some((scope) => mine.includes(scope)),
          )
          .map((other) => other.file),
      ),
    ];
    if (others.length > 0) {
      result.push({ entry, others });
    }
  }
  return result;
}

/**
 * TypeScript rules over production sources:
 * - magic-number: a number other than 0, 1 or -1 outside a named constant, a
 *   config or constants module, a type, or an HTTP status argument.
 * - duplicate-function: the same function body in more than one file.
 * - duplicate-literal-list: the same list of four or more strings in more than
 *   one file (in any order); it belongs in one shared constant.
 * - unquoted-css-url: a template building `url(${...})` without quotes; values
 *   such as inlined data URLs contain quotes and become invalid CSS.
 */
export function analyzeTypeScript(sources, { constantModules = [], scopes = DEFAULT_SCOPES } = {}) {
  const findings = [];
  const functionBodies = new Map();
  const literalLists = new Map();
  const isConstantModule = (file) => constantModules.some((pattern) => pattern.test(file));

  for (const [file, source] of Object.entries(sources)) {
    const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
    const constantModule = isConstantModule(file);

    const visit = (node) => {
      const numeric = numericValue(node);
      if (numeric && !constantModule && !NEUTRAL_NUMBERS.has(numeric.value)) {
        const line = lineOf(source, numeric.node.getStart(sourceFile));
        const allowed =
          inTypePosition(node) ||
          insideNamedConstant(node) ||
          isHttpStatusArgument(numeric.node, numeric.value) ||
          isRadixOrIndex(numeric.node) ||
          hasException(source, line, RULES.magicNumber);
        if (!allowed) {
          findings.push(
            finding(
              RULES.magicNumber,
              file,
              line,
              `${numeric.value} in "${numeric.node.parent.getText(sourceFile).slice(0, 80)}"`,
            ),
          );
        }
      }

      const body =
        (ts.isFunctionDeclaration(node) ||
          ts.isArrowFunction(node) ||
          ts.isFunctionExpression(node) ||
          ts.isMethodDeclaration(node)) &&
        node.body &&
        ts.isBlock(node.body)
          ? normalizeCode(node.body.getText(sourceFile))
          : null;
      if (body && body.length >= MIN_DUPLICATE_BODY_CHARS) {
        const line = lineOf(source, node.getStart(sourceFile));
        if (!hasException(source, line, RULES.duplicateFunction)) {
          const entries = functionBodies.get(body) ?? [];
          entries.push({
            file,
            line,
            name:
              node.name?.getText(sourceFile) ??
              node.parent?.name?.getText?.(sourceFile) ??
              "anonymous",
          });
          functionBodies.set(body, entries);
        }
      }

      if (
        ts.isArrayLiteralExpression(node) &&
        node.elements.length >= MIN_LIST_ITEMS &&
        node.elements.every((element) => ts.isStringLiteral(element))
      ) {
        const line = lineOf(source, node.getStart(sourceFile));
        if (!hasException(source, line, RULES.duplicateList)) {
          const key = node.elements
            .map((element) => element.text)
            .sort()
            .join("\u0000");
          const entries = literalLists.get(key) ?? [];
          entries.push({ file, line });
          literalLists.set(key, entries);
        }
      }

      if (ts.isTemplateExpression(node)) {
        // Each span follows the text before it: the head, then each span's literal.
        const texts = [node.head.text, ...node.templateSpans.map((span) => span.literal.text)];
        node.templateSpans.forEach((span, index) => {
          const quotedByCall =
            ts.isCallExpression(span.expression) &&
            /^(JSON\.stringify|CSS\.escape)$/.test(span.expression.expression.getText(sourceFile));
          if (/url\(\s*$/.test(texts[index]) && !quotedByCall) {
            const line = lineOf(source, span.getStart(sourceFile));
            if (!hasException(source, line, RULES.unquotedCssUrl)) {
              findings.push(
                finding(RULES.unquotedCssUrl, file, line, "url(${...}) without quotes"),
              );
            }
          }
        });
      }

      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  for (const entries of functionBodies.values()) {
    for (const { entry, others } of sharedDuplicates(entries, scopes)) {
      findings.push(
        finding(
          RULES.duplicateFunction,
          entry.file,
          entry.line,
          `${entry.name} has the same body as in ${others.join(", ")}`,
        ),
      );
    }
  }
  for (const entries of literalLists.values()) {
    for (const { entry, others } of sharedDuplicates(entries, scopes)) {
      findings.push(
        finding(
          RULES.duplicateList,
          entry.file,
          entry.line,
          `same list as in ${others.join(", ")}`,
        ),
      );
    }
  }
  return findings;
}

// --- CSS ------------------------------------------------------------------------

const normalizeValue = (value) =>
  value
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ",")
    .trim()
    .toLowerCase();

function declarationsOf(rule) {
  const declarations = [];
  rule.each((child) => {
    if (child.type === "decl" && !child.prop.startsWith("--")) {
      declarations.push(`${child.prop.toLowerCase()}:${normalizeValue(child.value)}`);
    }
  });
  return declarations;
}

function contextOf(rule) {
  const parts = [];
  for (let current = rule.parent; current && current.type !== "root"; current = current.parent) {
    if (current.type === "atrule") {
      parts.unshift(`@${current.name} ${normalizeValue(current.params)}`);
    }
  }
  return parts.join(" ");
}

function insideKeyframes(rule) {
  for (let current = rule.parent; current; current = current.parent) {
    if (current.type === "atrule" && /keyframes$/i.test(current.name)) {
      return true;
    }
  }
  return false;
}

const similarity = (a, b) => {
  const shared = a.filter((item) => b.includes(item)).length;
  return { shared, jaccard: shared / new Set([...a, ...b]).size, subset: shared === a.length };
};

/**
 * CSS rules:
 * - css-parse-error, css-invalid-selector: a stylesheet that does not parse, or a
 *   selector holding an escaped control sequence such as a literal "\n" (it
 *   silently drops the whole rule).
 * - css-duplicate-block: the same three or more declarations in two rules.
 * - css-reimplements-component: a rule whose declarations repeat a shared
 *   component's rule (data-component/data-slot in the component stylesheets);
 *   use the component instead.
 * - css-fixed-columns: a grid with a fixed count of three or more columns; prefer
 *   repeat(auto-fit, ...) so the layout does not depend on today's item count.
 * - css-design-authority: literal sizes and token misuse, from design-authority-core.
 */
export function analyzeStylesheets(
  sources,
  { componentStylesheets = [], authorities = new Set() } = {},
) {
  const findings = [];
  const blocks = new Map();
  const componentRules = [];
  const consumerRules = [];
  /** Sheets that parsed; the design-authority pass would throw on the others. */
  const parsed = {};

  for (const [file, source] of Object.entries(sources)) {
    let root;
    try {
      root = postcss.parse(source, { from: file });
    } catch (error) {
      findings.push(
        finding(RULES.cssParseError, file, error.line ?? 1, error.reason ?? String(error)),
      );
      continue;
    }
    parsed[file] = source;
    const isComponentSheet = componentStylesheets.includes(file);

    root.walkRules((rule) => {
      if (insideKeyframes(rule)) {
        return;
      }
      const line = rule.source?.start?.line ?? 1;
      for (const selector of rule.selectors) {
        if (/\\[nrt]/.test(selector) && !hasException(source, line, RULES.cssInvalidSelector)) {
          findings.push(
            finding(
              RULES.cssInvalidSelector,
              file,
              line,
              `selector "${selector.slice(0, 60)}" holds an escaped control sequence`,
            ),
          );
        }
      }

      const declarations = declarationsOf(rule);
      if (
        declarations.some(
          (declaration) =>
            declaration.startsWith("grid-template-columns:") && FIXED_COLUMNS.test(declaration),
        ) &&
        !hasException(source, line, RULES.cssFixedColumns)
      ) {
        findings.push(
          finding(RULES.cssFixedColumns, file, line, `${rule.selector}: fixed column count`),
        );
      }
      if (declarations.length < MIN_BLOCK_DECLARATIONS) {
        return;
      }
      const entry = { file, line, selector: rule.selector, declarations, source };
      const key = `${contextOf(rule)}|${[...declarations].sort().join(";")}`;
      const group = blocks.get(key) ?? [];
      group.push(entry);
      blocks.set(key, group);

      if (isComponentSheet && /\[data-(component|slot)=/.test(rule.selector)) {
        componentRules.push(entry);
      } else if (!isComponentSheet) {
        consumerRules.push(entry);
      }
    });
  }

  for (const group of blocks.values()) {
    if (group.length < 2) {
      continue;
    }
    const [first, ...rest] = group;
    for (const entry of rest) {
      if (!hasException(entry.source, entry.line, RULES.cssDuplicateBlock)) {
        findings.push(
          finding(
            RULES.cssDuplicateBlock,
            entry.file,
            entry.line,
            `${entry.selector} repeats ${first.selector} (${first.file}:${first.line})`,
          ),
        );
      }
    }
  }

  for (const consumer of consumerRules) {
    const match = componentRules
      .map((component) => ({
        component,
        ...similarity(consumer.declarations, component.declarations),
      }))
      .filter(
        ({ shared, jaccard, subset }) =>
          shared >= MIN_BLOCK_DECLARATIONS && (subset || jaccard >= COMPONENT_SIMILARITY),
      )
      .sort((a, b) => b.jaccard - a.jaccard)[0];
    if (match && !hasException(consumer.source, consumer.line, RULES.cssReimplementsComponent)) {
      findings.push(
        finding(
          RULES.cssReimplementsComponent,
          consumer.file,
          consumer.line,
          `${consumer.selector} repeats ${match.component.selector}; use that component`,
        ),
      );
    }
  }

  for (const design of analyzeDesignSources(parsed, { authorities }).findings) {
    const separator = design.loc.lastIndexOf(":");
    const file = design.loc.slice(0, separator);
    const line = Number(design.loc.slice(separator + 1)) || 1;
    if (!hasException(sources[file] ?? "", line, RULES.cssDesignAuthority)) {
      findings.push(
        finding(`${RULES.cssDesignAuthority}:${design.type}`, file, line, design.detail),
      );
    }
  }
  return findings;
}

// --- Ratchet --------------------------------------------------------------------

/** { rule: { file: count } } */
export function countFindings(findings) {
  const counts = {};
  for (const { rule, file } of findings) {
    counts[rule] ??= {};
    counts[rule][file] = (counts[rule][file] ?? 0) + 1;
  }
  return counts;
}

/**
 * Compares current counts with the baseline. A rule and file above its baseline is
 * a regression; below it, an improvement that must be locked in by updating the
 * baseline, so the count can never creep back up.
 */
export function ratchet(counts, baseline) {
  const regressions = [];
  const improvements = [];
  const rules = new Set([...Object.keys(counts), ...Object.keys(baseline)]);
  for (const rule of rules) {
    const files = new Set([
      ...Object.keys(counts[rule] ?? {}),
      ...Object.keys(baseline[rule] ?? {}),
    ]);
    for (const file of files) {
      const current = counts[rule]?.[file] ?? 0;
      const allowed = baseline[rule]?.[file] ?? 0;
      if (current > allowed) {
        regressions.push({ rule, file, current, allowed });
      } else if (current < allowed) {
        improvements.push({ rule, file, current, allowed });
      }
    }
  }
  const order = (a, b) => a.rule.localeCompare(b.rule) || a.file.localeCompare(b.file);
  return { regressions: regressions.sort(order), improvements: improvements.sort(order) };
}
