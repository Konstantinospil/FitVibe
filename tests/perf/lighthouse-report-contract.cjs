"use strict";
const { auditUrl } = require("./lighthouse-routes.cjs");

function verifyRouteIdentity(route, lhr, origin = "http://127.0.0.1:4180") {
  const expected = auditUrl(route, origin);
  if (lhr.requestedUrl !== expected) {
    throw new Error("Wrong Lighthouse target: expected " + expected + ", received " + lhr.requestedUrl);
  }
  const finalUrl = lhr.finalDisplayedUrl || lhr.finalUrl;
  if (!finalUrl) throw new Error("Lighthouse omitted the final displayed URL");
  const final = new URL(finalUrl);
  const target = new URL(expected);
  if (final.origin !== target.origin || final.pathname !== target.pathname) {
    throw new Error(route.mode + " " + route.path + " redirected or replaced by " + finalUrl);
  }
  if (lhr.runtimeError) throw new Error("Lighthouse runtime error on " + expected + ": " + lhr.runtimeError.message);
  for (const category of ["performance", "accessibility", "best-practices", "seo"]) {
    if (typeof lhr.categories?.[category]?.score !== "number") {
      throw new Error("Missing Lighthouse " + category + " score on " + expected);
    }
  }
}

module.exports = { verifyRouteIdentity };
