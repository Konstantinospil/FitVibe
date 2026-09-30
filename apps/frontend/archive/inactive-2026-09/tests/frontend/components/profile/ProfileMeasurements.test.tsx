import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const listEnabledMeasurementAttributes = vi.fn();
const t = (key: string) => key;
const i18n = { language: "en" };

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t, i18n }),
}));

vi.mock("../../src/services/api", () => ({
  listEnabledMeasurementAttributes: (...args: unknown[]) =>
    listEnabledMeasurementAttributes(...args),
}));

describe("ProfileMeasurements", () => {
  it("shows only enabled measurement values returned by the canonical API", async () => {
    listEnabledMeasurementAttributes
      .mockResolvedValueOnce([
        {
          id: "bio-1",
          label: "Weight",
          granularity: "kg",
          latestValue: { valueNumber: 82.5 },
        },
      ])
      .mockResolvedValueOnce([]);

    const { ProfileMeasurements } = await import(
      "../../src/components/profile/ProfileMeasurements"
    );
    render(<ProfileMeasurements />);

    expect(await screen.findByText("Weight")).toBeInTheDocument();
    expect(screen.getByText("82.5 kg")).toBeInTheDocument();
    expect(listEnabledMeasurementAttributes).toHaveBeenCalledWith("bio", "en");
    expect(listEnabledMeasurementAttributes).toHaveBeenCalledWith("perf", "en");
  });
});
