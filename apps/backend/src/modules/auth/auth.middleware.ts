import type { NextFunction, Request, RequestHandler, Response } from "express";

import { env } from "../../config/env.js";
import { HttpError } from "../../utils/http.js";
import { isSessionActiveForUser } from "./auth.state.repository.js";
import { verifyAccess } from "./auth.session-tokens.js";

function bearerToken(header?: string | null): string | null {
  if (!header) {
    return null;
  }
  const [scheme, value] = header.split(" ");
  if (!value || scheme.toLowerCase() !== "bearer") {
    return null;
  }
  return value;
}

export async function authenticateAccessToken(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token =
    (req.cookies?.[env.ACCESS_COOKIE_NAME] as string | undefined) ??
    bearerToken(req.headers.authorization ?? null);
  if (!token) {
    next(new HttpError(401, "UNAUTHENTICATED", "Access token required"));
    return;
  }

  try {
    const payload = verifyAccess(token);
    if (!payload.sid || !(await isSessionActiveForUser(payload.sid, payload.sub))) {
      next(new HttpError(401, "UNAUTHENTICATED", "Session revoked or expired"));
      return;
    }
    req.user = payload;
    next();
  } catch {
    next(new HttpError(401, "UNAUTHENTICATED", "Invalid or expired access token"));
  }
}

export const requireAccessToken: RequestHandler = (req, res, next): void => {
  void authenticateAccessToken(req, res, next);
};
