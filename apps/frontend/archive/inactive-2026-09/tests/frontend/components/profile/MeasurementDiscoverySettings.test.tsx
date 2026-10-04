import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listMeasurementAttributes = vi.fn();
const updateMeasurementVisibility = vi.fn();
const t = (key: string) => key;
const i18n = { language: "en" };

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t, i18n }),
}));

vi.mock("../../src/services/api", () => ({
  listMeasurementAttributes: (...args: unknown[]) => listMeasurementAttributes(...args),
  updateMeasurementVisibility: (...args: unknown[]) => updateMeasurementVisibility(...args),
}));

describe("MeasurementDiscoverySettings", () => {
  beforeEach(() => {
    listMeasurementAttributes.mockReset();
    updateMeasurementVisibility.mockReset();
  });

  it("searches the full catalogue and persists profile visibility", async () => {
    listMeasurementAttributes.mockResolvedValue([
      {
        id: "attr-1",
        label: "Weight",
        description: "Body weight",
        granularity: "kg",
        isVisible: false,
      },
    ]);
    updateMeasurementVisibility.mockResolvedValue(undefined);

    const { MeasurementDiscoverySettings } = await import(
      "../../src/components/profile/MeasurementDiscoverySettings"
    );
    render(<MeasurementDiscoverySettings />);

    expect(await screen.findByText("Weight")).toBeInTheDocument();
    expect(listMeasurementAttributes).toHaveBeenCalledWith("bio", {
      lang: "en",
      q: undefined,
      includeHidden: true,
    });

    fireEvent.click(screen.getByRole("button", { name: "settings.measurementDiscovery.add" }));

    await waitFor(() =>
      expect(updateMeasurementVisibility).toHaveBeenCalledWith("bio", "attr-1", true),
    );
    expect(screen.getByRole("button", { name: "settings.measurementDiscovery.remove" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
