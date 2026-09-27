import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { requireAccessToken } from "../auth/auth.middleware.js";
import { requireRole } from "../common/rbac.middleware.js";
import { rateLimit } from "../common/rateLimiter.js";
import {
  listPrivilegedAdminsHandler,
  privilegedRoleChangeHandler,
  sudoReauthHandler,
} from "./superadmin.controller.js";

export const superadminRouter = Router();

superadminRouter.use(requireAccessToken);
superadminRouter.use(requireRole("superadmin"));

superadminRouter.get(
  "/privileges/admins",
  rateLimit("superadmin_privileges_list", 30, 60),
  asyncHandler(listPrivilegedAdminsHandler),
);

superadminRouter.post(
  "/sudo",
  rateLimit("superadmin_sudo", 10, 60),
  asyncHandler(sudoReauthHandler),
);

superadminRouter.post(
  "/privileges/admins/:userId/role",
  rateLimit("superadmin_role_change", 10, 60),
  asyncHandler(privilegedRoleChangeHandler),
);
