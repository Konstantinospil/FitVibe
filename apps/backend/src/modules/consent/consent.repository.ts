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

function hashClientKey(clientIdentifier: string): string {
  return crypto.createHash("sha256").update(clientIdentifier).digest("hex");
}

function toCookieConsent(row: CookieConsentRow): CookieConsent {
  return {
    id: row.id,
    clientKey: row.client_key,
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

export async function getConsentByClient(
  clientIdentifier: string,
): Promise<CookieConsent | undefined> {
  const clientKey = hashClientKey(clientIdentifier);
  const row = await db(COOKIE_CONSENTS_TABLE)
    .select<CookieConsentRow[]>("*")
    .where("client_key", clientKey)
    .orderBy("consent_given_at", "desc")
    .first();

  return row ? toCookieConsent(row) : undefined;
}

export async function upsertConsent(
  clientIdentifier: string,
  input: CreateCookieConsentInput | UpdateCookieConsentInput,
  userId?: string | null,
  legalVersionId?: string | null,
): Promise<CookieConsent> {
  const now = new Date().toISOString();
  const isCreateInput = "consentVersion" in input && "essentialCookies" in input;
  const previous = await getConsentByClient(clientIdentifier);

  const [row] = await db(COOKIE_CONSENTS_TABLE)
    .insert({
      user_id: userId ?? null,
      client_key: hashClientKey(clientIdentifier),
      consent_version: isCreateInput
        ? input.consentVersion
        : (input.consentVersion ?? previous?.consentVersion ?? "2024-06-01"),
      legal_version_id:
        legalVersionId ??
        (isCreateInput
          ? input.legalVersionId
          : (input.legalVersionId ?? previous?.legalVersionId ?? null)),
      source: input.source ?? (userId ? "authenticated" : "banner"),
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

