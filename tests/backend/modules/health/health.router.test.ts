/**
 * Unit tests for health router
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { Request, Response } from "express";
import { healthRouter } from "../../../../apps/backend/src/modules/health/health.router.js";
import * as queueFactory from "../../../../apps/backend/src/jobs/services/queue.factory.js";

jest.mock("../../../../apps/backend/src/jobs/services/queue.factory.js");

const mockedQueueFactory = jest.mocked(queueFactory);
const flushAsync = () => new Promise((resolve) => setImmediate(resolve));

describe("Health Router", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockRes = {
      json: jsonMock,
      status: statusMock,
    };

    mockReq = {};
    mockedQueueFactory.checkQueueHealth.mockResolvedValue(true);
    mockedQueueFactory.getQueueAdapter.mockReturnValue("memory");
  });

  describe("GET /", () => {
    it("should return health status", async () => {
      const routes = healthRouter.stack;
      expect(routes.length).toBeGreaterThan(0);

      // Find the GET / route
      const healthRoute = routes.find(
        (layer) =>
          layer.route?.path === "/" &&
          (layer.route as { methods?: { get?: boolean } })?.methods?.get,
      );
      expect(healthRoute).toBeDefined();

      if (healthRoute?.route) {
        const handler = healthRoute.route.stack[0]?.handle;
        expect(handler).toBeDefined();

        // Call the handler
        handler(mockReq as Request, mockRes as Response, jest.fn());
        await flushAsync();

        // Verify response
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            status: "ok",
            timestamp: expect.any(String),
            queue: { adapter: "memory", healthy: true },
          }),
        );
      }
    });

    it("should return ISO timestamp", async () => {
      const routes = healthRouter.stack;
      const healthRoute = routes.find(
        (layer) =>
          layer.route?.path === "/" &&
          (layer.route as { methods?: { get?: boolean } })?.methods?.get,
      );

      if (healthRoute?.route) {
        const handler = healthRoute.route.stack[0]?.handle;
        handler(mockReq as Request, mockRes as Response, jest.fn());
        await flushAsync();

        const callArgs = jsonMock.mock.calls[0][0];
        expect(callArgs.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
    });
    it("returns 503 when the durable queue is unhealthy", async () => {
      mockedQueueFactory.checkQueueHealth.mockResolvedValue(false);
      mockedQueueFactory.getQueueAdapter.mockReturnValue("bullmq");

      const healthRoute = healthRouter.stack.find(
        (layer) =>
          layer.route?.path === "/" &&
          (layer.route as { methods?: { get?: boolean } })?.methods?.get,
      );
      const handler = healthRoute?.route?.stack[0]?.handle;
      expect(handler).toBeDefined();

      handler?.(mockReq as Request, mockRes as Response, jest.fn());
      await flushAsync();

      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "unhealthy",
          queue: { adapter: "bullmq", healthy: false },
        }),
      );
    });
  });
});
