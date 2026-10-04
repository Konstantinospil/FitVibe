import { HttpError } from "../../../../apps/backend/src/utils/http.js";
import * as consentService from "../../../../apps/backend/src/modules/consent/consent.service.js";
import * as consentRepository from "../../../../apps/backend/src/modules/consent/consent.repository.js";
import { insertAudit } from "../../../../apps/backend/src/modules/common/audit.util.js";
import {
  getCurrentLegalPublication,
  legalVersionSatisfiesCurrentRequirement,
} from "../../../../apps/backend/src/modules/legal/legal.service.js";

jest.mock("../../../../apps/backend/src/modules/consent/consent.repository.js");
jest.mock("../../../../apps/backend/src/modules/common/audit.util.js", () => ({
  insertAudit: jest.fn(),
}));
jest.mock("../../../../apps/backend/src/modules/legal/legal.service.js", () => ({
  getCurrentLegalPublication: jest.fn(),
  legalVersionSatisfiesCurrentRequirement: jest.fn(),
}));

const mockRepository = jest.mocked(consentRepository);
const mockInsertAudit = jest.mocked(insertAudit);
const mockGetCurrentLegalPublication = jest.mocked(getCurrentLegalPublication);
const mockLegalVersionSatisfiesCurrentRequirement = jest.mocked(
  legalVersionSatisfiesCurrentRequirement,
);

describe("Consent Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLegalVersionSatisfiesCurrentRequirement.mockResolvedValue(true);
  });

  describe("getConsentStatus", () => {
    it("returns hasConsent false when no consent record exists", async () => {
      mockRepository.getConsentByIp.mockResolvedValue(undefined);

      const result = await consentService.getConsentStatus("203.0.113.1");

      expect(result).toEqual({ hasConsent: false });
    });

    it("maps consent fields when record exists", async () => {
      mockRepository.getConsentByIp.mockResolvedValue({
        id: "consent-1",
        ipAddress: "203.0.113.2",
        consentVersion: "2024-06-01",
        legalVersionId: "legal-cookie-1",
        essentialCookies: true,
        preferencesCookies: false,
        analyticsCookies: true,
        marketingCookies: false,
        consentGivenAt: "2024-06-10T10:00:00.000Z",
        lastUpdatedAt: "2024-06-10T10:00:00.000Z",
        userAgent: "UA",
        createdAt: "2024-06-10T10:00:00.000Z",
        updatedAt: "2024-06-10T10:00:00.000Z",
      });

      const result = await consentService.getConsentStatus("203.0.113.2");

      expect(mockLegalVersionSatisfiesCurrentRequirement).toHaveBeenCalledWith(
        "cookie",
        "legal-cookie-1",
      );

      expect(result).toEqual({
        hasConsent: true,
        consent: {
          essential: true,
          preferences: false,
          analytics: true,
          marketing: false,
          version: "2024-06-01",
          updatedAt: "2024-06-10T10:00:00.000Z",
        },
      });
    });
  });

  describe("saveCookiePreferences", () => {
    it("rejects when essential cookies are disabled", async () => {
      await expect(
        consentService.saveCookiePreferences("203.0.113.10", {
          essential: false,
          preferences: false,
          analytics: false,
          marketing: false,
        }),
      ).rejects.toBeInstanceOf(HttpError);

      expect(mockRepository.upsertConsent).not.toHaveBeenCalled();
    });

    it("persists consent and writes audit log", async () => {
      mockGetCurrentLegalPublication.mockResolvedValue({
        id: "legal-cookie-1",
        document_type: "cookie",
        version: "2024-06-01",
        change_class: "legacy",
        user_action: "renew_consent",
        effective_at: "2024-06-01T00:00:00.000Z",
        published_at: "2024-06-01T00:00:00.000Z",
        published_by: null,
        source: "legacy_migration",
        created_at: "2024-06-01T00:00:00.000Z",
      });
      mockRepository.upsertConsent.mockResolvedValue({
        id: "consent-2",
        ipAddress: "203.0.113.11",
        consentVersion: "2024-06-01",
        legalVersionId: "legal-cookie-1",
        essentialCookies: true,
        preferencesCookies: true,
        analyticsCookies: false,
        marketingCookies: true,
        consentGivenAt: "2024-06-10T10:00:00.000Z",
        lastUpdatedAt: "2024-06-10T10:00:00.000Z",
        userAgent: "UA",
        createdAt: "2024-06-10T10:00:00.000Z",
        updatedAt: "2024-06-10T10:00:00.000Z",
      });

      const result = await consentService.saveCookiePreferences(
        "203.0.113.11",
        {
          essential: true,
          preferences: true,
          analytics: false,
          marketing: true,
        },
        "UA",
      );

      expect(result.id).toBe("consent-2");
      expect(mockRepository.upsertConsent).toHaveBeenCalledWith(
        "203.0.113.11",
        expect.objectContaining({
          consentVersion: "2024-06-01",
          legalVersionId: "legal-cookie-1",
          essentialCookies: true,
          preferencesCookies: true,
          analyticsCookies: false,
          marketingCookies: true,
          userAgent: "UA",
        }),
        null,
        "legal-cookie-1",
      );
      expect(mockInsertAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "cookie_consent",
          action: "consent_updated",
          entityId: "consent-2",
          outcome: "success",
          metadata: expect.objectContaining({
            preferences: {
              essential: true,
              preferences: true,
              analytics: false,
              marketing: true,
            },
            version: "2024-06-01",
          }),
        }),
      );
    });
  });
});
