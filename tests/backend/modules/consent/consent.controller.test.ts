import type { Request, Response } from "express";
import * as controller from "../../../../apps/backend/src/modules/consent/consent.controller.js";
import * as service from "../../../../apps/backend/src/modules/consent/consent.service.js";
jest.mock("../../../../apps/backend/src/modules/consent/consent.service.js");
const mockService = jest.mocked(service);
const browserId = "a".repeat(64);
const consent = {
  id: "consent-3", clientKey: browserId, consentVersion: "v1", legalVersionId: "legal-1",
  essentialCookies: true, preferencesCookies: true, analyticsCookies: false, marketingCookies: true,
  consentGivenAt: "2026-10-18T00:00:00.000Z", lastUpdatedAt: "2026-10-18T00:00:00.000Z",
  userAgent: "TestAgent", createdAt: "2026-10-18T00:00:00.000Z", updatedAt: "2026-10-18T00:00:00.000Z",
};
let req: Partial<Request>;
let res: Partial<Response>;
beforeEach(() => {
  jest.clearAllMocks();
  req = { headers: {}, body: { essential: true, preferences: true, analytics: false, marketing: true } };
  res = { json: jest.fn().mockReturnThis(), cookie: jest.fn().mockReturnThis() };
  mockService.saveCookiePreferences.mockResolvedValue(consent);
});

describe("cookie consent browser isolation", () => {
  it("returns no consent without a previously issued browser identifier", async () => {
    await controller.getCookieStatusHandler(req as Request, res as Response);
    expect(mockService.getConsentStatus).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { hasConsent: false } });
  });

  it("reads consent by valid first-party browser identifier, not by shared IP", async () => {
    req.headers = { cookie: `fitvibe_consent_client=${browserId}` };
    mockService.getConsentStatus.mockResolvedValue({ hasConsent: true });
    await controller.getCookieStatusHandler(req as Request, res as Response);
    expect(mockService.getConsentStatus).toHaveBeenCalledWith(browserId);
  });

  it("ignores forged or malformed browser identifiers", async () => {
    req.headers = { cookie: "fitvibe_consent_client=invalid" };
    await controller.getCookieStatusHandler(req as Request, res as Response);
    expect(mockService.getConsentStatus).not.toHaveBeenCalled();
  });

  it("saves independent categories with a new HttpOnly browser cookie", async () => {
    await controller.saveCookiePreferencesHandler(req as Request, res as Response);
    expect(mockService.saveCookiePreferences).toHaveBeenCalledWith(
      expect.stringMatching(/^[a-f0-9]{64}$/),
      { essential: true, preferences: true, analytics: false, marketing: true }, null, "banner",
    );
    expect(res.cookie).toHaveBeenCalledWith("fitvibe_consent_client", expect.stringMatching(/^[a-f0-9]{64}$/), expect.objectContaining({
      httpOnly: true, sameSite: "lax", path: "/api/v1/consent",
    }));
    expect(res.json).toHaveBeenCalledWith({ success: true, data: expect.objectContaining({
      essential: true, preferences: true, analytics: false, marketing: true,
    }) });
  });

  it("reuses the previously issued identifier to preserve consent history", async () => {
    req.headers = { cookie: `fitvibe_consent_client=${browserId}`, "user-agent": "TestAgent" };
    await controller.saveCookiePreferencesHandler(req as Request, res as Response);
    expect(mockService.saveCookiePreferences).toHaveBeenCalledWith(browserId, req.body, "TestAgent", "banner");
  });

  it("rejects attempts to disable essential cookies", async () => {
    req.body = { essential: false, preferences: false, analytics: false, marketing: false };
    await expect(controller.saveCookiePreferencesHandler(req as Request, res as Response)).rejects.toThrow();
    expect(mockService.saveCookiePreferences).not.toHaveBeenCalled();
  });
});
