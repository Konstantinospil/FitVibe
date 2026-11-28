import { describe, expect, it, jest } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";

jest.mock("../../../../apps/backend/src/modules/common/rateLimiter.js", () => ({
  rateLimit: jest.fn(() => (_req: Request, _res: Response, next: NextFunction) => next()),
}));

import { rateLimit } from "../../../../apps/backend/src/modules/common/rateLimiter.js";
import { clientErrorsRouter } from "../../../../apps/backend/src/modules/client-errors/client-errors.routes.js";

// Captured at import time: jest.config clears mock calls before each test.
const rateLimitKeys = jest.mocked(rateLimit).mock.calls.map(([key]) => key);

describe("Client error routes", () => {
  it("registers a rate-limited POST / that needs no access token", () => {
    const route = clientErrorsRouter.stack.find(
      (layer) => layer.route?.path === "/" && layer.route.methods.post,
    );
    expect(route).toBeDefined();
    // rate limiter + controller; no authentication middleware
    expect(route?.route?.stack).toHaveLength(2);
    expect(rateLimitKeys).toEqual(["client_errors_report"]);
  });
});
