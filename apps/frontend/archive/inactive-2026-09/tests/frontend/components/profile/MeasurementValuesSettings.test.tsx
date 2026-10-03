import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listEnabledMeasurementAttributes = vi.fn();
const addMeasurementValue = vi.fn();
const t = (key: string) => key;
const i18n = { language: "en" };

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t,
    i18n,
  }),
}));

vi.mock("../../src/services/api", () => ({
  listEnabledMeasurementAttributes: (...args: unknown[]) =>
    listEnabledMeasurementAttributes(...args),
  addMeasurementValue: (...args: unknown[]) => addMeasurementValue(...args),
}));

describe("MeasurementValuesSettings", () => {
  beforeEach(() => {
    listEnabledMeasurementAttributes.mockReset();
    addMeasurementValue.mockReset();
  });

  it("loads enabled measurements and records a timestamped value", async () => {
    listEnabledMeasurementAttributes.mockResolvedValue([
      {
        id: "attr-1",
        key: "weight_kg",
        normalizedKey: "weight",
        label: "Weight",
        description: null,
        unitType: "weight",
        granularity: "kg",
        measurementSystem: "metric",
        minValueMetric: 20,
        maxValueMetric: 400,
        minValueImperial: 44.09,
        maxValueImperial: 881.85,
        isDefault: true,
        derivedFromAId: null,
        derivedFromBId: null,
        derivedOperator: null,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
        latestValue: null,
        isVisible: true,
      },
    ]);
    addMeasurementValue.mockResolvedValue({
      attributeId: "attr-1",
      valueNumber: 82.5,
      measuredAt: "2026-09-27T10:00:00.000Z",
    });

    const { MeasurementValuesSettings } = await import(
      "../../src/components/profile/MeasurementValuesSettings"
    );

    render(<MeasurementValuesSettings />);

    expect(await screen.findByText("Weight")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Weight settings.measurements.value"), {
      target: { value: "82.5" },
    });
    fireEvent.change(screen.getByLabelText("Weight settings.measurements.measuredAt"), {
      target: { value: "2026-09-27T12:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "settings.measurements.save" }));

    await waitFor(() =>
      expect(addMeasurementValue).toHaveBeenCalledWith(
        "bio",
        "attr-1",
        expect.objectContaining({
          valueNumber: 82.5,
          measuredAt: expect.any(String),
        }),
      ),
    );
  });

  it("does not render derived measurements as editable inputs", async () => {
    listEnabledMeasurementAttributes.mockResolvedValue([
      {
        id: "derived-1",
        key: "ratio",
        normalizedKey: "ratio",
        label: "Ratio",
        description: null,
        unitType: "ratio",
        granularity: "ratio",
        measurementSystem: "metric",
        minValueMetric: null,
        maxValueMetric: null,
        minValueImperial: null,
        maxValueImperial: null,
        isDefault: true,
        derivedFromAId: "a",
        derivedFromBId: "b",
        derivedOperator: "ratio",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
        latestValue: { attributeId: "derived-1", valueNumber: 2, measuredAt: "2026-09-27" },
        isVisible: true,
      },
    ]);

    const { MeasurementValuesSettings } = await import(
      "../../src/components/profile/MeasurementValuesSettings"
    );

    render(<MeasurementValuesSettings />);

    expect(await screen.findByText("settings.measurements.noneEnabled")).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });
});
