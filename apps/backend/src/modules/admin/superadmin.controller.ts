import type { Request, Response } from "express";
import { HttpError } from "../../utils/http.js";
import { beginSudo, changePrivilegedRole, listPrivilegedAdmins } from "./superadmin.service.js";

export async function listPrivilegedAdminsHandler(_req: Request, res: Response): Promise<void> {
  res.json({ users: await listPrivilegedAdmins() });
}

export async function sudoReauthHandler(req: Request, res: Response): Promise<void> {
  if (!req.user?.sub || !req.user.sid) {
    throw new HttpError(401, "UNAUTHENTICATED", "User not authenticated");
  }
  const password = (req.body as { password?: string }).password;
  if (!password) {
    throw new HttpError(400, "PASSWORD_REQUIRED", "Password is required");
  }

  const result = await beginSudo(req.user.sub, req.user.sid, password, req.requestId ?? null);
  res.json(result);
}

export async function privilegedRoleChangeHandler(req: Request, res: Response): Promise<void> {
  if (!req.user?.sub || !req.user.sid) {
    throw new HttpError(401, "UNAUTHENTICATED", "User not authenticated");
  }

  const { userId } = req.params;
  const body = req.body as {
    role?: "admin" | "superadmin";
    reason?: string;
    totpCode?: string;
  };

  if (!body.role || !["admin", "superadmin"].includes(body.role)) {
    throw new HttpError(400, "INVALID_ROLE", "Role must be admin or superadmin");
  }
  if (!body.totpCode) {
    throw new HttpError(400, "TOTP_REQUIRED", "Fresh authenticator TOTP is required");
  }

  await changePrivilegedRole({
    actorUserId: req.user.sub,
    actorSessionJti: req.user.sid,
    targetUserId: userId,
    newRole: body.role,
    reason: body.reason ?? "",
    totpCode: body.totpCode,
    requestId: req.requestId ?? null,
  });

  res.json({ success: true });
}
