/**
 * Consent repository - Database operations for cookie consents
 */

import crypto from "node:crypto";
import { db } from "../../db/connection.js";
import type {
  CookieConsent,
  CookieConsentRow,
  CreateCookieConsentInput,
  UpdateCookieConsentInput,
} from "./consent.types.js";

const COOKIE_CONSENTS_TABLE = "cookie_consents";

function hashClientKey(ipAddress: string): string {
  return crypto.createHash("sha256").update(ipAddress).digest("hex");
}

function toCookieConsent(row: CookieConsentRow): CookieConsent {
  return {
    id: row.id,
    ipAddress: row.client_key,
    consentVersion: row.consent_version,
    legalVersionId: row.legal_version_id,
    essentialCookies: row.essential_cookies,
    preferencesCookies: row.preferences_cookies,
    analyticsCookies: row.analytics_cookies,
    marketingCookies: row.marketing_cookies,
    consentGivenAt: row.consent_given_at,
    lastUpdatedAt: row.consent_given_at,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };
}

export async function getConsentByIp(ipAddress: string): Promise<CookieConsent | undefined> {
  const clientKey = hashClientKey(ipAddress);
  const row = await db(COOKIE_CONSENTS_TABLE)
    .select<CookieConsentRow[]>("*")
    .where("client_key", clientKey)
    .orderBy("consent_given_at", "desc")
    .first();

  return row ? toCookieConsent(row) : undefined;
}

export async function upsertConsent(
  ipAddress: string,
  input: CreateCookieConsentInput | UpdateCookieConsentInput,
  userId?: string | null,
  legalVersionId?: string | null,
): Promise<CookieConsent> {
  const now = new Date().toISOString();
  const isCreateInput = "consentVersion" in input && "essentialCookies" in input;
  const previous = await getConsentByIp(ipAddress);

  const [row] = await db(COOKIE_CONSENTS_TABLE)
    .insert({
      user_id: userId ?? null,
      client_key: hashClientKey(ipAddress),
      consent_version: isCreateInput
        ? input.consentVersion
        : (input.consentVersion ?? previous?.consentVersion ?? "2024-06-01"),
      legal_version_id:
        legalVersionId ??
        (isCreateInput
          ? input.legalVersionId
          : (input.legalVersionId ?? previous?.legalVersionId ?? null)),
      source: userId ? "authenticated" : "banner",
      essential_cookies: isCreateInput
        ? input.essentialCookies
        : (input.essentialCookies ?? previous?.essentialCookies ?? true),
      preferences_cookies: isCreateInput
        ? input.preferencesCookies
        : (input.preferencesCookies ?? previous?.preferencesCookies ?? false),
      analytics_cookies: isCreateInput
        ? input.analyticsCookies
        : (input.analyticsCookies ?? previous?.analyticsCookies ?? false),
      marketing_cookies: isCreateInput
        ? input.marketingCookies
        : (input.marketingCookies ?? previous?.marketingCookies ?? false),
      user_agent: input.userAgent ?? previous?.userAgent ?? null,
      consent_given_at: now,
      created_at: now,
    })
    .returning<CookieConsentRow[]>("*");

  return toCookieConsent(row);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function attachAnonymousConsents(userId: string, ipAddress: string): Promise<number> {
  if (!ipAddress || ipAddress === "unknown") {
    return 0;
  }
  // cookie_consents.user_id is uuid; skip placeholders like "user-123"
  if (!UUID_RE.test(userId)) {
    return 0;
  }
  return db(COOKIE_CONSENTS_TABLE)
    .where({ client_key: hashClientKey(ipAddress) })
    .whereNull("user_id")
    .update({ user_id: userId });
}
