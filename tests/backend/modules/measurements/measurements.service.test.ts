import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

import {
  addMeasurementValue,
  createMeasurementAttribute,
  listMeasurementAttributesForUser,
  updateMeasurementVisibility,
} from "../../../../apps/backend/src/modules/measurements/measurements.service.js";
import {
  getAttributeById,
  getAttributeByNormalizedKey,
  insertAttribute,
  insertAttributeValue,
  listAttributes,
  listLatestAttributeValues,
  listSelections,
  upsertSelection,
  withMeasurementTransaction,
} from "../../../../apps/backend/src/modules/measurements/measurements.repository.js";
import { upsertTranslation } from "../../../../apps/backend/src/modules/translations/translations.repository.js";
import { insertAudit } from "../../../../apps/backend/src/modules/common/audit.util.js";

jest.mock("../../../../apps/backend/src/modules/measurements/measurements.repository.js", () => ({
  getAttributeById: jest.fn(),
  getAttributeByNormalizedKey: jest.fn(),
  insertAttribute: jest.fn(),
  insertAttributeValue: jest.fn(),
  listAttributes: jest.fn(),
  listLatestAttributeValues: jest.fn(),
  listSelections: jest.fn(),
  upsertSelection: jest.fn(),
  withMeasurementTransaction: jest.fn(async (work: (trx: unknown) => Promise<unknown>) =>
    work({}),
  ),
}));

jest.mock("../../../../apps/backend/src/modules/translations/translations.repository.js", () => ({
  upsertTranslation: jest.fn(),
}));

jest.mock("../../../../apps/backend/src/modules/common/audit.util.js", () => ({
  insertAudit: jest.fn(),
}));

