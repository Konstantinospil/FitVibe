/**
 * Unit tests for exercise-types routes
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";
import { exerciseTypesRouter } from "../../../../apps/backend/src/modules/exercise-types/exerciseTypes.routes.js";

// Mock dependencies
jest.mock("../../../../apps/backend/src/modules/auth/auth.middleware.js", () => ({
  requireAccessToken: jest.fn((req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock("../../../../apps/backend/src/modules/common/rbac.middleware.js", () => ({
  requireRole: jest.fn(() => (req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock("../../../../apps/backend/src/modules/common/rateLimiter.js", () => ({
  rateLimit: jest.fn(() => (req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock("../../../../apps/backend/src/utils/async-handler.js", () => ({
  asyncHandler: jest.fn((fn: unknown) => fn),
}));

jest.mock(
  "../../../../apps/backend/src/modules/exercise-types/exerciseTypes.controller.js",
  () => ({
    listTypes: jest.fn(),
    getType: jest.fn(),
    createType: jest.fn(),
    updateType: jest.fn(),
    deleteType: jest.fn(),
  }),
);

describe("Exercise Types Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should register GET / route", () => {
    const routes = exerciseTypesRouter.stack;
    const listRoute = routes.find(
      (layer) =>
        layer.route?.path === "/" && (layer.route as { methods?: { get?: boolean } })?.methods?.get,
    );
    expect(listRoute).toBeDefined();
  });

  it("should register GET /:code route", () => {
    const routes = exerciseTypesRouter.stack;
    const getRoute = routes.find(
      (layer) =>
        layer.route?.path === "/:code" &&
        (layer.route as { methods?: { get?: boolean } })?.methods?.get,
    );
    expect(getRoute).toBeDefined();
  });

  it("should register POST / route (admin-only)", () => {
    const routes = exerciseTypesRouter.stack;
    const createRoute = routes.find(
      (layer) =>
        layer.route?.path === "/" &&
        (layer.route as { methods?: { post?: boolean } })?.methods?.post,
    );
    expect(createRoute).toBeDefined();
  });

  it("should register PATCH /:code route (admin-only)", () => {
    const routes = exerciseTypesRouter.stack;
    const updateRoute = routes.find(
      (layer) =>
        layer.route?.path === "/:code" &&
        (layer.route as { methods?: { patch?: boolean } })?.methods?.patch,
    );
    expect(updateRoute).toBeDefined();
  });

  it("should register DELETE /:code route (admin-only)", () => {
    const routes = exerciseTypesRouter.stack;
    const deleteRoute = routes.find(
      (layer) =>
        layer.route?.path === "/:code" &&
        (layer.route as { methods?: { delete?: boolean } })?.methods?.delete,
    );
    expect(deleteRoute).toBeDefined();
  });
});
