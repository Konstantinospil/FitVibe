import { Router } from "express";

import { requireAccessToken } from "../auth/auth.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  getPointsHistoryHandler,
  getPointsSummaryHandler,
  getBadgeCatalogHandler,
  getUserBadgesHandler,
} from "./points.controller.js";
import { rateLimit } from "../common/rateLimiter.js";

export const pointsRouter = Router();

pointsRouter.get("/", requireAccessToken, asyncHandler(getPointsSummaryHandler));
pointsRouter.get("/history", requireAccessToken, asyncHandler(getPointsHistoryHandler));
pointsRouter.get("/badges/earned", requireAccessToken, asyncHandler(getUserBadgesHandler));
pointsRouter.get("/badges", rateLimit("badges_catalog"), asyncHandler(getBadgeCatalogHandler));
