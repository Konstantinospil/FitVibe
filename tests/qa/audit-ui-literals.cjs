#!/usr/bin/env node
/* eslint-disable no-console */
"use strict";

// Inventory source literals before migration. TypeScript's parser, not text regexes,
// distinguishes strings in JSX, expressions, templates, API calls and TS syntax.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ts = require("typescript");

const SOURCE_ROOTS = ["apps/frontend/src", "apps/backoffice/src"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const UI_PROPS = new Set([
  "label", "title", "description", "message", "tooltip", "placeholder", "alt",
  "arialabel", "arialabelledby", "helpertext", "helptext", "caption", "heading",
  "subtitle", "emptytext", "emptymessage", "emptylabel", "errormessage",
  "successmessage", "warningmessage", "confirmtext", "buttontext", "actionlabel",
  "summary", "hint", "text", "content", "displayname", "notification",
]);
const TECHNICAL_JSX_PROPS = new Set([
  "classname", "id", "key", "name", "type", "role", "value", "href", "src",
  "target", "rel", "method", "action", "autocomplete", "inputmode", "width",
  "height", "variant", "size", "color", "background", "style", "testid",
  "data-testid", "tabindex", "htmlfor", "pattern", "accept", "as", "lang", "to", "path",
  "align", "loading", "controlsize",
]);
const TECHNICAL_ARIA_PROPS = new Set([
  "aria-hidden", "aria-live", "aria-haspopup", "aria-required", "aria-disabled",
  "aria-current", "aria-pressed", "aria-busy", "aria-expanded", "aria-checked",
  "aria-invalid", "aria-modal", "aria-orientation", "aria-autocomplete",
  "aria-multiselectable", "aria-selected", "aria-relevant", "aria-atomic",
]);
const SVG_TAGS = new Set([
  "svg", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "linearGradient", "radialGradient", "stop", "clipPath", "mask", "pattern",
  "defs", "g", "use", "symbol", "text", "tspan", "filter",
]);
const SVG_ATTRIBUTES = new Set([
  "viewbox", "xmlns", "preserveaspectratio", "d", "points", "strokewidth",
  "strokelinecap", "strokelinejoin", "strokedasharray", "stroke", "fill",
  "fillrule", "fillopacity", "strokeopacity", "cx", "cy", "r", "rx", "ry",
  "x", "y", "x1", "x2", "y1", "y2", "transform", "clippath", "vectoreffect",
  "offset", "stopcolor", "gradientunits", "gradienttransform",
]);
const TECHNICAL_PROPS = new Set([
  "tone", "kind", "format", "min", "max", "step", "form", "decoding",
  "documenttype", "viewportclassname", "mainid", "source", "meta",
]);

const TECHNICAL_OBJECT_KEYS = new Set([
  "id", "key", "type", "role", "status", "code", "path", "url", "route",
  "method", "endpoint", "querykey", "username", "email", "language", "locale",
  "value", "class", "classname", "variant", "color", "background", "icon",
  "format", "name", "scope", "namespace", "component", "event", "actiontype",
]);
const MESSAGE_CALLS = /(?:^|\.)(?:alert|confirm|prompt|notify|toast|setError|setErrorMessage|setMessage|setNotice|setNotification|setSuccess|setWarning|showToast|showNotification|enqueueSnackbar|showAlert|showConfirm|showPrompt)$/;
const MESSAGE_METHODS = /(?:^|\.)(?:toast|notify|message|notification)\.(?:success|error|info|warn|warning|show|open|loading)$/;
const TRANSLATION_CALLS = /(?:^|\.)(?:t|translate|i18n\.t|formatMessage)$/;

function walkFiles(root) {
  if (!fs.existsSync(root)) throw new Error(`Source root missing: ${root}`);
  const found = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (["node_modules", "dist", "build", "coverage", "archive", "__tests__", "__snapshots__"].includes(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) {
        const extension = path.extname(entry.name);
        if ((SOURCE_EXTENSIONS.has(extension) && !entry.name.endsWith(".d.ts")) || [".html", ".css"].includes(extension)) {
          found.push(absolute);
        }
      }
    }
  }
  walk(root);
  return found;
}

