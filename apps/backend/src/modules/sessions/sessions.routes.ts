import { Router } from "express";

import {
  listSessionsHandler,
  getSessionHandler,
  createSessionHandler,
  updateSessionHandler,
  deleteSessionHandler,
  reopenSessionHandler,
  cloneSessionHandler,
  applyRecurrenceHandler,
  getSessionEstimateHandler,
} from "./sessions.controller.js";
import { requireAccessToken } from "../auth/auth.middleware.js";
import { rateLimit } from "../common/rateLimiter.js";
import { asyncHandler } from "../../utils/async-handler.js";

export const sessionsRouter = Router();

sessionsRouter.get(
  "/",
  rateLimit("sessions_list"),
  requireAccessToken,
  asyncHandler(listSessionsHandler),
);
sessionsRouter.get(
  "/:id",
  rateLimit("sessions_get"),
  requireAccessToken,
  asyncHandler(getSessionHandler),
);
sessionsRouter.post(
  "/",
  rateLimit("sessions_create"),
  requireAccessToken,
  asyncHandler(createSessionHandler),
);
sessionsRouter.patch(
  "/:id",
  rateLimit("sessions_update"),
  requireAccessToken,
  asyncHandler(updateSessionHandler),
);
sessionsRouter.get(
  "/:id/estimate",
  rateLimit("sessions_estimate"),
  requireAccessToken,
  asyncHandler(getSessionEstimateHandler),
);
sessionsRouter.post(
  "/:id/reopen",
  rateLimit("sessions_reopen"),
  requireAccessToken,
  asyncHandler(reopenSessionHandler),
);
sessionsRouter.post(
  "/:id/clone",
  rateLimit("sessions_clone"),
  requireAccessToken,
  asyncHandler(cloneSessionHandler),
);
sessionsRouter.post(
  "/:id/recurrence",
  rateLimit("sessions_recurrence"),
  requireAccessToken,
  asyncHandler(applyRecurrenceHandler),
);
sessionsRouter.delete(
  "/:id",
  rateLimit("sessions_delete"),
  requireAccessToken,
  asyncHandler(deleteSessionHandler),
);
