import { db } from "../../db/index.js";
import { HttpError } from "../../utils/http.js";
import { findUserById } from "./auth.repository.js";
import { recordAuthAuditEvent } from "./auth.audit.js";
import {
  acceptLegalDocumentVersion,
  getCurrentLegalPublication,
  getCurrentLegalVersions,
  getLegalActionStatus,
  revokeLegalDocumentAcceptances,
} from "../legal/legal.service.js";

export type LegalDocumentStatus = {
  accepted: boolean;
  acceptedAt: string | null;
  acceptedVersion: string | null;
  currentVersion: string;
  requiredVersion: string | null;
  requiredAction: "none" | "acknowledge" | "accept" | "renew_consent";
  needsAcceptance: boolean;
};

export type LegalDocumentsStatus = {
  terms: LegalDocumentStatus;
  privacy: LegalDocumentStatus;
};

export async function acceptTerms(userId: string): Promise<void> {
  const now = new Date().toISOString();
  const version = await getCurrentLegalPublication("terms");

  await db.transaction(async (trx) => {
    await acceptLegalDocumentVersion(userId, version.id, "application", trx);
    await trx("users").where({ id: userId }).update({
      terms_accepted: true,
      terms_accepted_at: now,
      terms_version: version.version,
      updated_at: now,
    });
  });

  await recordAuthAuditEvent(userId, "auth.terms_accepted", {
    termsVersion: version.version,
    acceptedAt: now,
  });
}

export async function revokeTerms(userId: string): Promise<void> {
  const now = new Date().toISOString();

  await db.transaction(async (trx) => {
    await revokeLegalDocumentAcceptances(userId, "terms", now, trx);
    await trx("users").where({ id: userId }).update({
      terms_accepted: false,
      terms_accepted_at: null,
      terms_version: null,
      updated_at: now,
    });
  });

  await recordAuthAuditEvent(userId, "auth.terms_revoked", {
    revokedAt: now,
  });
}

export async function acceptPrivacyPolicy(userId: string): Promise<void> {
  const now = new Date().toISOString();
  const version = await getCurrentLegalPublication("privacy");

  await db.transaction(async (trx) => {
    await acceptLegalDocumentVersion(userId, version.id, "application", trx);
    await trx("users").where({ id: userId }).update({
      privacy_policy_accepted: true,
      privacy_policy_accepted_at: now,
      privacy_policy_version: version.version,
      updated_at: now,
    });
  });

  await recordAuthAuditEvent(userId, "auth.privacy_policy_accepted", {
    privacyPolicyVersion: version.version,
    acceptedAt: now,
  });
}

export async function revokePrivacyPolicy(userId: string): Promise<void> {
  const now = new Date().toISOString();

  await db.transaction(async (trx) => {
    await revokeLegalDocumentAcceptances(userId, "privacy", now, trx);
    await trx("users").where({ id: userId }).update({
      privacy_policy_accepted: false,
      privacy_policy_accepted_at: null,
      privacy_policy_version: null,
      updated_at: now,
    });
  });

  await recordAuthAuditEvent(userId, "auth.privacy_policy_revoked", {
    revokedAt: now,
  });
}

function toDocumentStatus(
  status: Awaited<ReturnType<typeof getLegalActionStatus>>,
): LegalDocumentStatus {
  return {
    accepted: !status.needsAction,
    acceptedAt: status.acceptedAt,
    acceptedVersion: status.acceptedVersion,
    currentVersion: status.currentVersion,
    requiredVersion: status.requiredVersion,
    requiredAction: status.requiredAction,
    needsAcceptance: status.needsAction,
  };
}

export async function getLegalDocumentsStatus(userId: string): Promise<LegalDocumentsStatus> {
  const user = await findUserById(userId);
  if (!user) {
    throw new HttpError(404, "AUTH_USER_NOT_FOUND", "AUTH_USER_NOT_FOUND");
  }

  const [terms, privacy] = await Promise.all([
    getLegalActionStatus(userId, "terms"),
    getLegalActionStatus(userId, "privacy"),
  ]);

  return {
    terms: toDocumentStatus(terms),
    privacy: toDocumentStatus(privacy),
  };
}

export async function getLegalDocumentVersions(): Promise<{
  terms: string;
  privacy: string;
  cookie: string;
}> {
  return getCurrentLegalVersions();
}
