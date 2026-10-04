/**
 * Unit tests for exercise routes
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";
import { exercisesRouter } from "../../../../apps/backend/src/modules/exercises/exercise.routes.js";

// Mock dependencies
jest.mock("../../../../apps/backend/src/modules/auth/auth.middleware.js", () => ({
  requireAccessToken: jest.fn((req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock("../../../../apps/backend/src/middlewares/rate-limit.js", () => ({
  rateLimit: jest.fn(() => (req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock("../../../../apps/backend/src/utils/async-handler.js", () => ({
  asyncHandler: jest.fn((fn: unknown) => fn),
}));

jest.mock("../../../../apps/backend/src/modules/exercises/exercise.controller.js", () => ({
  listExercisesHandler: jest.fn(),
  getExerciseHandler: jest.fn(),
  createExerciseHandler: jest.fn(),
  updateExerciseHandler: jest.fn(),
  deleteExerciseHandler: jest.fn(),
}));

describe("Exercise Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should register GET / route", () => {
    const routes = exercisesRouter.stack;
    const listRoute = routes.find(
      (layer) =>
        layer.route?.path === "/" && (layer.route as { methods?: { get?: boolean } })?.methods?.get,
    );
    expect(listRoute).toBeDefined();
  });

  it("should register GET /:id route", () => {
    const routes = exercisesRouter.stack;
    const getRoute = routes.find(
      (layer) =>
        layer.route?.path === "/:id" &&
        (layer.route as { methods?: { get?: boolean } })?.methods?.get,
    );
    expect(getRoute).toBeDefined();
  });

  it("should register POST / route", () => {
    const routes = exercisesRouter.stack;
    const createRoute = routes.find(
      (layer) =>
        layer.route?.path === "/" &&
        (layer.route as { methods?: { post?: boolean } })?.methods?.post,
    );
    expect(createRoute).toBeDefined();
  });

  it("should register PUT /:id route", () => {
    const routes = exercisesRouter.stack;
    const updateRoute = routes.find(
      (layer) =>
        layer.route?.path === "/:id" &&
        (layer.route as { methods?: { put?: boolean } })?.methods?.put,
    );
    expect(updateRoute).toBeDefined();
  });

  it("should register DELETE /:id route", () => {
    const routes = exercisesRouter.stack;
    const deleteRoute = routes.find(
      (layer) =>
        layer.route?.path === "/:id" &&
        (layer.route as { methods?: { delete?: boolean } })?.methods?.delete,
    );
    expect(deleteRoute).toBeDefined();
  });
});
