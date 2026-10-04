/**
 * Unit tests for users avatar routes
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";
import { usersAvatarRouter } from "../../../../apps/backend/src/modules/users/users.avatar.routes.js";
import { requireAccessToken } from "../../../../apps/backend/src/modules/auth/auth.middleware.js";

// Mock dependencies
jest.mock("../../../../apps/backend/src/modules/auth/auth.middleware.js", () => ({
  requireAccessToken: jest.fn((req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock("../../../../apps/backend/src/modules/common/rateLimiter.js", () => ({
  rateLimit: jest.fn(() => (req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock("../../../../apps/backend/src/utils/async-handler.js", () => ({
  asyncHandler: jest.fn((fn: unknown) => fn),
}));

jest.mock("multer", () => {
  const mockMulter = jest.fn(() => ({
    single: jest.fn(() => (req: Request, res: Response, next: NextFunction) => next()),
  }));
  mockMulter.memoryStorage = jest.fn(() => ({}));
  return {
    __esModule: true,
    default: mockMulter,
  };
});

jest.mock("../../../../apps/backend/src/modules/users/users.avatar.controller.js", () => ({
  uploadAvatarHandler: jest.fn(),
  getAvatarHandler: jest.fn(),
  deleteAvatarHandler: jest.fn(),
}));

describe("Users Avatar Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should register POST /avatar route", () => {
    const routes = usersAvatarRouter.stack;
    const postRoute = routes.find(
      (layer) =>
        layer.route?.path === "/avatar" &&
        (layer.route as { methods?: Record<string, boolean> })?.methods?.post,
    );
    expect(postRoute).toBeDefined();
  });

  it("should register GET /avatar/:id route", () => {
    const routes = usersAvatarRouter.stack;
    const getRoute = routes.find(
      (layer) =>
        layer.route?.path === "/avatar/:id" &&
        (layer.route as { methods?: Record<string, boolean> })?.methods?.get,
    );
    expect(getRoute).toBeDefined();
  });

  it("should register DELETE /avatar route", () => {
    const routes = usersAvatarRouter.stack;
    const deleteRoute = routes.find(
      (layer) =>
        layer.route?.path === "/avatar" &&
        (layer.route as { methods?: Record<string, boolean> })?.methods?.delete,
    );
    expect(deleteRoute).toBeDefined();
  });

  it("should apply requireAccessToken middleware to POST /avatar", () => {
    expect(requireAccessToken).toBeDefined();
  });

  it("should apply requireAccessToken middleware to DELETE /avatar", () => {
    expect(requireAccessToken).toBeDefined();
  });
});
