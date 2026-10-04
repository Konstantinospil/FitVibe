/**
 * Unit tests for two-factor authentication routes
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";
import twoFactorRouter from "../../../../apps/backend/src/modules/auth/two-factor.routes.js";

// Mock dependencies
jest.mock("../../../../apps/backend/src/modules/auth/auth.middleware.js", () => ({
  requireAccessToken: jest.fn((req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock("../../../../apps/backend/src/utils/async-handler.js", () => ({
  asyncHandler: jest.fn((fn: unknown) => fn),
}));

jest.mock("../../../../apps/backend/src/modules/auth/two-factor.controller.js", () => ({
  setup: jest.fn(),
  restartSetup: jest.fn(),
  enable: jest.fn(),
  disable: jest.fn(),
  verify: jest.fn(),
  regenerateBackups: jest.fn(),
  status: jest.fn(),
}));

describe("Two-Factor Authentication Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should register GET /setup route", () => {
    const routes = twoFactorRouter.stack;
    const setupRoute = routes.find(
      (layer) =>
        layer.route?.path === "/setup" &&
        (layer.route as { methods?: { get?: boolean } })?.methods?.get,
    );
    expect(setupRoute).toBeDefined();
  });

  it("should register POST /setup route for step-up replacement", () => {
    const routes = twoFactorRouter.stack;
    const setupRoute = routes.find(
      (layer) =>
        layer.route?.path === "/setup" &&
        (layer.route as { methods?: { post?: boolean } })?.methods?.post,
    );
    expect(setupRoute).toBeDefined();
  });

  it("should register POST /enable route", () => {
    const routes = twoFactorRouter.stack;
    const enableRoute = routes.find(
      (layer) =>
        layer.route?.path === "/enable" &&
        (layer.route as { methods?: { post?: boolean } })?.methods?.post,
    );
    expect(enableRoute).toBeDefined();
  });

  it("should register POST /disable route", () => {
    const routes = twoFactorRouter.stack;
    const disableRoute = routes.find(
      (layer) =>
        layer.route?.path === "/disable" &&
        (layer.route as { methods?: { post?: boolean } })?.methods?.post,
    );
    expect(disableRoute).toBeDefined();
  });

  it("should register POST /verify route", () => {
    const routes = twoFactorRouter.stack;
    const verifyRoute = routes.find(
      (layer) =>
        layer.route?.path === "/verify" &&
        (layer.route as { methods?: { post?: boolean } })?.methods?.post,
    );
    expect(verifyRoute).toBeDefined();
  });

  it("should register POST /backup-codes/regenerate route", () => {
    const routes = twoFactorRouter.stack;
    const regenerateRoute = routes.find(
      (layer) =>
        layer.route?.path === "/backup-codes/regenerate" &&
        (layer.route as { methods?: { post?: boolean } })?.methods?.post,
    );
    expect(regenerateRoute).toBeDefined();
  });

  it("should register GET /status route", () => {
    const routes = twoFactorRouter.stack;
    const statusRoute = routes.find(
      (layer) =>
        layer.route?.path === "/status" &&
        (layer.route as { methods?: { get?: boolean } })?.methods?.get,
    );
    expect(statusRoute).toBeDefined();
  });
});
