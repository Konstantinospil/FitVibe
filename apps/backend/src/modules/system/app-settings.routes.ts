import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { HttpError, readRouteParam } from "../../utils/http.js";
import { requireAccessToken } from "../auth/auth.middleware.js";
import { requireRole } from "../common/rbac.middleware.js";
import {
  commitSettingsRevision,
  disableMaintenance,
  enableMaintenance,
  getSettingsStatus,
  stageSettingsRevision,
} from "./app-settings.service.js";

export const appSettingsRouter = Router();

appSettingsRouter.use(requireAccessToken);
appSettingsRouter.use(requireRole("superadmin"));

appSettingsRouter.get(
  "/status",
  asyncHandler(async (_req, res) => {
    res.json(await getSettingsStatus());
  }),
);

appSettingsRouter.post(
  "/maintenance/enable",
  asyncHandler(async (req, res) => {
    if (!req.user?.sub || !req.user.sid) {
      throw new HttpError(401, "UNAUTHENTICATED", "User not authenticated");
    }
    const reason = (req.body as { reason?: string }).reason ?? "";
    await enableMaintenance(req.user.sub, req.user.sid, reason);
    res.json({ success: true });
  }),
);

appSettingsRouter.post(
  "/maintenance/disable",
  asyncHandler(async (req, res) => {
    if (!req.user?.sub || !req.user.sid) {
      throw new HttpError(401, "UNAUTHENTICATED", "User not authenticated");
    }
    await disableMaintenance(req.user.sub, req.user.sid);
    res.json({ success: true });
  }),
);

appSettingsRouter.post(
  "/revisions/stage",
  asyncHandler(async (req, res) => {
    if (!req.user?.sub || !req.user.sid) {
      throw new HttpError(401, "UNAUTHENTICATED", "User not authenticated");
    }
    const body = req.body as { reason?: string; changes?: Record<string, unknown> };
    const revision = await stageSettingsRevision({
      actorUserId: req.user.sub,
      actorSessionJti: req.user.sid,
      reason: body.reason ?? "",
      changes: body.changes ?? {},
    });
    res.status(201).json(revision);
  }),
);

appSettingsRouter.post(
  "/revisions/:revisionId/commit",
  asyncHandler(async (req, res) => {
    if (!req.user?.sub || !req.user.sid) {
      throw new HttpError(401, "UNAUTHENTICATED", "User not authenticated");
    }
    const body = req.body as { totpCode?: string };
    if (!body.totpCode) {
      throw new HttpError(400, "TOTP_REQUIRED", "Fresh authenticator TOTP is required");
    }

    const result = await commitSettingsRevision({
      actorUserId: req.user.sub,
      actorSessionJti: req.user.sid,
      revisionId: readRouteParam(req.params.revisionId, "revisionId"),
      totpCode: body.totpCode,
      requestId: req.requestId ?? null,
    });
    res.json(result);
  }),
);
