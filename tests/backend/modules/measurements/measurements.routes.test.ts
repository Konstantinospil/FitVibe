import { describe, expect, it, jest } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";
import { requireRole } from "../../../../apps/backend/src/modules/common/rbac.middleware.js";
import { measurementsRouter } from "../../../../apps/backend/src/modules/measurements/measurements.routes.js";

jest.mock("../../../../apps/backend/src/modules/auth/auth.middleware.js", () => ({
  requireAccessToken: jest.fn((_req: Request, _res: Response, next: NextFunction) => next()),
}));

jest.mock("../../../../apps/backend/src/modules/common/rbac.middleware.js", () => ({
  requireRole: jest.fn(() => (_req: Request, _res: Response, next: NextFunction) => next()),
}));

jest.mock("../../../../apps/backend/src/modules/common/rateLimiter.js", () => ({
  rateLimit: jest.fn(() => (_req: Request, _res: Response, next: NextFunction) => next()),
}));

jest.mock("../../../../apps/backend/src/utils/async-handler.js", () => ({
  asyncHandler: jest.fn((fn: unknown) => fn),
}));

jest.mock("../../../../apps/backend/src/modules/measurements/measurements.controller.js", () => ({
  addBioValue: jest.fn(),
  addPerfValue: jest.fn(),
  createBioAttribute: jest.fn(),
  createPerfAttribute: jest.fn(),
  listBioAttributes: jest.fn(),
  listPerfAttributes: jest.fn(),
  updateBioVisibility: jest.fn(),
  updatePerfVisibility: jest.fn(),
}));

describe("measurements routes", () => {
  it("keeps catalogue creation behind the admin role", () => {
    const createPaths = measurementsRouter.stack
      .filter(
        (layer) =>
          layer.route &&
          (layer.route as { methods?: { post?: boolean } }).methods?.post &&
          String(layer.route.path).endsWith("/attributes"),
      )
      .map((layer) => layer.route?.path);

    expect(createPaths).toEqual(["/biometrics/attributes", "/performance/attributes"]);
    expect(jest.mocked(requireRole)).toHaveBeenCalledTimes(2);
    expect(jest.mocked(requireRole)).toHaveBeenNthCalledWith(1, "admin");
    expect(jest.mocked(requireRole)).toHaveBeenNthCalledWith(2, "admin");
  });
});
