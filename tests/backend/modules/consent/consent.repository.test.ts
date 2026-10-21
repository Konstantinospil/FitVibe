import crypto from "node:crypto";
import * as consentRepository from "../../../../apps/backend/src/modules/consent/consent.repository.js";

const queryBuilders: Record<string, any> = {};

function hashClientKey(ipAddress: string): string {
  return crypto.createHash("sha256").update(ipAddress).digest("hex");
}

function createMockQueryBuilder(defaultValue: unknown = []) {
  const builder = Object.assign(Promise.resolve(defaultValue), {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockReturnThis(),
    onConflict: jest.fn().mockReturnThis(),
    merge: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([]),
  });
  return builder;
}

jest.mock("../../../../apps/backend/src/db/connection.js", () => {
  const mockDbFunction = jest.fn((table: string) => {
    if (!queryBuilders[table]) {
      queryBuilders[table] = createMockQueryBuilder();
    }
    return queryBuilders[table];
  });

  return {
    db: mockDbFunction,
  };
});

describe("Consent Repository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(queryBuilders).forEach((key) => delete queryBuilders[key]);
  });

  describe("getConsentByClient", () => {
    it("returns mapped consent when row exists", async () => {
      const clientKey = hashClientKey("203.0.113.1");
      const row = {
        id: "consent-1",
        user_id: null,
        client_key: clientKey,
        consent_version: "2024-06-01",
        source: "banner",
        essential_cookies: true,
        preferences_cookies: false,
        analytics_cookies: true,
        marketing_cookies: false,
        consent_given_at: "2024-06-10T10:00:00.000Z",
        user_agent: "UA",
        created_at: "2024-06-10T10:00:00.000Z",
      };

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("cookie_consents");
      queryBuilders.cookie_consents.first.mockResolvedValue(row);

      const result = await consentRepository.getConsentByClient("203.0.113.1");

      expect(result).toEqual({
        id: "consent-1",
        clientKey: clientKey,
        consentVersion: "2024-06-01",
        legalVersionId: null,
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
    });
  });

  describe("upsertConsent", () => {
    it("inserts and merges consent data", async () => {
      const clientKey = hashClientKey("203.0.113.2");
      const row = {
        id: "consent-2",
        user_id: null,
        client_key: clientKey,
        consent_version: "2024-06-01",
        source: "banner",
        essential_cookies: true,
        preferences_cookies: true,
        analytics_cookies: false,
        marketing_cookies: true,
        consent_given_at: "2024-06-10T10:00:00.000Z",
        user_agent: "UA",
        created_at: "2024-06-10T10:00:00.000Z",
      };

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("cookie_consents");
      queryBuilders.cookie_consents.first.mockResolvedValue(null);
      queryBuilders.cookie_consents.returning.mockResolvedValue([row]);

      const result = await consentRepository.upsertConsent("203.0.113.2", {
        consentVersion: "2024-06-01",
        essentialCookies: true,
        preferencesCookies: true,
        analyticsCookies: false,
        marketingCookies: true,
        userAgent: "UA",
      });

      expect(queryBuilders.cookie_consents.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          client_key: clientKey,
          consent_version: "2024-06-01",
          essential_cookies: true,
          preferences_cookies: true,
          analytics_cookies: false,
          marketing_cookies: true,
          user_agent: "UA",
          source: "banner",
        }),
      );
      expect(result.id).toBe("consent-2");
    });
  });
});
