import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addMeasurementValue,
  listEnabledMeasurementAttributes,
  listMeasurementAttributes,
  updateMeasurementVisibility,
} from "../../src/services/measurementsApi";
import { apiClient } from "../../src/services/httpApi";

vi.mock("../../src/services/httpApi", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

describe("measurementsApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["bio", "/api/v1/measurements/biometrics/attributes"],
    ["perf", "/api/v1/measurements/performance/attributes"],
  ] as const)("lists %s attributes using the canonical collection path", async (category, path) => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { attributes: [{ id: "a1" }] } } as never);

    const result = await listMeasurementAttributes(category);

    expect(apiClient.get).toHaveBeenCalledWith(path, { params: {} });
    expect(result).toEqual([{ id: "a1" }]);
  });

  it("includes only explicitly requested list filters", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { attributes: [] } } as never);

    await listMeasurementAttributes("bio", {
      lang: "de",
      q: "weight",
      includeHidden: true,
    });

    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/measurements/biometrics/attributes", {
      params: { lang: "de", q: "weight", includeHidden: "true" },
    });
  });

  it("omits empty and false optional filters", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { attributes: [] } } as never);

    await listMeasurementAttributes("perf", {
      lang: "",
      q: "",
      includeHidden: false,
    });

    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/measurements/performance/attributes", {
      params: {},
    });
  });

  it("delegates enabled-attribute listing while preserving language", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { attributes: [] } } as never);

    await listEnabledMeasurementAttributes("bio", "el");

    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/measurements/biometrics/attributes", {
      params: { lang: "el" },
    });
  });

  it("posts measurement values for both categories", async () => {
    const value = { attributeId: "a1", valueNumber: 82, measuredAt: "2026-10-02T12:00:00Z" };
    vi.mocked(apiClient.post).mockResolvedValue({ data: { latestValue: value } } as never);

    await expect(
      addMeasurementValue("perf", "a1", { valueNumber: 82, measuredAt: value.measuredAt }),
    ).resolves.toEqual(value);

    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/v1/measurements/performance/attributes/a1/values",
      { valueNumber: 82, measuredAt: value.measuredAt },
    );
  });

  it("updates visibility through the correct biometric route", async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} } as never);

    await updateMeasurementVisibility("bio", "a1", false);

    expect(apiClient.put).toHaveBeenCalledWith(
      "/api/v1/measurements/biometrics/attributes/a1/visibility",
      { isVisible: false },
    );
  });
});
