/** Cookie consent is scoped to a first-party, HTTP-only browser identifier. */
import { randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { env } from "../../config/env.js";
import { getConsentStatus, saveCookiePreferences } from "./consent.service.js";
import { SaveCookiePreferencesSchema } from "./consent.schemas.js";

const CONSENT_COOKIE_NAME = "fitvibe_consent_client";
const CLIENT_ID_PATTERN = /^[a-f0-9]{64}$/;
const CONSENT_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

function getBrowserIdentifier(req: Request): string | null {
  const entry = req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CONSENT_COOKIE_NAME}=`));
  const value = entry?.slice(CONSENT_COOKIE_NAME.length + 1);
  return value && CLIENT_ID_PATTERN.test(value) ? value : null;
}

export async function getCookieStatusHandler(req: Request, res: Response): Promise<void> {
  const browserId = getBrowserIdentifier(req);
  res.json({
    success: true,
    data: browserId ? await getConsentStatus(browserId) : { hasConsent: false },
  });
}

export async function saveCookiePreferencesHandler(req: Request, res: Response): Promise<void> {
  const choice = SaveCookiePreferencesSchema.parse(req.body);
  const browserId = getBrowserIdentifier(req) ?? randomBytes(32).toString("hex");
  const consent = await saveCookiePreferences(
    browserId,
    choice,
    req.headers["user-agent"] ?? null,
    choice.source ?? "banner",
  );

  res.cookie(CONSENT_COOKIE_NAME, browserId, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.COOKIE_SECURE === "true" || req.secure,
    path: "/api/v1/consent",
    maxAge: CONSENT_COOKIE_MAX_AGE_MS,
  });
  res.json({
    success: true,
    data: {
      essential: consent.essentialCookies,
      preferences: consent.preferencesCookies,
      analytics: consent.analyticsCookies,
      marketing: consent.marketingCookies,
      version: consent.consentVersion,
      updatedAt: consent.lastUpdatedAt,
    },
  });
}
