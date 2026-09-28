import { Router } from "express";
import { requireAccessToken } from "../auth/auth.middleware.js";
import { rateLimit } from "../common/rateLimiter.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getMyVibeform, updateMyVibeformPreferences } from "./vibeforms.controller.js";

export const vibeformsRouter = Router();

vibeformsRouter.get(
  "/me",
  rateLimit("vibeforms_me_get"),
  requireAccessToken,
  asyncHandler(getMyVibeform),
);

vibeformsRouter.put(
  "/me/preferences",
  rateLimit("vibeforms_me_preferences_put"),
  requireAccessToken,
  asyncHandler(updateMyVibeformPreferences),
);
