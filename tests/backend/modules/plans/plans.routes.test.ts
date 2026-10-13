/**
 * Unit tests for plans routes
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";
import { plansRouter } from "../../../../apps/backend/src/modules/plans/plans.routes.js";

// Mock dependencies
jest.mock("../../../../apps/backend/src/modules/auth/auth.middleware.js", () => ({
  requireAccessToken: jest.fn((req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock("../../../../apps/backend/src/utils/async-handler.js", () => ({
  asyncHandler: jest.fn((fn: unknown) => fn),
}));

jest.mock("../../../../apps/backend/src/modules/plans/plans.controller.js", () => ({
  listPlansHandler: jest.fn(),
  getPlanHandler: jest.fn(),
  createPlanHandler: jest.fn(),
  updatePlanHandler: jest.fn(),
  archivePlanHandler: jest.fn(),
  deletePlanHandler: jest.fn(),
  getPlanStatsHandler: jest.fn(),
  activatePlanHandler: jest.fn(),
}));

describe("Plans Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should register GET /stats route", () => {
    const routes = plansRouter.stack;
    const statsRoute = routes.find(
      (layer) =>
        layer.route?.path === "/stats" &&
        (layer.route as { methods?: { get?: boolean } })?.methods?.get,
    );
    expect(statsRoute).toBeDefined();
  });

  it("should register GET / route", () => {
    const routes = plansRouter.stack;
    const listRoute = routes.find(
      (layer) =>
        layer.route?.path === "/" && (layer.route as { methods?: { get?: boolean } })?.methods?.get,
    );
    expect(listRoute).toBeDefined();
  });

  it("should register POST / route", () => {
    const routes = plansRouter.stack;
    const createRoute = routes.find(
      (layer) =>
        layer.route?.path === "/" &&
        (layer.route as { methods?: { post?: boolean } })?.methods?.post,
    );
    expect(createRoute).toBeDefined();
  });

  it("should register GET /:id route", () => {
    const routes = plansRouter.stack;
    const getRoute = routes.find(
      (layer) =>
        layer.route?.path === "/:id" &&
        (layer.route as { methods?: { get?: boolean } })?.methods?.get,
    );
    expect(getRoute).toBeDefined();
  });

  it("should register PATCH /:id route", () => {
    const routes = plansRouter.stack;
    const updateRoute = routes.find(
      (layer) =>
        layer.route?.path === "/:id" &&
        (layer.route as { methods?: { patch?: boolean } })?.methods?.patch,
    );
    expect(updateRoute).toBeDefined();
  });

  it("should register POST /:id/archive route", () => {
    const routes = plansRouter.stack;
    const archiveRoute = routes.find(
      (layer) =>
        layer.route?.path === "/:id/archive" &&
        (layer.route as { methods?: { post?: boolean } })?.methods?.post,
    );
    expect(archiveRoute).toBeDefined();
  });

  it("should register DELETE /:id route", () => {
    const routes = plansRouter.stack;
    const deleteRoute = routes.find(
      (layer) =>
        layer.route?.path === "/:id" &&
        (layer.route as { methods?: { delete?: boolean } })?.methods?.delete,
    );
    expect(deleteRoute).toBeDefined();
  });
  it("registers POST /:id/activate", () => {
    const route = plansRouter.stack.find((layer) =>
      layer.route?.path === "/:id/activate" &&
      (layer.route as { methods?: { post?: boolean } }).methods?.post,
    );
    expect(route).toBeDefined();
  });

});
