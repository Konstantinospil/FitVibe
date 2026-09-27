import { describe, expect, it, jest } from "@jest/globals";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { measurementsRouter } from "../../../../apps/backend/src/modules/measurements/measurements.routes.js";

jest.mock("../../../../apps/backend/src/modules/auth/auth.middleware.js", () => ({
  requireAccessToken: jest.fn((_req: Request, _res: Response, next: NextFunction) => next()),
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

function createResponse(): Response {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe("measurements routes", () => {
  it.each(["/biometrics/attributes", "/performance/attributes"])(
    "protects catalogue creation on %s with admin RBAC",
    (path) => {
      const layer = measurementsRouter.stack.find(
        (candidate) =>
          candidate.route?.path === path &&
          (candidate.route as { methods?: { post?: boolean } }).methods?.post,
      );

      expect(layer).toBeDefined();

      const handlers = (layer?.route?.stack ?? []).map(
        (routeLayer) => routeLayer.handle as RequestHandler,
      );
      expect(handlers).toHaveLength(4);

      const roleGuard = handlers[2];
      expect(roleGuard).toBeDefined();

      const userResponse = createResponse();
      const userNext = jest.fn();
      roleGuard(
        { user: { sub: "user-1", role: "user" } } as unknown as Request,
        userResponse,
        userNext,
      );

      expect(userResponse.status).toHaveBeenCalledWith(403);
      expect(userResponse.json).toHaveBeenCalledWith({ error: "Forbidden" });
      expect(userNext).not.toHaveBeenCalled();

      const adminResponse = createResponse();
      const adminNext = jest.fn();
      roleGuard(
        { user: { sub: "admin-1", role: "admin" } } as unknown as Request,
        adminResponse,
        adminNext,
      );

      expect(adminResponse.status).not.toHaveBeenCalled();
      expect(adminNext).toHaveBeenCalledTimes(1);
    },
  );
});
