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
  getSessionVibeChangesHandler,
  pauseSessionHandler,
  resumeSessionHandler,
  recordSetHandler,
  addSetHandler,
  addExerciseHandler,
  skipExerciseHandler,
  uploadSessionPhotoHandler,
  getSessionPhotoHandler,
  deleteSessionPhotoHandler,
  addIntakeEntryHandler,
  deleteIntakeEntryHandler,
} from "./sessions.controller.js";
import { singleImageUpload } from "../../services/imageUpload.service.js";
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
sessionsRouter.get(
  "/:id/vibe-changes",
  rateLimit("sessions_get"),
  requireAccessToken,
  asyncHandler(getSessionVibeChangesHandler),
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

// Workout photo (ADR-044): one per completed session, read by its owner only.
sessionsRouter.post(
  "/:id/photo",
  rateLimit("sessions_photo_upload"),
  requireAccessToken,
  singleImageUpload("photo"),
  asyncHandler(uploadSessionPhotoHandler),
);
sessionsRouter.get(
  "/:id/photo/:photoId",
  rateLimit("sessions_photo_get"),
  requireAccessToken,
  asyncHandler(getSessionPhotoHandler),
);
sessionsRouter.delete(
  "/:id/photo",
  rateLimit("sessions_photo_delete"),
  requireAccessToken,
  asyncHandler(deleteSessionPhotoHandler),
);

// Workout intake (ADR-045): water and food energy, owner only.
sessionsRouter.post(
  "/:id/intake",
  rateLimit("sessions_intake"),
  requireAccessToken,
  asyncHandler(addIntakeEntryHandler),
);
sessionsRouter.delete(
  "/:id/intake/:entryId",
  rateLimit("sessions_intake"),
  requireAccessToken,
  asyncHandler(deleteIntakeEntryHandler),
);
