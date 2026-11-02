"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

// Browser snapshots contain only DOM-visible text and accessible labels.
// Combine with exact English translation values and the static UI AST inventory.
const LOCALES = ["en", "de", "fr", "es", "el"];
function normalize(text) { return String(text || "").replace(/\s+/g, " ").trim(); }
function flat(input, prefix = "", output = {}) {
  for (const [key, value] of Object.entries(input || {})) {
    const next = prefix ? prefix + "." + key : key;
    if (value && typeof value === "object" && !Array.isArray(value)) flat(value, next, output);
    else if (typeof value === "string") output[next] = value;
  }
  return output;
}
function messages(locale, root = process.cwd()) {
  if (!LOCALES.includes(locale)) throw Error("Unsupported locale: " + locale);
  const merged = {};
  for (const name of ["common", "auth", "terms", "privacy", "cookie"]) {
    const file = path.resolve(root, "apps/frontend/src/i18n/locales", locale, name + ".json");
    Object.assign(merged, flat(JSON.parse(fs.readFileSync(file, "utf8")), name));
  }
  return merged;
}
function analyzeSnapshot(snapshot, locale, english, localized, sourceUiTexts = []) {
  if (!LOCALES.includes(locale)) throw Error("Unsupported locale");
  const comparison = new Map();
  if (locale !== "en") {
    for (const [key, englishText] of Object.entries(english)) {
      const alternative = localized[key];
      const en = normalize(englishText), other = normalize(alternative);
      if (en.length < 4 || !/[a-z]{3}/i.test(en) || !other || en === other || /\{\{/.test(en)) continue;
      if (!comparison.has(en)) comparison.set(en, []);
      comparison.get(en).push(key);
    }
  }
  const sourceSet = new Set(sourceUiTexts.map(normalize).filter(x => x.length > 0));
  const findings = [];
  for (const item of snapshot.entries) {
    const text = normalize(item.text);
    if (!text) continue;
    let reason = null, classification = null, keys = [];
    if (comparison.has(text)) {
      reason = "english-translation-fallback"; classification = "ui"; keys = comparison.get(text);
    } else if (sourceSet.has(text)) {
      reason = "static-ui-literal-rendered"; classification = "review";
    } else if (/^(?:[a-z][a-z0-9_-]*\.){2,}[a-z0-9_-]+$/i.test(text)) {
      reason = "unresolved-translation-key"; classification = "review";
    }
    if (!reason) continue;
    const finding = { locale, url: snapshot.url, kind: item.kind, text, reason,
      classification, key: keys, selector: item.selector };
    finding.id = crypto.createHash("sha256").update([locale, snapshot.url, reason, item.selector, text].join("\0")).digest("hex").slice(0, 16);
    findings.push(finding);
  }
  return { locale, url: snapshot.url, htmlLang: snapshot.htmlLang,
    snapshotCount: snapshot.entries.length, counts: {
      englishFallbacks: findings.filter(f => f.reason === "english-translation-fallback").length,
      renderedSourceLiterals: findings.filter(f => f.reason === "static-ui-literal-rendered").length,
      unresolvedKeys: findings.filter(f => f.reason === "unresolved-translation-key").length
    }, findings };
}

async function capturePage(page) {
  return page.evaluate(() => {
    const entries = [];
    const visible = (el) => {
      if (!el || !el.isConnected || el.closest("[aria-hidden='true'],[hidden]")) return false;
      for (let current = el; current; current = current.parentElement) {
        const style = window.getComputedStyle(current);
        if (style.display === "none" || style.visibility === "hidden") return false;
      }
      return el.getClientRects().length > 0;
    };
    function selector(el) {
      if (el.id) return "#" + el.id;
      const type = el.tagName.toLowerCase();
      const role = el.getAttribute("role");
      return type + (role ? "[role='" + role + "']" : "");
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode, parent = node.parentElement;
      if (!parent || ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"].includes(parent.tagName) || !visible(parent)) continue;
      const value = node.textContent.replace(/\s+/g, " ").trim();
      if (value) entries.push({ kind: "text", text: value, selector: selector(parent) });
    }
    for (const el of document.querySelectorAll("[aria-label],[alt],[placeholder],[title],[aria-description]")) {
      if (!visible(el)) continue;
      for (const attribute of ["aria-label", "alt", "placeholder", "title", "aria-description"]) {
        const value = el.getAttribute(attribute);
        if (value) entries.push({ kind: attribute, text: value, selector: selector(el) });
      }
    }
    if (document.title) entries.push({ kind: "document-title", text: document.title, selector: "head > title" });
    return { url: location.pathname, htmlLang: document.documentElement.lang, entries };
  });
}
module.exports = { LOCALES, normalize, flat, messages, analyzeSnapshot, capturePage };
