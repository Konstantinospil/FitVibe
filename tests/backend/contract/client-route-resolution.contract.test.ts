/**
 * Guardrail for #649: every backend call made by the backoffice and the athlete frontend
 * must resolve to a route the backend actually mounts.
 *
 * In August 2026 a merge kept the backoffice client but silently dropped 13 backend routes;
 * nothing failed until Lighthouse discarded the 404ing pages. This test extracts each
 * `apiClient.<method>(path)` call from the client sources with the TypeScript AST and
 * dispatches it through the live Express router stack (matching only, no handlers run).
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import app from "../../../apps/backend/src/app.js";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const CLIENT_ROOTS = ["apps/backoffice/src", "apps/frontend/src"];
const CLIENT_IDENTIFIERS = new Set(["apiClient", "rawHttpClient", "csrfClient"]);
const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete"]);
/** Stand-in for interpolated path segments; a valid UUID satisfies id-shaped params. */
const SAMPLE_SEGMENT = "00000000-0000-4000-8000-000000000000";

/**
 * Client calls with no backend route, each tied to an open issue. Entries must be removed
 * once fixed; a stale entry fails the test so this list can only shrink.
 */
const UNUSED_FRONTEND_CLIENT =
  "athlete frontend: unused client function, no UI caller (found by #649 check)";
const KNOWN_UNRESOLVED: Record<string, string> = {
  "POST /api/v1/feed/item/:param/bookmark": UNUSED_FRONTEND_CLIENT,
  "DELETE /api/v1/feed/item/:param/bookmark": UNUSED_FRONTEND_CLIENT,
  "GET /api/v1/feed/:param/comments": UNUSED_FRONTEND_CLIENT,
  "POST /api/v1/feed/:param/comments": UNUSED_FRONTEND_CLIENT,
  "GET /api/v1/leaderboards": UNUSED_FRONTEND_CLIENT,
  "GET /api/v1/measurements/:param/attributes": UNUSED_FRONTEND_CLIENT,
  "POST /api/v1/measurements/:param/attributes/:param/values": UNUSED_FRONTEND_CLIENT,
  "PUT /api/v1/measurements/:param/attributes/:param/visibility": UNUSED_FRONTEND_CLIENT,
  "POST /api/v1/sessions/:param/share": UNUSED_FRONTEND_CLIENT,
  "DELETE /api/v1/sessions/:param/share": UNUSED_FRONTEND_CLIENT,
  "POST /api/v1/system/read-only/enable": UNUSED_FRONTEND_CLIENT,
  "POST /api/v1/system/read-only/disable": UNUSED_FRONTEND_CLIENT,
  "POST /api/v1/admin/users/:param/unsuspend": UNUSED_FRONTEND_CLIENT,
};

interface ClientCall {
  method: string;
  path: string;
  location: string;
}

interface RouterLayer {
  match(path: string): boolean;
  path?: string;
  route?: { _handlesMethod?(method: string): boolean; methods: Record<string, boolean> };
  handle: { stack?: RouterLayer[] };
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return ["node_modules", "dist", "archive", "__tests__"].includes(entry.name)
        ? []
        : sourceFiles(full);
    }
    return /\.(?:ts|tsx)$/.test(entry.name) && !/\.(?:test|spec|d)\.tsx?$/.test(entry.name)
      ? [full]
      : [];
  });
}

/** Static text of a path argument, with interpolated parts replaced by a sample segment. */
function pathText(node: ts.Expression): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isTemplateExpression(node)) {
    return node.head.text + node.templateSpans.map((s) => SAMPLE_SEGMENT + s.literal.text).join("");
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = pathText(node.left);
    return left === null ? null : left + (pathText(node.right) ?? SAMPLE_SEGMENT);
  }
  if (ts.isParenthesizedExpression(node)) {
    return pathText(node.expression);
  }
  return null;
}

function extractClientCalls(): ClientCall[] {
  const calls: ClientCall[] = [];
  for (const root of CLIENT_ROOTS) {
    for (const file of sourceFiles(path.join(REPO_ROOT, root))) {
      const source = ts.createSourceFile(
        file,
        fs.readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          CLIENT_IDENTIFIERS.has(node.expression.expression.text) &&
          HTTP_METHODS.has(node.expression.name.text) &&
          node.arguments.length > 0
        ) {
          const text = pathText(node.arguments[0]);
          if (text?.startsWith("/api/")) {
            const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
            calls.push({
              method: node.expression.name.text.toUpperCase(),
              path: text.split("?")[0],
              location: `${path.relative(REPO_ROOT, file)}:${line + 1}`,
            });
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
  }
  return calls;
}

/** Mirrors Express 5 dispatch: descend into matching routers, stop at a matching route. */
function resolves(stack: RouterLayer[], method: string, requestPath: string): boolean {
  for (const layer of stack) {
    if (!layer.match(requestPath)) {
      continue;
    }
    if (layer.route) {
      const handles = layer.route._handlesMethod
        ? layer.route._handlesMethod(method)
        : Boolean(layer.route.methods[method.toLowerCase()] || layer.route.methods._all);
      if (handles) {
        return true;
      }
      continue;
    }
    if (layer.handle.stack) {
      const prefix = layer.path ?? "";
      const rest = requestPath.slice(prefix.length) || "/";
      if (resolves(layer.handle.stack, method, rest.startsWith("/") ? rest : `/${rest}`)) {
        return true;
      }
    }
  }
  return false;
}

describe("client API calls resolve to mounted backend routes", () => {
  const router = (app as unknown as { router: { stack: RouterLayer[] } }).router;
  const calls = extractClientCalls();
  const key = (call: ClientCall) =>
    `${call.method} ${call.path.replaceAll(SAMPLE_SEGMENT, ":param")}`;

  it("finds the client calls it is meant to check", () => {
    // Guards against the extractor silently matching nothing after a refactor.
    expect(calls.length).toBeGreaterThan(100);
    expect(calls.some((call) => call.location.startsWith("apps/backoffice/"))).toBe(true);
    expect(calls.some((call) => call.location.startsWith("apps/frontend/"))).toBe(true);
  });

  it("has no unresolved client calls beyond the tracked allowlist", () => {
    const unresolved = calls.filter((call) => !resolves(router.stack, call.method, call.path));
    const unexpected = unresolved
      .filter((call) => !(key(call) in KNOWN_UNRESOLVED))
      .map((call) => `${key(call)}  (${call.location})`);
    expect(unexpected).toEqual([]);
  });

  it("keeps the allowlist free of entries that now resolve", () => {
    const unresolvedKeys = new Set(
      calls.filter((call) => !resolves(router.stack, call.method, call.path)).map(key),
    );
    const stale = Object.keys(KNOWN_UNRESOLVED).filter((entry) => !unresolvedKeys.has(entry));
    expect(stale).toEqual([]);
  });
});
