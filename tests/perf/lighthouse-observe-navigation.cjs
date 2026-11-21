"use strict";

/**
 * Observe the tab Lighthouse itself opens. This is deliberately separate from
 * the setup/preflight page: only a real navigation to the requested URL can
 * generate a readiness record. Do not create or navigate another tab here.
 */
function observeNavigation(context, requestedUrl, verifyPage) {
  const tasks = [];
  const watched = new Map();
  const seen = new Set();

  const inspect = (page, frame) => {
    if (seen.has(page) || frame !== page.mainFrame() ||
        frame.url() !== requestedUrl) return;
    seen.add(page);
    // Capture the outcome, including failure, rather than dropping a rejected
    // promise or turning a browser crash into a successful measurement.
    tasks.push(Promise.resolve().then(async () => {
      await verifyPage(page);
      if (page.url() !== requestedUrl) {
        throw new Error("Measured browser tab navigated away from " + requestedUrl);
      }
      return { requestedUrl, ready: true, observedUrl: page.url() };
    }).then(
      (result) => result,
      (error) => ({ requestedUrl, ready: false, error: error.message }),
    ));
  };

  const onPage = (page) => {
    const onFrame = (frame) => inspect(page, frame);
    watched.set(page, onFrame);
    page.on("framenavigated", onFrame);
    inspect(page, page.mainFrame());
  };
  context.on("page", onPage);

  return {
    async finish() {
      context.off("page", onPage);
      for (const [page, callback] of watched) {
        page.off("framenavigated", callback);
      }
      const observations = await Promise.all(tasks);
      if (observations.length !== 1 || observations[0].ready !== true) {
        throw new Error("Missing or failed same-navigation browser readiness for " +
          requestedUrl + ": " + JSON.stringify(observations));
      }
      return observations[0];
    },
  };
}

module.exports = { observeNavigation };
