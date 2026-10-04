import { Router } from "express";
import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { checkQueueHealth, getQueueAdapter } from "../../jobs/services/queue.factory.js";

export const healthRouter = Router();

healthRouter.get(
  "/",
  asyncHandler(async (_req: Request, res: Response) => {
    const queueHealthy = await checkQueueHealth();
    const status = queueHealthy ? "ok" : "unhealthy";
    res.status(queueHealthy ? 200 : 503).json({
      status,
      timestamp: new Date().toISOString(),
      queue: {
        adapter: getQueueAdapter(),
        healthy: queueHealthy,
      },
    });
  }),
);

export default healthRouter;
