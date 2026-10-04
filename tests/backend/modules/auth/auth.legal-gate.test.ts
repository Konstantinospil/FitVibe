import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { assertTermsRequirementSatisfied } from "../../../../apps/backend/src/modules/auth/auth.legal-gate.js";
import { getLegalActionStatus } from "../../../../apps/backend/src/modules/legal/legal.service.js";

jest.mock("../../../../apps/backend/src/modules/legal/legal.service.js", () => ({
  getLegalActionStatus: jest.fn(),
}));

const mockedStatus = jest.mocked(getLegalActionStatus);

describe("persisted legal authentication gate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows authentication when the latest required persisted publication is satisfied", async () => {
    mockedStatus.mockResolvedValue({
      currentVersion: "2026-09-26.2",
      requiredVersion: "2026-09-25.1",
      acceptedVersion: "2026-09-25.1",
      acceptedAt: "2026-09-25T10:00:00.000Z",
      requiredAction: "accept",
      needsAction: false,
    });

    await expect(assertTermsRequirementSatisfied("user-1")).resolves.toBeUndefined();
    expect(mockedStatus).toHaveBeenCalledWith("user-1", "terms");
  });

  it("blocks authentication when a later material persisted publication requires action", async () => {
    mockedStatus.mockResolvedValue({
      currentVersion: "2026-09-26.2",
      requiredVersion: "2026-09-26.2",
      acceptedVersion: "2026-09-25.1",
      acceptedAt: "2026-09-25T10:00:00.000Z",
      requiredAction: "accept",
      needsAction: true,
    });

    await expect(assertTermsRequirementSatisfied("user-1")).rejects.toMatchObject({
      status: 403,
      code: "TERMS_VERSION_OUTDATED",
    });
  });
});