function isTranslationCall(node) {
  return ts.isCallExpression(node) && TRANSLATION_CALLS.test(node.expression.getText());
}

function ancestor(node, predicate) {
  for (let current = node.parent; current; current = current.parent) {
    if (predicate(current)) return current;
  }
  return null;
}

function fieldName(node) {
  const parent = node.parent;
  if (ts.isJsxAttribute(parent)) return parent.name.getText().toLowerCase();
  if (ts.isPropertyAssignment(parent)) return parent.name.getText().replace(/["']/g, "").toLowerCase();
  if (ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent)) return parent.parent.name.getText().toLowerCase();
  return null;
}

function contextOf(node) {
  if (ts.isJsxText(node)) return { classification: "ui", reason: "jsx-text" };
  if (typeof node.text === "string" &&
      /^(?:data:image\/|https?:\/\/|#[0-9a-f]{3,8}$|url\(#[-\w]+\)$)/i.test(node.text)) {
    return { classification: "technical", reason: "resource-or-color" };
  }
  // ICU/Intl formatting instructions and locale identifiers control formatting;
  // the formatted output, not these option values, is user-facing.
  const formatter = ancestor(node, (candidate) =>
    (ts.isCallExpression(candidate) && /\.(?:toLocaleDateString|toLocaleTimeString|toLocaleString)$/.test(candidate.expression.getText())) ||
    (ts.isNewExpression(candidate) && /^(?:Intl\.)?(?:DateTimeFormat|NumberFormat|RelativeTimeFormat|DisplayNames)$/.test(candidate.expression.getText())));
  if (formatter) return { classification: "technical", reason: "intl-format-options" };
  // Technical comparison operands must not be treated as UI copy just because
  // the whole comparison sits inside a visible JSX attribute.
  const comparison = ancestor(node, (candidate) =>
    ts.isBinaryExpression(candidate) &&
    [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
      ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken]
      .includes(candidate.operatorToken.kind) &&
    (candidate.left === node || candidate.right === node));
  if (comparison) return { classification: "technical", reason: "comparison-literal" };
  if (typeof node.text === "string" && /^-?\d+(?:\.\d+)?(?:px|rem|em|vh|vw|%|ch|vmin|vmax)$/.test(node.text)) {
    return { classification: "technical", reason: "css-dimension" };
  }
  // Narrowly identify known wire-format enums and typed filter sentinels.
  // Do not blanket-ignore ordinary option arrays: those may contain UI labels.
  // A known backend report-filter enum is not display copy even when mapped in JSX.
  const statusArray = ancestor(node, (candidate) => ts.isArrayLiteralExpression(candidate));
  if (statusArray && statusArray.elements.includes(node) &&
      statusArray.elements.every((element) =>
        ts.isStringLiteral(element) &&
        ["all", "pending", "reviewed", "dismissed"].includes(element.text)) &&
      ts.isAsExpression(statusArray.parent) &&
      statusArray.parent.type.getText() === "const") {
    return { classification: "technical", reason: "typed-status-option-values" };
  }
  const typedDeclaration = ancestor(node, (candidate) => ts.isVariableDeclaration(candidate));
  // Internal translation-entry identity and ordering keys are not display copy.
  if (ts.isTemplateExpression(node) && typedDeclaration &&
      ["key", "aKey", "bKey"].includes(typedDeclaration.name.getText()) &&
      typedDeclaration.initializer === node &&
      (node.head.text === "" || node.head.text.includes("::"))) {
    const expressions = node.templateSpans.map((span) => span.expression.getText());
    if (expressions.length === 2 &&
        expressions.every((part) => /(?:namespace|key_path)$/.test(part))) {
      return { classification: "technical", reason: "translation-composite-key" };
    }
  }
  // The role codes passed to the privileged admin API must remain untranslated.
  if (typedDeclaration?.name.getText() === "nextRole" &&
      ["admin", "superadmin"].includes(node.text) &&
      ancestor(node, (candidate) => ts.isConditionalExpression(candidate))) {
    return { classification: "technical", reason: "privileged-role-code" };
  }
  // The English fallback key is used for lookup, not as a visible language label.
  if (node.text === "en" && ts.isCallExpression(node.parent) &&
      /^(?:activeByLanguage|deletedByLanguage)\.(?:has|get)$/.test(node.parent.expression.getText()) &&
      node.parent.arguments[0] === node) {
    return { classification: "technical", reason: "language-fallback-code" };
  }
  if (node.text === "en" && typedDeclaration?.name.getText() === "displayLanguage" &&
      ts.isBinaryExpression(node.parent) &&
      node.parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
      node.parent.right === node &&
      ts.isCallExpression(node.parent.left) &&
      node.parent.left.expression.getText() === "activeByLanguage.has") {
    return { classification: "technical", reason: "language-fallback-code" };
  }
  if (typedDeclaration && typedDeclaration.name.getText() === "severityOptions" &&
      typedDeclaration.type?.getText().includes("AuditLogSeverity") &&
      ts.isArrayLiteralExpression(typedDeclaration.initializer)) {
    return { classification: "technical", reason: "typed-severity-enum" };
  }
  if (ts.isCallExpression(node.parent) && node.parent.expression.getText() === "useState" &&
      node.parent.arguments[0] === node &&
      node.parent.typeArguments?.some((type) =>
        ts.isUnionTypeNode(type) && type.types.some((part) =>
          ts.isLiteralTypeNode(part) && ts.isStringLiteral(part.literal) &&
          part.literal.text === node.text))) {
    return { classification: "technical", reason: "typed-filter-enum" };
  }
  if (node.text === "all" && ts.isCallExpression(node.parent) &&
      node.parent.expression.getText() === "useState" && node.parent.arguments[0] === node &&
      node.parent.typeArguments?.some((type) => type.getText().includes('"all"'))) {
    return { classification: "technical", reason: "typed-filter-sentinel" };
  }
  if (node.text === "null" && ts.isReturnStatement(node.parent) &&
      ancestor(node, (candidate) =>
        ts.isFunctionDeclaration(candidate) && candidate.name?.getText() === "formatMetadataValue")) {
    return { classification: "technical", reason: "metadata-null-representation" };
  }
  // CSS custom properties are styling tokens, even under objects named `text`.
  if (!ts.isJsxText(node) && typeof node.text === "string" && /^var\(--[a-z0-9-]+\)$/.test(node.text)) return { classification: "technical", reason: "css-custom-property" };
  if (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent) || ts.isExternalModuleReference(node.parent)) {
    return { classification: "technical", reason: "module-specifier" };
  }
  if (ts.isLiteralTypeNode(node.parent)) return { classification: "technical", reason: "type-literal" };
  // Only recognized typed protocol unions qualify; ordinary strings remain candidates.
  if (ts.isCallExpression(node.parent) && node.parent.expression.getText() === "useState" &&
      node.parent.arguments[0] === node &&
      node.parent.typeArguments?.some((type) =>
        /\b(?:LegalDocumentType|LegalChangeClass|LegalUserAction)\b/.test(type.getText()))) {
    return { classification: "technical", reason: "typed-legal-state" };
  }
  if (typedDeclaration?.name.getText() === "ACTIONS_BY_DOCUMENT" &&
      /\bLegalUserAction\b/.test(typedDeclaration.type?.getText() || "")) {
    return { classification: "technical", reason: "typed-legal-action-map" };
  }
  if (node.text === "none" &&
      (typedDeclaration?.name.getText() === "allowedActions" ||
       ancestor(node, (candidate) =>
         ts.isCallExpression(candidate) && candidate.expression.getText() === "setUserAction"))) {
    return { classification: "technical", reason: "legal-no-action-sentinel" };
  }
  if (typedDeclaration?.name.getText() === "mailtoLink" &&
      ((ts.isTemplateExpression(node) && node.head.text.startsWith("&body=")) ||
       (typeof node.text === "string" && node.text.startsWith("&body=")))) {
    return { classification: "technical", reason: "mailto-query-fragment" };
  }
  if ((ts.isTemplateExpression(node) && node.head.text.startsWith("mailto:")) ||
      (typeof node.text === "string" && /^mailto:/.test(node.text))) {
    return { classification: "technical", reason: "mailto-uri-template" };
  }
  if (ts.isBinaryExpression(node.parent) && node.parent.operatorToken.kind === ts.SyntaxKind.InKeyword &&
      node.parent.left === node) {
    return { classification: "technical", reason: "object-property-test" };
  }
  if (ts.isNewExpression(node.parent) && node.parent.expression.getText() === "Error") return { classification: "technical", reason: "internal-exception" };
  if (ts.isCallExpression(node.parent) && /^(?:document\.getElementById|document\.querySelector|document\.querySelectorAll)$/.test(node.parent.expression.getText())) return { classification: "technical", reason: "dom-selector" };
  if (ts.isPropertyAssignment(node.parent) && node.parent.name === node) {
    return { classification: "technical", reason: "property-key" };
  }
  if (ts.isElementAccessExpression(node.parent) && node.parent.argumentExpression === node) {
    return { classification: "technical", reason: "property-access" };
  }
  // Translation keys are never UI copy even when passed to a visible JSX property.
  const enclosingCall = ancestor(node, (candidate) => ts.isCallExpression(candidate));
  if (enclosingCall && isTranslationCall(enclosingCall)) {
    return { classification: "technical", reason: "translation-key" };
  }
  const attribute = ancestor(node, (candidate) => ts.isJsxAttribute(candidate));
  if (attribute) {
    const key = attribute.name.getText().toLowerCase();
    if (["aria-labelledby", "aria-describedby", "aria-controls", "aria-owns", "aria-activedescendant"].includes(key)) {
      return { classification: "technical", reason: `jsx-id-reference:${key}` };
    }
    const handler = ancestor(node, (candidate) =>
      ts.isCallExpression(candidate) && candidate.expression.getText() === "handleModerateContent");
    if (key === "onclick" && handler &&
        handler.arguments.some((argument) => argument === node)) {
      return { classification: "technical", reason: "moderation-action-code" };
    }
    if (TECHNICAL_ARIA_PROPS.has(key)) {
      return { classification: "technical", reason: `aria-state:${key}` };
    }
    // SVG vector coordinates, paint tokens and path commands are not UI copy.
    // Restrict this rule to native SVG tags, not custom React components.
    const owner = attribute.parent;
    if (ts.isJsxAttributes(owner)) {
      const element = owner.parent;
      const tagName = element.tagName?.getText();
      if (tagName && SVG_TAGS.has(tagName) && SVG_ATTRIBUTES.has(key)) {
        return { classification: "technical", reason: `svg-attribute:${key}` };
      }
    }
    if (key.startsWith("on") && key.length > 2) {
      const uiCall = ancestor(node, (candidate) =>
        ts.isCallExpression(candidate) &&
        (MESSAGE_CALLS.test(candidate.expression.getText()) ||
         MESSAGE_METHODS.test(candidate.expression.getText())));
      if (uiCall) return { classification: "ui", reason: "event-handler-notification" };
      return { classification: "technical", reason: `event-handler-code:${key}` };
    }
    if (TECHNICAL_PROPS.has(key)) {
      return { classification: "technical", reason: `jsx-technical-prop:${key}` };
    }
    if (key.startsWith("aria-") || UI_PROPS.has(key)) return { classification: "ui", reason: `jsx-attribute:${key}` };
    if (key.startsWith("data-") || TECHNICAL_JSX_PROPS.has(key)) return { classification: "technical", reason: `jsx-property:${key}` };
    return { classification: "review", reason: `jsx-property:${key}` };
  }
  if (ancestor(node, (candidate) => ts.isJsxExpression(candidate) &&
      (ts.isJsxElement(candidate.parent) || ts.isJsxSelfClosingElement(candidate.parent) || ts.isJsxFragment(candidate.parent)))) {
    return { classification: "ui", reason: "jsx-expression" };
  }
  const call = ancestor(node, (candidate) => ts.isCallExpression(candidate));
  if (call && isTranslationCall(call) && call.arguments.some((arg) => arg === node || node.pos >= arg.pos && node.end <= arg.end)) {
    return { classification: "technical", reason: "translation-key" };
  }
  if (call) {
    const name = call.expression.getText();
    if (name === "React.createElement" || name === "createElement" || name === "h") {
      const argIndex = call.arguments.findIndex((arg) => node === arg || node.pos >= arg.pos && node.end <= arg.end);
      if (argIndex === 0) return { classification: "technical", reason: "element-tag" };
      if (argIndex >= 2) return { classification: "ui", reason: "element-child" };
    }
    if (/^(?:require|import)$/.test(name)) return { classification: "technical", reason: "module-reference" };
    if (name === "navigate" && call.arguments[0] === node) return { classification: "technical", reason: "navigation-target" };
    if ((name === "document.documentElement.setAttribute" || name.endsWith(".setAttribute")) &&
        call.arguments[0] === node) return { classification: "technical", reason: "dom-attribute-name" };
    if (name.endsWith(".includes") && call.arguments.length > 0 &&
        ancestor(call, (candidate) => ts.isIfStatement(candidate) || ts.isConditionalExpression(candidate))) {
      return { classification: "technical", reason: "predicate-discriminator" };
    }
    if (MESSAGE_CALLS.test(name) || MESSAGE_METHODS.test(name)) {
      return { classification: "ui", reason: `notification:${name}` };
    }
    if (/^(?:console|logger|log)\./.test(name)) return { classification: "technical", reason: "diagnostic-log" };
    if (/^(?:fetch|axios\.|apiClient\.|rawHttpClient\.)/.test(name)) return { classification: "technical", reason: "network-call" };
  }
  const prop = ancestor(node, (candidate) => ts.isPropertyAssignment(candidate));
  if (prop) {
    const key = prop.name.getText().replace(/["']/g, "").toLowerCase();
    if (key.startsWith("aria-") || UI_PROPS.has(key)) {
      return { classification: "ui", reason: `object-ui-field:${key}` };
    }
    if (TECHNICAL_OBJECT_KEYS.has(key)) return { classification: "technical", reason: `object-field:${key}` };
  }
  if (ts.isBinaryExpression(node.parent) && [
    ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
    ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken,
  ].includes(node.parent.operatorToken.kind)) {
    return { classification: "technical", reason: "comparison-literal" };
  }
  if (ts.isCaseBlock(node.parent) || ts.isCaseClause(node.parent)) return { classification: "technical", reason: "switch-discriminator" };
  if (ts.isJsxExpression(node.parent)) return { classification: "ui", reason: "jsx-expression" };
  return { classification: "review", reason: "unresolved-literal" };
}

function literalText(node, sourceFile) {
  if (ts.isJsxText(node)) return node.getText(sourceFile).replace(/\s+/g, " ").trim();
  if (ts.isTemplateExpression(node)) {
    const parts = [node.head.text];
    for (const span of node.templateSpans) parts.push("${expression}", span.literal.text);
    return parts.join("");
  }
  return node.text;
}

function analyzeSource(file, source, displayPath = file) {
  const extension = path.extname(file).toLowerCase();
  if (extension === ".css") return analyzeCss(source, displayPath);
  if (extension === ".html") return analyzeHtml(source, displayPath);
  const kind = [".tsx", ".jsx"].includes(extension) ? ts.ScriptKind.TSX :
    [".js", ".mjs", ".cjs"].includes(extension) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  if (sourceFile.parseDiagnostics.length) {
    throw new Error(`${displayPath}: parse failed: ${sourceFile.parseDiagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, " ")).join("; ")}`);
  }
  const findings = [];
  function visit(node) {
    if (ts.isJsxText(node) || ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
      const value = literalText(node, sourceFile);
      if (value && /\p{L}|\d/u.test(value)) {
        const decision = contextOf(node);
        const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        findings.push({ file: displayPath, line: pos.line + 1, column: pos.character + 1,
          kind: ts.SyntaxKind[node.kind], text: value,
          classification: decision.classification, reason: decision.reason });
      }
      if (ts.isTemplateExpression(node)) {
        for (const span of node.templateSpans) visit(span.expression);
        return;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return findings;
}

// Static HTML and CSS cannot be parsed by the TypeScript AST. Record their
// visible literals separately rather than silently omitting these file types.
function lineColumn(source, index) {
  const before = source.slice(0, index);
  const line = before.split("\n");
  return { line: line.length, column: line[line.length - 1].length + 1 };
}
function analyzeHtml(source, file) {
  const findings = [];
  for (const match of source.matchAll(/\b(?:title|placeholder|alt|aria-label|aria-description)\s*=\s*(["'])(.*?)\1/g)) {
    if (!match[2].trim()) continue;
    findings.push({ file, ...lineColumn(source, match.index), kind: "HtmlAttribute", text: match[2], classification: "ui", reason: "html-attribute" });
  }
  const noScripts = source.replace(/<(?:script|style)[^>]*>[\s\S]*?<\/(?:script|style)>/gi, (text) => text.replace(/[^\n]/g, " "));
  for (const match of noScripts.matchAll(/>([^<>{}]+)</g)) {
    const value = match[1].replace(/\s+/g, " ").trim();
    if (!/\p{L}/u.test(value)) continue;
    findings.push({ file, ...lineColumn(noScripts, match.index + 1), kind: "HtmlText", text: value, classification: "ui", reason: "html-text" });
  }
  return findings;
}
function analyzeCss(source, file) {
  const findings = [];
  for (const match of source.matchAll(/\bcontent\s*:\s*(["'])(.*?)\1\s*;/g)) {
    if (!/\p{L}/u.test(match[2])) continue;
    findings.push({ file, ...lineColumn(source, match.index), kind: "CssContent", text: match[2].slice(0, 500), classification: "review", reason: "css-generated-text" });
  }
  return findings;
}

function scanRepository(root = process.cwd()) {
  const files = SOURCE_ROOTS.flatMap((relative) => walkFiles(path.join(root, relative)));
  const findings = files.flatMap((absolute) => analyzeSource(absolute, fs.readFileSync(absolute, "utf8"), path.relative(root, absolute).replace(/\\/g, "/")));
  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column || a.kind.localeCompare(b.kind));
  const occurrence = new Map();
  for (const finding of findings) {
    const stablePart = [finding.file, finding.kind, finding.text].join("\0");
    const nth = occurrence.get(stablePart) || 0;
    occurrence.set(stablePart, nth + 1);
    finding.id = crypto.createHash("sha256").update(`${stablePart}\0${nth}`).digest("hex").slice(0, 16);
  }
  const counts = { ui: 0, review: 0, technical: 0 };
  for (const finding of findings) counts[finding.classification]++;
  return { schemaVersion: 1, mode: "inventory", roots: SOURCE_ROOTS, filesScanned: files.length,
    counts, total: findings.length, findings };
}

function markdownReport(report) {
  const lines = ["# Frontend literal audit", "", "Static inventory, **not** proof that every finding is displayed to users.",
    "The `ui` and `review` classifications must be reviewed; `technical` literals are retained for completeness.",
    "", `Scanned files: ${report.filesScanned}; total literals: ${report.total}; UI: ${report.counts.ui}; review: ${report.counts.review}; technical: ${report.counts.technical}.`,
    "", "| Classification | File:line | Reason | Literal |", "|---|---|---|---|"];
  for (const finding of report.findings) {
    if (finding.classification === "technical") continue;
    const safe = finding.text.replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ").slice(0, 180);
    lines.push(`| ${finding.classification} | \`${finding.file}:${finding.line}\` | ${finding.reason} | ${safe} |`);
  }
  lines.push("", "Full inventory (including technical literals) is in the JSON artifact.",
    "Run `pnpm ui-literals:strict` only after reviewing and remediating all candidates.", "");
  return lines.join("\n");
}

function cli(args) {
  const root = process.cwd();
  const option = (name) => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; };
  const report = scanRepository(root);
  const jsonPath = option("--json");
  const mdPath = option("--md");
  for (const [destination, data] of [[jsonPath, JSON.stringify(report, null, 2) + "\n"], [mdPath, markdownReport(report)]]) {
    if (!destination) continue;
    const absolute = path.resolve(root, destination);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, data);
  }
  console.log(`UI literal audit: ${report.filesScanned} files; ${report.counts.ui} UI, ${report.counts.review} review, ${report.counts.technical} technical literals.`);
  if (args.includes("--strict") && report.counts.ui + report.counts.review > 0) {
    console.error("Unresolved user-visible literal candidates remain. See the audit report.");
    process.exitCode = 1;
  }
}

module.exports = { analyzeSource, scanRepository, markdownReport, analyzeHtml, analyzeCss };
if (require.main === module) {
  try { cli(process.argv.slice(2)); } catch (error) { console.error(error); process.exitCode = 2; }
}
