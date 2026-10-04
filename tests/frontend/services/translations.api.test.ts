import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  bulkUpdateTranslation,
  createTranslation,
  deleteTranslation,
  getTranslationMetadata,
  getTranslations,
  listTranslations,
  updateTranslation,
} from "../../src/services/translations.api";
import { apiClient } from "../../src/services/httpApi";

vi.mock("../../src/services/httpApi", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("translations.api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches translations with namespace", async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { key: "value" } });
    const result = await getTranslations("en", "common");

    expect(apiClient.get as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      "/api/v1/translations/en",
      { params: { namespace: "common" } },
    );
    expect(result).toEqual({ key: "value" });
  });

  it("fetches translations without namespace", async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { key: "value" } });
    await getTranslations("en");

    expect(apiClient.get as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      "/api/v1/translations/en",
      { params: {} },
    );
  });

  it("lists translations with params", async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: [], pagination: { total: 0, limit: 10, offset: 0 } },
    });
    const result = await listTranslations({ search: "home" });

    expect(apiClient.get as ReturnType<typeof vi.fn>).toHaveBeenCalledWith("/api/v1/translations", {
      params: { search: "home" },
    });
    expect(result.pagination.total).toBe(0);
  });

  it("gets translation metadata", async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { languages: ["en"], namespaces: ["common"] } },
    });
    const result = await getTranslationMetadata();

    expect(apiClient.get as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      "/api/v1/translations/metadata",
    );
    expect(result.data.languages).toContain("en");
  });

  it("creates and updates translations", async () => {
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { id: "1" } });
    (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { id: "1" } });

    await createTranslation({
      namespace: "common",
      key_path: "home",
      language: "en",
      value: "Home",
    });
    await updateTranslation("en", "common", "home.key", { value: "New" });

    expect(apiClient.post as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      "/api/v1/translations",
      { namespace: "common", key_path: "home", language: "en", value: "Home" },
    );
    expect(apiClient.put as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      "/api/v1/translations/en/common/home.key",
      { value: "New" },
    );
  });

  it("encodes key path when updating translation", async () => {
    (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { id: "1" } });

    await updateTranslation("en", "common", "errors.notFound", { value: "Missing" });

    expect(apiClient.put as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      "/api/v1/translations/en/common/errors.notFound",
      { value: "Missing" },
    );
  });

  it("bulk updates translations", async () => {
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { translations: [{ id: "1" }] },
    });

    const result = await bulkUpdateTranslation({
      namespace: "common",
      key_path: "home",
      translations: { en: "Home", de: "Start" },
    });

    expect(apiClient.post as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      "/api/v1/translations/bulk",
      {
        namespace: "common",
        key_path: "home",
        translations: { en: "Home", de: "Start" },
      },
    );
    expect(result.translations).toHaveLength(1);
  });

  it("deletes translation with encoded key path", async () => {
    (apiClient.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await deleteTranslation("en", "common", "errors.notFound");
    expect(apiClient.delete as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      "/api/v1/translations/en/common/errors.notFound",
    );
  });
});
