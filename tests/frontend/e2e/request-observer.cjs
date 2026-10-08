"use strict";
const assert = require("node:assert/strict");

function observeMutation(page, method, path) {
  const requests = [];
  const responses = [];
  const failures = [];
  const matches = (request) =>
    request.method() === method && new URL(request.url()).pathname === path;
  const onRequest = (request) => { if (matches(request)) requests.push(request); };
  const onResponse = (response) => { if (matches(response.request())) responses.push(response); };
  const onFailure = (request) => {
    if (matches(request)) failures.push(request.failure()?.errorText || "unknown");
  };
  page.on("request", onRequest);
  page.on("response", onResponse);
  page.on("requestfailed", onFailure);
  return {
    assertExactlyOnce(status) {
      assert.equal(requests.length, 1, method + " " + path + ": expected exactly one request");
      assert.equal(failures.length, 0, "Unexpected mutation transport failures");
      assert.equal(responses.length, 1, "Expected exactly one mutation response");
      assert.equal(responses[0].status(), status, "Unexpected mutation response status");
    },
    stop() {
      page.off("request", onRequest);
      page.off("response", onResponse);
      page.off("requestfailed", onFailure);
    },
  };
}

module.exports = { observeMutation };
