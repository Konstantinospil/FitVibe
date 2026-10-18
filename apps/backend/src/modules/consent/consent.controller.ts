/** Cookie consent is scoped to a first-party, HTTP-only browser identifier. */
import { randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { getConsentStatus, saveCookiePreferences } from "./consent.service.js";
import { SaveCookiePreferencesSchema } from "./consent.schemas.js";

const NAME = "fitvibe_consent_client";
const CLIENT_RE = /^[a-f0-9]{64}$/;
function clientId(req: Request): string | null {
  const entry = req.headers.cookie?.split(";").map(part => part.trim()).find(part => part.startsWith(`${NAME}=`));
  const value = entry?.slice(NAME.length + 1);
  return value && CLIENT_RE.test(value) ? value : null;
}
export async function getCookieStatusHandler(req: Request, res: Response): Promise<void> {
  const client = clientId(req);
  res.json({ success: true, data: client ? await getConsentStatus(client) : { hasConsent: false } });
}
export async function saveCookiePreferencesHandler(req: Request, res: Response): Promise<void> {
  const choice = SaveCookiePreferencesSchema.parse(req.body);
  const client = clientId(req) ?? randomBytes(32).toString("hex");
  const consent = await saveCookiePreferences(client, choice, req.headers["user-agent"] ?? null);
  res.cookie(NAME, client, {
    httpOnly: true, sameSite: "lax", secure: req.secure,
    path: "/api/v1/consent", maxAge: 365 * 24 * 60 * 60 * 1000,
  });
  res.json({
    success: true,
    data: {
      essential: consent.essentialCookies, preferences: consent.preferencesCookies,
      analytics: consent.analyticsCookies, marketing: consent.marketingCookies,
      version: consent.consentVersion, updatedAt: consent.lastUpdatedAt,
    },
  });
}
