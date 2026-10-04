import { Router } from "express";

import {
  listExercisesHandler,
  getExerciseHandler,
  createExerciseHandler,
  updateExerciseHandler,
  deleteExerciseHandler,
} from "./exercise.controller.js";
import { requireAccessToken } from "../auth/auth.middleware.js";
import { rateLimit } from "../common/rateLimiter.js";
import { asyncHandler } from "../../utils/async-handler.js";

export const exercisesRouter = Router();

exercisesRouter.get(
  "/",
  rateLimit("ex_list"),
  requireAccessToken,
  asyncHandler(listExercisesHandler),
);
exercisesRouter.get(
  "/:id",
  rateLimit("ex_get"),
  requireAccessToken,
  asyncHandler(getExerciseHandler),
);
exercisesRouter.post(
  "/",
  rateLimit("ex_create"),
  requireAccessToken,
  asyncHandler(createExerciseHandler),
);
exercisesRouter.put(
  "/:id",
  rateLimit("ex_update"),
  requireAccessToken,
  asyncHandler(updateExerciseHandler),
);
exercisesRouter.delete(
  "/:id",
  rateLimit("ex_delete"),
  requireAccessToken,
  asyncHandler(deleteExerciseHandler),
);
