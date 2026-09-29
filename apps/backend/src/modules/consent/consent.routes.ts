import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { rateLimit } from "../common/rateLimiter.js";
import { getCookieStatusHandler, saveCookiePreferencesHandler } from "./consent.controller.js";
import { validate } from "../../utils/validation.js";
import { SaveCookiePreferencesSchema } from "./consent.schemas.js";

export const consentRouter = Router();

// Public endpoints - no authentication required
// GET /api/v1/consent/cookie-status - Get consent status for IP
consentRouter.get(
  "/cookie-status",
  rateLimit("consent_status"), // 60 requests per minute
  asyncHandler(getCookieStatusHandler),
);

// POST /api/v1/consent/cookie-preferences - Save cookie preferences
consentRouter.post(
  "/cookie-preferences",
  rateLimit("consent_save"), // 10 requests per minute (to prevent abuse)
  validate(SaveCookiePreferencesSchema),
  asyncHandler(saveCookiePreferencesHandler),
);
