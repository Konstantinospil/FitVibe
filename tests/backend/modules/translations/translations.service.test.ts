import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import {
  bulkUpdateTranslationService,
  createTranslationService,
  getAllTranslationsForLanguage,
  updateTranslationService,
} from "../../../../apps/backend/src/modules/translations/translations.service.js";
import {
  createTranslation,
  getNamespacesForLanguage,
  getTranslation,
  getTranslationsNested,
  updateTranslation,
  upsertTranslation,
  updateMeasurementAttributeLabel,
  withTranslationTransaction,
} from "../../../../apps/backend/src/modules/translations/translations.repository.js";
import { insertAudit } from "../../../../apps/backend/src/modules/common/audit.util.js";

jest.mock("../../../../apps/backend/src/modules/translations/translations.repository.js", () => ({
  createTranslation: jest.fn(),
  getNamespacesForLanguage: jest.fn(),
  getTranslation: jest.fn(),
  getTranslationsNested: jest.fn(),
  updateTranslation: jest.fn(),
  upsertTranslation: jest.fn(),
  updateMeasurementAttributeLabel: jest.fn(),
  withTranslationTransaction: jest.fn(async (work: (trx: unknown) => Promise<unknown>) =>
    work({}),
  ),
}));

jest.mock("../../../../apps/backend/src/modules/common/audit.util.js", () => ({
  insertAudit: jest.fn(),
}));

describe("translations service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(withTranslationTransaction).mockImplementation(async (work) => work({} as never));
  });

  it("merges namespaces into a single language payload", async () => {
    jest
      .mocked(getNamespacesForLanguage)
      .mockResolvedValue(["common", "terms", "privacy", "cookie", "auth"]);
    jest.mocked(getTranslationsNested).mockImplementation(async (_lang, ns) => {
      if (ns === "terms") {
        return { termsKey: "terms-value" };
      }
      if (ns === "privacy") {
        return { privacyKey: "privacy-value" };
      }
      if (ns === "cookie") {
        return { cookieKey: "cookie-value" };
      }
      if (ns === "auth") {
        return { authKey: "auth-value" };
      }
      return { commonKey: "common-value" };
    });

    const result = await getAllTranslationsForLanguage("en");

    expect(result).toEqual({
      commonKey: "common-value",
      authKey: "auth-value",
      terms: { termsKey: "terms-value" },
      privacy: { privacyKey: "privacy-value" },
      cookie: { cookieKey: "cookie-value" },
    });
  });

  it("creates attribute translations and updates measurement labels", async () => {
    jest.mocked(createTranslation).mockResolvedValue({
      id: "translation-1",
    } as never);

    const record = await createTranslationService({
      namespace: "user_attributes",
      key_path: "user_attributes.height",
      language: "en",
      value: "Height",
    });

    expect(record).toEqual({ id: "translation-1" });
    expect(createTranslation).toHaveBeenCalledWith(
      {
        namespace: "user_attributes",
        key_path: "user_attributes.height",
        language: "en",
        value: "Height",
        created_by: null,
        updated_by: null,
      },
      expect.anything(),
    );
    expect(updateMeasurementAttributeLabel).toHaveBeenCalledWith("height", "Height", expect.anything());
    expect(insertAudit).toHaveBeenCalledWith({
      actorUserId: null,
      entityType: "measurement_attributes",
      action: "rename",
      entityId: "height",
      metadata: {
        namespace: "user_attributes",
        key_path: "user_attributes.height",
        label: "Height",
      },
    });
  });

  it("throws when updating a missing translation", async () => {
    jest.mocked(getTranslation).mockResolvedValue(null);

    await expect(
      updateTranslationService("en", "common", "missing.key", { value: "next" }),
    ).rejects.toMatchObject({
      status: 404,
      code: "TRANSLATION_NOT_FOUND",
    });
  });

  it("throws when update returns no record", async () => {
    jest.mocked(getTranslation).mockResolvedValue({ id: "translation" } as never);
    jest.mocked(updateTranslation).mockResolvedValue(null);

    await expect(
      updateTranslationService("en", "common", "path.key", { value: "next" }),
    ).rejects.toMatchObject({
      status: 500,
      code: "TRANSLATION_UPDATE_FAILED",
    });
  });

  it("updates measurement labels when updating attribute translations", async () => {
    jest.mocked(getTranslation).mockResolvedValue({ id: "translation" } as never);
    jest.mocked(updateTranslation).mockResolvedValue({ id: "translation" } as never);

    await updateTranslationService("en", "user_attributes", "user_attributes.height", {
      value: "Height Updated",
    });

    expect(updateMeasurementAttributeLabel).toHaveBeenCalledWith("height", "Height Updated", expect.anything());
    expect(insertAudit).toHaveBeenCalledWith({
      actorUserId: null,
      entityType: "measurement_attributes",
      action: "rename",
      entityId: "height",
      metadata: {
        namespace: "user_attributes",
        key_path: "user_attributes.height",
        label: "Height Updated",
      },
    });
  });

  it("bulk updates translations and updates measurement labels", async () => {
    jest.mocked(upsertTranslation).mockResolvedValue({ id: "translation" } as never);

    const result = await bulkUpdateTranslationService({
      namespace: "user_attributes",
      key_path: "user_attributes.weight",
      translations: {
        en: "Weight",
        fr: "Poids",
        es: undefined,
      },
    });

    expect(result).toHaveLength(2);
    expect(upsertTranslation).toHaveBeenCalledTimes(2);
    expect(updateMeasurementAttributeLabel).toHaveBeenCalledWith("weight", "Weight", expect.anything());
    expect(insertAudit).toHaveBeenCalledWith({
      actorUserId: null,
      entityType: "measurement_attributes",
      action: "rename",
      entityId: "weight",
      metadata: {
        namespace: "user_attributes",
        key_path: "user_attributes.weight",
        label: "Weight",
      },
    });
  });
});
