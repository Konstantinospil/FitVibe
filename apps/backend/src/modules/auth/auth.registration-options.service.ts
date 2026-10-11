import { db } from "../../db/connection.js";
import { HttpError } from "../../utils/http.js";

interface RegistrationReferenceRow {
  code: string;
  description: string;
}

interface WeightAttributeRow {
  key: string;
  min_value_metric: number | string | null;
  max_value_metric: number | string | null;
}

export interface RegistrationReferenceOption {
  code: string;
  description: string;
}

export interface RegistrationOptions {
  genders: RegistrationReferenceOption[];
  fitnessLevels: RegistrationReferenceOption[];
  weight: {
    minKg: number;
    maxKg: number;
  };
}

function parseConfiguredNumber(value: number | string | null, fieldName: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (value === null || !Number.isFinite(parsed)) {
    throw new HttpError(
      500,
      "REGISTRATION_REFERENCE_DATA_MISSING",
      `${fieldName} is not configured`,
    );
  }
  return parsed;
}

export async function getRegistrationOptions(): Promise<RegistrationOptions> {
  const [genderRows, fitnessRows, weightAttribute] = await Promise.all([
    db<RegistrationReferenceRow>("genders").select("code", "description").orderBy("code", "asc"),
    db<RegistrationReferenceRow>("fitness_levels")
      .select("code", "description")
      .orderBy("code", "asc"),
    db<WeightAttributeRow>("bio_attributes")
      .select("min_value_metric", "max_value_metric")
      .where({ key: "weight_kg" })
      .first(),
  ]);

  if (!weightAttribute) {
    throw new HttpError(
      500,
      "REGISTRATION_REFERENCE_DATA_MISSING",
      "Weight reference data is not configured",
    );
  }

  const minKg = parseConfiguredNumber(weightAttribute.min_value_metric, "weight minKg");
  const maxKg = parseConfiguredNumber(weightAttribute.max_value_metric, "weight maxKg");

  if (minKg >= maxKg) {
    throw new HttpError(
      500,
      "REGISTRATION_REFERENCE_DATA_INVALID",
      "Configured weight range is invalid",
    );
  }

  return {
    genders: genderRows.map((row) => ({
      code: row.code,
      description: row.description,
    })),
    fitnessLevels: fitnessRows.map((row) => ({
      code: row.code,
      description: row.description,
    })),
    weight: { minKg, maxKg },
  };
}

export async function assertRegistrationReferenceValues(input: {
  gender?: string;
  fitnessLevel?: string;
  weightKg?: number;
}): Promise<void> {
  const options = await getRegistrationOptions();

  if (input.gender && !options.genders.some((option) => option.code === input.gender)) {
    throw new HttpError(422, "VALIDATION_ERROR", "Unsupported gender reference value");
  }

  if (
    input.fitnessLevel &&
    !options.fitnessLevels.some((option) => option.code === input.fitnessLevel)
  ) {
    throw new HttpError(422, "VALIDATION_ERROR", "Unsupported fitness level reference value");
  }

  if (
    input.weightKg !== undefined &&
    (input.weightKg < options.weight.minKg || input.weightKg > options.weight.maxKg)
  ) {
    throw new HttpError(422, "VALIDATION_ERROR", "Weight is outside the configured range");
  }
}
