import { apiClient } from "./httpApi";

export type MeasurementCategory = "bio" | "perf";
export type MeasurementUnitType =
  "length" | "weight" | "volume" | "ratio" | "count" | "time" | "power" | "percentage";

export interface MeasurementValue {
  attributeId: string;
  valueNumber: number;
  measuredAt: string;
}

export interface MeasurementAttribute {
  id: string;
  key: string;
  normalizedKey: string;
  label: string;
  description: string | null;
  unitType: MeasurementUnitType;
  granularity: string;
  measurementSystem: "metric" | "imperial";
  minValueMetric: number | null;
  maxValueMetric: number | null;
  minValueImperial: number | null;
  maxValueImperial: number | null;
  isDefault: boolean;
  derivedFromAId: string | null;
  derivedFromBId: string | null;
  derivedOperator: "ratio" | null;
  createdAt: string;
  updatedAt: string;
  latestValue: MeasurementValue | null;
  isVisible: boolean;
}

function collectionPath(category: MeasurementCategory): string {
  return category === "bio" ? "biometrics" : "performance";
}

export async function listMeasurementAttributes(
  category: MeasurementCategory,
  options?: { lang?: string; q?: string; includeHidden?: boolean },
): Promise<MeasurementAttribute[]> {
  const res = await apiClient.get<{ attributes: MeasurementAttribute[] }>(
    `/api/v1/measurements/${collectionPath(category)}/attributes`,
    {
      params: {
        ...(options?.lang ? { lang: options.lang } : {}),
        ...(options?.q ? { q: options.q } : {}),
        ...(options?.includeHidden ? { includeHidden: "true" } : {}),
      },
    },
  );
  return res.data.attributes;
}

export async function listEnabledMeasurementAttributes(
  category: MeasurementCategory,
  lang?: string,
): Promise<MeasurementAttribute[]> {
  return listMeasurementAttributes(category, { lang });
}

export async function addMeasurementValue(
  category: MeasurementCategory,
  attributeId: string,
  payload: { valueNumber: number; measuredAt?: string },
): Promise<MeasurementValue> {
  const res = await apiClient.post<{ latestValue: MeasurementValue }>(
    `/api/v1/measurements/${collectionPath(category)}/attributes/${attributeId}/values`,
    payload,
  );
  return res.data.latestValue;
}

export async function updateMeasurementVisibility(
  category: MeasurementCategory,
  attributeId: string,
  isVisible: boolean,
): Promise<void> {
  await apiClient.put(
    `/api/v1/measurements/${collectionPath(category)}/attributes/${attributeId}/visibility`,
    { isVisible },
  );
}
