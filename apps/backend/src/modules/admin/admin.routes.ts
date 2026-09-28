/**
 * Admin routes - Routes for admin-only operations
 */

import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { requireAccessToken } from "../auth/auth.middleware.js";
import { requireRole } from "../common/rbac.middleware.js";
import { rateLimit } from "../common/rateLimiter.js";
import { superadminRouter } from "./superadmin.routes.js";
import {
  listReportsHandler,
  moderateReportHandler,
  searchUsersHandler,
  userActionHandler,
} from "./admin.controller.js";

export const adminRouter = Router();

adminRouter.use(requireAccessToken);
adminRouter.use(requireRole("admin"));

// Superadmin inherits normal admin capabilities; privileged operations remain separately gated.
adminRouter.use("/superadmin", superadminRouter);

adminRouter.get(
  "/reports",
  rateLimit("admin_reports_list"),
  asyncHandler(listReportsHandler),
);

adminRouter.post(
  "/reports/:reportId/moderate",
  rateLimit("admin_reports_moderate"),
  asyncHandler(moderateReportHandler),
);

adminRouter.get(
  "/users/search",
  rateLimit("admin_users_search"),
  asyncHandler(searchUsersHandler),
);

adminRouter.post(
  "/users/:userId/action",
  rateLimit("admin_users_action"),
  asyncHandler(userActionHandler),
);

adminRouter.post(
  "/users/:userId/suspend",
  rateLimit("admin_users_suspend"),
  asyncHandler((req, res) => {
    req.body = { ...(req.body as object), action: "suspend" };
    return userActionHandler(req, res);
  }),
);

adminRouter.post(
  "/users/:userId/ban",
  rateLimit("admin_users_ban"),
  asyncHandler((req, res) => {
    req.body = { ...(req.body as object), action: "ban" };
    return userActionHandler(req, res);
  }),
);

adminRouter.post(
  "/users/:userId/activate",
  rateLimit("admin_users_activate"),
  asyncHandler((req, res) => {
    req.body = { ...(req.body as object), action: "activate" };
    return userActionHandler(req, res);
  }),
);

adminRouter.delete(
  "/users/:userId",
  rateLimit("admin_users_delete"),
  asyncHandler((req, res) => {
    req.body = { ...(req.body as object), action: "delete" };
    return userActionHandler(req, res);
  }),
);