describe("measurements service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(withMeasurementTransaction).mockImplementation(async (work) => work({} as never));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns visible attributes with derived ratio values", async () => {
    jest.mocked(listAttributes).mockResolvedValue([
      {
        id: "attr-1",
        key: "weight",
        normalized_key: "weight",
        label: "Weight",
        description: null,
        unit_type: "weight",
        granularity: "kg",
        measurement_system: "metric",
        min_value_metric: null,
        max_value_metric: null,
        min_value_imperial: null,
        max_value_imperial: null,
        is_default: false,
        derived_from_a_id: null,
        derived_from_b_id: null,
        derived_operator: null,
        created_at: "2025-01-01",
        updated_at: "2025-01-01",
      },
      {
        id: "attr-2",
        key: "ratio",
        normalized_key: "ratio",
        label: "Ratio",
        description: null,
        unit_type: "ratio",
        granularity: "ratio",
        measurement_system: "metric",
        min_value_metric: null,
        max_value_metric: null,
        min_value_imperial: null,
        max_value_imperial: null,
        is_default: true,
        derived_from_a_id: "attr-1",
        derived_from_b_id: "attr-3",
        derived_operator: "ratio",
        created_at: "2025-01-01",
        updated_at: "2025-01-01",
      },
      {
        id: "attr-hidden",
        key: "hidden",
        normalized_key: "hidden",
        label: "Hidden",
        description: null,
        unit_type: "count",
        granularity: "count",
        measurement_system: "metric",
        min_value_metric: null,
        max_value_metric: null,
        min_value_imperial: null,
        max_value_imperial: null,
        is_default: false,
        derived_from_a_id: null,
        derived_from_b_id: null,
        derived_operator: null,
        created_at: "2025-01-01",
        updated_at: "2025-01-01",
      },
    ]);
    jest.mocked(listLatestAttributeValues).mockResolvedValue([
      {
        id: "value-1",
        user_id: "user-1",
        attribute_id: "attr-1",
        value_number: 10,
        measured_at: "2025-02-01",
        created_at: "2025-02-01",
      },
      {
        id: "value-2",
        user_id: "user-1",
        attribute_id: "attr-3",
        value_number: 2,
        measured_at: "2025-02-05",
        created_at: "2025-02-05",
      },
    ]);
    jest
      .mocked(listSelections)
      .mockResolvedValue([
        { user_id: "user-1", attribute_id: "attr-1", is_visible: true, created_at: "2025-01-01" },
      ]);

    const result = await listMeasurementAttributesForUser("bio", "user-1");

    expect(result).toHaveLength(2);
    const ratio = result.find((item) => item.id === "attr-2");
    expect(ratio?.latestValue).toEqual({
      attributeId: "attr-2",
      valueNumber: 5,
      measuredAt: "2025-02-05",
    });
  });

  it("rejects invalid attribute creation requests", async () => {
    await expect(
      createMeasurementAttribute("bio", "user-1", {
        label: " ",
        unitType: "length",
        granularity: "cm",
        measurementSystem: "metric",
      }),
    ).rejects.toMatchObject({ code: "MEASUREMENT_LABEL_REQUIRED" });

    jest.mocked(getAttributeByNormalizedKey).mockResolvedValue({ id: "existing" } as never);

    await expect(
      createMeasurementAttribute("bio", "user-1", {
        label: "Height",
        unitType: "length",
        granularity: "cm",
        measurementSystem: "metric",
      }),
    ).rejects.toMatchObject({ code: "MEASUREMENT_DUPLICATE" });
  });

  it("creates an attribute and upserts translations", async () => {
    jest.mocked(getAttributeByNormalizedKey).mockResolvedValue(null);
    jest.mocked(insertAttribute).mockResolvedValue("attr-1");
    jest.mocked(getAttributeById).mockResolvedValue({
      id: "attr-1",
      key: "height",
      normalized_key: "height",
      label: "Height",
      description: null,
      unit_type: "length",
      granularity: "cm",
      measurement_system: "metric",
      min_value_metric: 100,
      max_value_metric: 200,
      min_value_imperial: 39.37,
      max_value_imperial: 78.74,
      is_default: false,
      derived_from_a_id: null,
      derived_from_b_id: null,
      derived_operator: null,
      created_at: "2025-01-01",
      updated_at: "2025-01-01",
    });

    const created = await createMeasurementAttribute("bio", "user-1", {
      label: "Height",
      unitType: "length",
      granularity: "cm",
      measurementSystem: "metric",
      minValue: 100,
      maxValue: 200,
    });

    expect(created.id).toBe("attr-1");
    expect(upsertTranslation).toHaveBeenCalledWith(
      {
        namespace: "user_attributes",
        key_path: "user_attributes.height",
        language: "en",
        value: "Height",
      },
      expect.anything(),
    );
    expect(insertAudit).toHaveBeenCalledWith({
      actorUserId: "user-1",
      entityType: "measurement_attribute",
      action: "create",
      entityId: "attr-1",
      metadata: {
        category: "bio",
        key: "height",
        normalizedKey: "height",
        unitType: "length",
        granularity: "cm",
        measurementSystem: "metric",
      },
    });
  });

  it("rejects derived measurements without valid sources", async () => {
    jest.mocked(getAttributeByNormalizedKey).mockResolvedValue(null);

    await expect(
      createMeasurementAttribute("bio", "user-1", {
        label: "ratio",
        unitType: "ratio",
        granularity: "ratio",
        measurementSystem: "metric",
        derivedOperator: "ratio",
        derivedFromAId: "a",
        derivedFromBId: "a",
      }),
    ).rejects.toMatchObject({ code: "MEASUREMENT_DERIVED_INVALID" });

    jest.mocked(getAttributeById).mockResolvedValueOnce(null);
    jest.mocked(getAttributeById).mockResolvedValueOnce({ id: "b" } as never);

    await expect(
      createMeasurementAttribute("bio", "user-1", {
        label: "ratio",
        unitType: "ratio",
        granularity: "ratio",
        measurementSystem: "metric",
        derivedOperator: "ratio",
        derivedFromAId: "a",
        derivedFromBId: "b",
      }),
    ).rejects.toMatchObject({ code: "MEASUREMENT_DERIVED_INVALID" });
  });

  it("adds measurement values with range validation", async () => {
    jest.mocked(getAttributeById).mockResolvedValueOnce(null);

    await expect(addMeasurementValue("bio", "user-1", "missing", 10)).rejects.toMatchObject({
      code: "MEASUREMENT_ATTRIBUTE_NOT_FOUND",
    });

    jest.mocked(getAttributeById).mockResolvedValueOnce({
      id: "derived",
      key: "ratio",
      normalized_key: "ratio",
      label: "Ratio",
      description: null,
      unit_type: "ratio",
      granularity: "ratio",
      measurement_system: "metric",
      min_value_metric: null,
      max_value_metric: null,
      min_value_imperial: null,
      max_value_imperial: null,
      is_default: false,
      derived_from_a_id: "a",
      derived_from_b_id: "b",
      derived_operator: "ratio",
      created_at: "2025-01-01",
      updated_at: "2025-01-01",
    });

    await expect(addMeasurementValue("bio", "user-1", "derived", 10)).rejects.toMatchObject({
      code: "MEASUREMENT_DERIVED_READONLY",
    });

    jest.mocked(getAttributeById).mockResolvedValueOnce({
      id: "range",
      key: "weight",
      normalized_key: "weight",
      label: "Weight",
      description: null,
      unit_type: "weight",
      granularity: "kg",
      measurement_system: "metric",
      min_value_metric: 5,
      max_value_metric: 15,
      min_value_imperial: null,
      max_value_imperial: null,
      is_default: false,
      derived_from_a_id: null,
      derived_from_b_id: null,
      derived_operator: null,
      created_at: "2025-01-01",
      updated_at: "2025-01-01",
    });

    await expect(addMeasurementValue("bio", "user-1", "range", 1)).rejects.toMatchObject({
      code: "MEASUREMENT_OUT_OF_RANGE",
    });

    jest.useFakeTimers().setSystemTime(new Date("2025-03-01T10:00:00Z"));
    jest.mocked(getAttributeById).mockResolvedValueOnce({
      id: "ok",
      key: "weight",
      normalized_key: "weight",
      label: "Weight",
      description: null,
      unit_type: "weight",
      granularity: "kg",
      measurement_system: "metric",
      min_value_metric: 5,
      max_value_metric: 15,
      min_value_imperial: null,
      max_value_imperial: null,
      is_default: false,
      derived_from_a_id: null,
      derived_from_b_id: null,
      derived_operator: null,
      created_at: "2025-01-01",
      updated_at: "2025-01-01",
    });

    const result = await addMeasurementValue("bio", "user-1", "ok", 10);

    expect(insertAttributeValue).toHaveBeenCalledWith("bio", "user-1", "ok", 10, undefined);
    expect(result).toEqual({
      attributeId: "ok",
      valueNumber: 10,
      measuredAt: "2025-03-01T10:00:00.000Z",
    });
  });

  it("updates measurement visibility", async () => {
    jest.mocked(getAttributeById).mockResolvedValueOnce(null);

    await expect(
      updateMeasurementVisibility("bio", "user-1", "missing", true),
    ).rejects.toMatchObject({ code: "MEASUREMENT_ATTRIBUTE_NOT_FOUND" });

    jest.mocked(getAttributeById).mockResolvedValueOnce({ id: "attr" } as never);

    await updateMeasurementVisibility("bio", "user-1", "attr", true);

    expect(upsertSelection).toHaveBeenCalledWith("bio", "user-1", "attr", true);
  });
});
