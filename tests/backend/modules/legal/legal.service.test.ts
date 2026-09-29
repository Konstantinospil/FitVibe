import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import {
  acceptLegalDocumentVersion,
  getLegalActionStatus,
  legalVersionSatisfiesCurrentRequirement,
  publishLegalDocument,
} from "../../../../apps/backend/src/modules/legal/legal.service.js";
import {
  getActiveLegalTranslationRows,
  getCurrentLegalVersion,
  getLatestAcceptanceForDocument,
  getLatestRequiredLegalVersion,
  getLegalVersionById,
  recordLegalAcceptance,
  withLegalTransaction,
} from "../../../../apps/backend/src/modules/legal/legal.repository.js";

jest.mock("../../../../apps/backend/src/modules/legal/legal.repository.js", () => ({
  getActiveLegalTranslationRows: jest.fn(),
  getCurrentLegalVersion: jest.fn(),
  getLatestAcceptanceForDocument: jest.fn(),
  getLatestRequiredLegalVersion: jest.fn(),
  getLegalSnapshot: jest.fn(),
  getLegalVersionById: jest.fn(),
  getVersionStringsByPrefix: jest.fn(),
  insertLegalSnapshot: jest.fn(),
  insertLegalVersion: jest.fn(),
  listLegalVersions: jest.fn(),
  listSnapshotLanguages: jest.fn(),
  lockLegalDocument: jest.fn(),
  recordLegalAcceptance: jest.fn(),
  withLegalTransaction: jest.fn(),
}));

jest.mock("../../../../apps/backend/src/modules/common/audit.util.js", () => ({
  insertAudit: jest.fn(),
}));

const materialTerms = {
  id: "11111111-1111-1111-1111-111111111111",
  document_type: "terms",
  version: "2026-09-25.1",
  change_class: "material",
  user_action: "accept",
  effective_at: "2026-09-25T08:00:00.000Z",
  published_at: "2026-09-25T07:00:00.000Z",
  published_by: null,
  source: "backoffice",
  created_at: "2026-09-25T07:00:00.000Z",
} as const;

describe("legal publication invariants", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not allow editorial publications to invalidate existing acceptance", async () => {
    await expect(
      publishLegalDocument(
        {
          documentType: "terms",
          changeClass: "editorial",
          userAction: "accept",
        },
        "admin-1",
      ),
    ).rejects.toMatchObject({ code: "LEGAL_EDITORIAL_ACTION_INVALID" });

    expect(withLegalTransaction).not.toHaveBeenCalled();
  });

  it("requires an explicit user effect for material publications", async () => {
    await expect(
      publishLegalDocument(
        {
          documentType: "privacy",
          changeClass: "material",
          userAction: "none",
        },
        "admin-1",
      ),
    ).rejects.toMatchObject({ code: "LEGAL_MATERIAL_ACTION_REQUIRED" });

    expect(withLegalTransaction).not.toHaveBeenCalled();
  });

  it("rejects unsupported translation languages before authoring file access", async () => {
    jest.mocked(withLegalTransaction).mockImplementation(async (work) =>
      work({} as never),
    );
    jest.mocked(getActiveLegalTranslationRows).mockResolvedValue([
      {
        language: "../../outside",
        key_path: "terms.title",
        value: "Unsafe locale",
      },
    ]);

    await expect(
      publishLegalDocument(
        {
          documentType: "terms",
          changeClass: "editorial",
          userAction: "none",
        },
        "admin-1",
      ),
    ).rejects.toMatchObject({ code: "LEGAL_LANGUAGE_UNSUPPORTED" });
  });

  it("treats acceptance of a newer editorial publication as satisfying the preceding material gate", async () => {
    jest.mocked(getCurrentLegalVersion).mockResolvedValue({
      ...materialTerms,
      id: "22222222-2222-2222-2222-222222222222",
      version: "2026-09-26.1",
      change_class: "editorial",
      user_action: "none",
      effective_at: "2026-09-26T08:00:00.000Z",
      published_at: "2026-09-26T07:00:00.000Z",
    });
    jest.mocked(getLatestRequiredLegalVersion).mockResolvedValue(materialTerms);
    jest.mocked(getLatestAcceptanceForDocument).mockResolvedValue({
      id: "33333333-3333-3333-3333-333333333333",
      user_id: "user-1",
      version_id: "22222222-2222-2222-2222-222222222222",
      action: "accept",
      source: "application",
      accepted_at: "2026-09-26T09:00:00.000Z",
      revoked_at: null,
      created_at: "2026-09-26T09:00:00.000Z",
      version: "2026-09-26.1",
      version_effective_at: "2026-09-26T08:00:00.000Z",
      version_published_at: "2026-09-26T07:00:00.000Z",
    });

    await expect(getLegalActionStatus("user-1", "terms")).resolves.toMatchObject({
      currentVersion: "2026-09-26.1",
      requiredVersion: "2026-09-25.1",
      acceptedVersion: "2026-09-26.1",
      requiredAction: "accept",
      needsAction: false,
    });
  });

  it("requires renewed action when the latest acceptance predates the current material requirement", async () => {
    jest.mocked(getCurrentLegalVersion).mockResolvedValue(materialTerms);
    jest.mocked(getLatestRequiredLegalVersion).mockResolvedValue(materialTerms);
    jest.mocked(getLatestAcceptanceForDocument).mockResolvedValue({
      id: "33333333-3333-3333-3333-333333333333",
      user_id: "user-1",
      version_id: "00000000-0000-0000-0000-000000000001",
      action: "accept",
      source: "legacy_migration",
      accepted_at: "2024-06-01T00:00:00.000Z",
      revoked_at: null,
      created_at: "2024-06-01T00:00:00.000Z",
      version: "2024-06-01",
      version_effective_at: "2024-06-01T00:00:00.000Z",
      version_published_at: "2024-06-01T00:00:00.000Z",
    });

    await expect(getLegalActionStatus("user-1", "terms")).resolves.toMatchObject({
      needsAction: true,
      requiredVersion: "2026-09-25.1",
    });
  });

  it("records acceptance against the exact published version requested", async () => {
    jest.mocked(getLegalVersionById).mockResolvedValue(materialTerms);

    const result = await acceptLegalDocumentVersion(
      "user-1",
      materialTerms.id,
      "registration",
      undefined,
    );

    expect(result).toEqual(materialTerms);
    expect(recordLegalAcceptance).toHaveBeenCalledWith(
      "user-1",
      materialTerms.id,
      "accept",
      expect.any(String),
      "registration",
      undefined,
    );
  });

  it("uses publication order rather than version-string equality for cookie renewal", async () => {
    jest.mocked(getLegalVersionById).mockResolvedValue({
      ...materialTerms,
      id: "44444444-4444-4444-4444-444444444444",
      document_type: "cookie",
      version: "2026-09-26.1",
      change_class: "editorial",
      user_action: "none",
      effective_at: "2026-09-26T08:00:00.000Z",
      published_at: "2026-09-26T07:00:00.000Z",
    });
    jest.mocked(getLatestRequiredLegalVersion).mockResolvedValue({
      ...materialTerms,
      document_type: "cookie",
      user_action: "renew_consent",
    });

    await expect(
      legalVersionSatisfiesCurrentRequirement(
        "cookie",
        "44444444-4444-4444-4444-444444444444",
      ),
    ).resolves.toBe(true);
  });
});
