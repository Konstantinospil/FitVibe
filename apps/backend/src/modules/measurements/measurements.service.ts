import { HttpError } from "../../utils/http.js";
import type {
  MeasurementAttribute,
  MeasurementAttributeCreateInput,
  MeasurementAttributeWithLatestValue,
  MeasurementSystem,
  MeasurementUnitType,
  MeasurementValue,
} from "./measurements.types.js";
import {
  type MeasurementAttributeRow,
  getAttributeById,
  getAttributeByNormalizedKey,
  insertAttribute,
  insertAttributeValue,
  listAttributes,
  listLatestAttributeValues,
  listSelections,
  upsertSelection,
  withMeasurementTransaction,
} from "./measurements.repository.js";
import { upsertTranslation } from "../translations/translations.repository.js";
import { insertAudit } from "../common/audit.util.js";

const DEFAULT_TRANSLATION_LANGUAGE = "en";

const WHITESPACE_RE = /\s+/g;

const UNIT_TYPE_NO_CONVERSION: MeasurementUnitType[] = [
  "ratio",
  "count",
  "time",
  "power",
  "percentage",
];

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(WHITESPACE_RE, " ");
}

function slugifyKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(WHITESPACE_RE, "_")
    .replace(/-+/g, "_");
}

function toNumber(value: number | string | null): number | null {
  if (value === null) {
    return null;
  }
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function toAttribute(row: MeasurementAttributeRow): MeasurementAttribute {
  return {
    id: row.id,
    key: row.key,
    normalizedKey: row.normalized_key,
    label: row.label,
    description: row.description ?? null,
    unitType: row.unit_type,
    granularity: row.granularity,
    measurementSystem: row.measurement_system,
    minValueMetric: toNumber(row.min_value_metric),
    maxValueMetric: toNumber(row.max_value_metric),
    minValueImperial: toNumber(row.min_value_imperial),
    maxValueImperial: toNumber(row.max_value_imperial),
    isDefault: Boolean(row.is_default),
    derivedFromAId: row.derived_from_a_id ?? null,
    derivedFromBId: row.derived_from_b_id ?? null,
    derivedOperator: row.derived_operator ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function convertLengthMetricToImperial(value: number, granularity: string): number {
  if (granularity === "mm") {
    return value / 25.4;
  }
  if (granularity === "m") {
    return value * 39.3701;
  }
  return value / 2.54;
}

function convertLengthImperialToMetric(value: number, granularity: string): number {
  if (granularity === "ft") {
    return value * 30.48;
  }
  return value * 2.54;
}

function convertWeightMetricToImperial(value: number): number {
  return value * 2.20462262;
}

function convertWeightImperialToMetric(value: number): number {
  return value / 2.20462262;
}

function convertVolumeMetricToImperial(value: number): number {
  return value * 0.264172;
}

function convertVolumeImperialToMetric(value: number): number {
  return value / 0.264172;
}

function convertValue(
  unitType: MeasurementUnitType,
  measurementSystem: MeasurementSystem,
  value: number,
  granularity: string,
): number {
  if (UNIT_TYPE_NO_CONVERSION.includes(unitType)) {
    return value;
  }
  if (unitType === "length") {
    return measurementSystem === "metric"
      ? convertLengthMetricToImperial(value, granularity)
      : convertLengthImperialToMetric(value, granularity);
  }
  if (unitType === "weight") {
    return measurementSystem === "metric"
      ? convertWeightMetricToImperial(value)
      : convertWeightImperialToMetric(value);
  }
  if (unitType === "volume") {
    return measurementSystem === "metric"
      ? convertVolumeMetricToImperial(value)
      : convertVolumeImperialToMetric(value);
  }
  return value;
}

function normalizeRange(
  unitType: MeasurementUnitType,
  measurementSystem: MeasurementSystem,
  granularity: string,
  minValue?: number | null,
  maxValue?: number | null,
) {
  const min = typeof minValue === "number" ? minValue : null;
  const max = typeof maxValue === "number" ? maxValue : null;
  if (measurementSystem === "metric") {
    return {
      minMetric: min,
      maxMetric: max,
      minImperial: min === null ? null : convertValue(unitType, "metric", min, granularity),
      maxImperial: max === null ? null : convertValue(unitType, "metric", max, granularity),
    };
  }
  return {
    minMetric: min === null ? null : convertValue(unitType, "imperial", min, granularity),
    maxMetric: max === null ? null : convertValue(unitType, "imperial", max, granularity),
    minImperial: min,
    maxImperial: max,
  };
}

function assertWithinRange(attribute: MeasurementAttribute, valueNumber: number): void {
  const min =
    attribute.measurementSystem === "metric"
      ? attribute.minValueMetric
      : attribute.minValueImperial;
  const max =
    attribute.measurementSystem === "metric"
      ? attribute.maxValueMetric
      : attribute.maxValueImperial;
  if (min !== null && valueNumber < min) {
    throw new HttpError(400, "MEASUREMENT_OUT_OF_RANGE", "Value below minimum");
  }
  if (max !== null && valueNumber > max) {
    throw new HttpError(400, "MEASUREMENT_OUT_OF_RANGE", "Value above maximum");
  }
}

export async function listMeasurementAttributesForUser(
  category: "bio" | "perf",
  userId: string,
  options?: { q?: string; includeHidden?: boolean; lang?: string },
): Promise<MeasurementAttributeWithLatestValue[]> {
  const [attributes, latestValues, selections] = await Promise.all([
    listAttributes(category, options?.q, options?.lang),
    listLatestAttributeValues(category, userId),
    listSelections(category, userId),
  ]);
  const latestMap = new Map<string, MeasurementValue>();
  for (const value of latestValues) {
    latestMap.set(value.attribute_id, {
      attributeId: value.attribute_id,
      valueNumber: Number(value.value_number),
      measuredAt: value.measured_at,
    });
  }
  const selectionMap = new Map<string, boolean>();
  selections.forEach((selection) => {
    selectionMap.set(selection.attribute_id, selection.is_visible);
  });

  const result: MeasurementAttributeWithLatestValue[] = [];
  for (const attributeRow of attributes) {
    const attribute = toAttribute(attributeRow);
    const isVisible = selectionMap.get(attribute.id) ?? attribute.isDefault;

    if (!options?.includeHidden && !isVisible) {
      continue;
    }

    let latestValue = latestMap.get(attribute.id) ?? null;
    if (!latestValue && attribute.derivedOperator === "ratio") {
      const sourceA = attribute.derivedFromAId ? latestMap.get(attribute.derivedFromAId) : null;
      const sourceB = attribute.derivedFromBId ? latestMap.get(attribute.derivedFromBId) : null;
      if (sourceA && sourceB && sourceB.valueNumber !== 0) {
        latestValue = {
          attributeId: attribute.id,
          valueNumber: sourceA.valueNumber / sourceB.valueNumber,
          measuredAt:
            sourceA.measuredAt > sourceB.measuredAt ? sourceA.measuredAt : sourceB.measuredAt,
        };
      }
    }

    result.push({ ...attribute, isVisible, latestValue });
  }
  return result;
}

export async function createMeasurementAttribute(
  category: "bio" | "perf",
  userId: string,
  input: MeasurementAttributeCreateInput,
): Promise<MeasurementAttribute> {
  const created = await withMeasurementTransaction(async (trx) => {
    // Note: userId is validated but not currently stored in the database.
    // If we need to track attribute creators, we would need to:
    // 1. Add a migration to add created_by_user_id column to bio_attributes and perf_attributes tables
    // 2. Update the insertAttribute repository function to accept and store userId
    const label = input.label.trim();
    if (!label) {
      throw new HttpError(400, "MEASUREMENT_LABEL_REQUIRED", "Label is required");
    }
    const normalizedLabel = normalizeLabel(label);
    const existing = await getAttributeByNormalizedKey(category, normalizedLabel, trx);
    if (existing) {
      throw new HttpError(409, "MEASUREMENT_DUPLICATE", "Attribute already exists");
    }
    if (
      typeof input.minValue === "number" &&
      typeof input.maxValue === "number" &&
      input.minValue > input.maxValue
    ) {
      throw new HttpError(400, "MEASUREMENT_RANGE_INVALID", "Minimum exceeds maximum");
    }
    if (input.derivedOperator && (!input.derivedFromAId || !input.derivedFromBId)) {
      throw new HttpError(400, "MEASUREMENT_DERIVED_INVALID", "Derived sources required");
    }
    if (input.derivedOperator && input.derivedFromAId === input.derivedFromBId) {
      throw new HttpError(400, "MEASUREMENT_DERIVED_INVALID", "Derived sources must be different");
    }
    if (input.derivedOperator) {
      const [sourceA, sourceB] = await Promise.all([
        getAttributeById(category, input.derivedFromAId!, trx),
        getAttributeById(category, input.derivedFromBId!, trx),
      ]);
      if (!sourceA || !sourceB) {
        throw new HttpError(400, "MEASUREMENT_DERIVED_INVALID", "Derived sources not found");
      }
    }

    const key = input.key?.trim() ? slugifyKey(input.key) : slugifyKey(label);
    const normalizedKey = normalizedLabel;
    const range = normalizeRange(
      input.unitType,
      input.measurementSystem,
      input.granularity,
      input.minValue ?? null,
      input.maxValue ?? null,
    );

    const id = await insertAttribute(
      category,
      {
        key,
        normalized_key: normalizedKey,
        label,
        description: input.description ?? null,
        unit_type: input.unitType,
        granularity: input.granularity,
        measurement_system: input.measurementSystem,
        min_value_metric: range.minMetric,
        max_value_metric: range.maxMetric,
        min_value_imperial: range.minImperial,
        max_value_imperial: range.maxImperial,
        is_default: false,
        derived_from_a_id: input.derivedFromAId ?? null,
        derived_from_b_id: input.derivedFromBId ?? null,
        derived_operator: input.derivedOperator ?? null,
      },
      trx,
    );

    await upsertTranslation(
      {
        namespace: "user_attributes",
        key_path: `user_attributes.${key}`,
        language: DEFAULT_TRANSLATION_LANGUAGE,
        value: label,
      },
      trx,
    );

    const created = await getAttributeById(category, id, trx);
    if (!created) {
      throw new HttpError(500, "MEASUREMENT_CREATE_FAILED", "Failed to create attribute");
    }
    return toAttribute(created);
  });

  await insertAudit({
    actorUserId: userId,
    entityType: "measurement_attribute",
    action: "create",
    entityId: created.id,
    metadata: {
      category,
      key: created.key,
      normalizedKey: created.normalizedKey,
      unitType: created.unitType,
      granularity: created.granularity,
      measurementSystem: created.measurementSystem,
    },
  });

  return created;
}

export async function addMeasurementValue(
  category: "bio" | "perf",
  userId: string,
  attributeId: string,
  valueNumber: number,
  measuredAt?: string,
): Promise<MeasurementValue> {
  const attributeRow = await getAttributeById(category, attributeId);
  if (!attributeRow) {
    throw new HttpError(404, "MEASUREMENT_ATTRIBUTE_NOT_FOUND", "Attribute not found");
  }
  const attribute = toAttribute(attributeRow);
  if (attribute.derivedOperator) {
    throw new HttpError(400, "MEASUREMENT_DERIVED_READONLY", "Derived values are read-only");
  }
  assertWithinRange(attribute, valueNumber);
  await insertAttributeValue(category, userId, attributeId, valueNumber, measuredAt);
  return {
    attributeId,
    valueNumber,
    measuredAt: measuredAt ?? new Date().toISOString(),
  };
}

export async function updateMeasurementVisibility(
  category: "bio" | "perf",
  userId: string,
  attributeId: string,
  isVisible: boolean,
): Promise<void> {
  const attribute = await getAttributeById(category, attributeId);
  if (!attribute) {
    throw new HttpError(404, "MEASUREMENT_ATTRIBUTE_NOT_FOUND", "Attribute not found");
  }
  await upsertSelection(category, userId, attributeId, isVisible);
}
