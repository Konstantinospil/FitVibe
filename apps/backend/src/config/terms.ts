/**
 * Legacy Terms version fixture.
 *
 * Phase 17 moved runtime legal-version authority to persisted
 * legal_document_versions publications. This file remains only for older
 * tests/fixtures that need the pre-Phase-17 baseline identifier.
 *
 * Production code must use modules/legal/legal.service.ts instead.
 */
export const CURRENT_TERMS_VERSION = "2024-06-01";

/** @deprecated Runtime code must use getCurrentLegalPublication("terms"). */
export function getCurrentTermsVersion(): string {
  return CURRENT_TERMS_VERSION;
}

/** @deprecated Runtime code must use getLegalActionStatus(). */
export function isTermsVersionOutdated(userVersion: string | null | undefined): boolean {
  if (!userVersion) {
    return true;
  }
  return userVersion !== CURRENT_TERMS_VERSION;
}
