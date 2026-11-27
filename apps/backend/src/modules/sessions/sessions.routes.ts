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
  pauseSessionHandler,
  resumeSessionHandler,
  recordSetHandler,
  addSetHandler,
  addExerciseHandler,
  skipExerciseHandler,
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

// Live workout execution (ADR-043): frequent small commands during a workout.
const execution = [rateLimit("sessions_execution"), requireAccessToken] as const;
sessionsRouter.post("/:id/pause", ...execution, asyncHandler(pauseSessionHandler));
sessionsRouter.post("/:id/resume", ...execution, asyncHandler(resumeSessionHandler));
sessionsRouter.patch("/:id/sets/:setId", ...execution, asyncHandler(recordSetHandler));
sessionsRouter.post("/:id/exercises", ...execution, asyncHandler(addExerciseHandler));
sessionsRouter.post("/:id/exercises/:exerciseId/sets", ...execution, asyncHandler(addSetHandler));
sessionsRouter.post(
  "/:id/exercises/:exerciseId/skip",
  ...execution,
  asyncHandler(skipExerciseHandler),
);
