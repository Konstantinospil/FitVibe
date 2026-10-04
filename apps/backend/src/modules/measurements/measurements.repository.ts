import crypto from "node:crypto";
import type { Knex } from "knex";
import { db } from "../../db/connection.js";
import type {
  DerivedOperator,
  MeasurementSystem,
  MeasurementUnitType,
} from "./measurements.types.js";

export interface MeasurementAttributeRow {
  id: string;
  key: string;
  normalized_key: string;
  label: string;
  description: string | null;
  unit_type: MeasurementUnitType;
  granularity: string;
  measurement_system: MeasurementSystem;
  min_value_metric: number | string | null;
  max_value_metric: number | string | null;
  min_value_imperial: number | string | null;
  max_value_imperial: number | string | null;
  is_default: boolean;
  derived_from_a_id: string | null;
  derived_from_b_id: string | null;
  derived_operator: DerivedOperator | null;
  created_at: string;
  updated_at: string;
}

export interface MeasurementValueRow {
  id: string;
  user_id: string;
  attribute_id: string;
  value_number: number | string;
  measured_at: string;
  created_at: string;
}

export interface LatestBioValue {
  key: string;
  valueNumber: number;
  measuredAt: string;
}

export interface MeasurementSelectionRow {
  user_id: string;
  attribute_id: string;
  is_visible: boolean;
  created_at: string;
}

type AttributeTable = "bio_attributes" | "perf_attributes";
type ValueTable = "bio_attribute_values" | "perf_attribute_values";
type SelectionTable = "bio_attribute_selections" | "perf_attribute_selections";

function attributesTable(category: "bio" | "perf"): AttributeTable {
  return category === "bio" ? "bio_attributes" : "perf_attributes";
}

function valuesTable(category: "bio" | "perf"): ValueTable {
  return category === "bio" ? "bio_attribute_values" : "perf_attribute_values";
}

function selectionsTable(category: "bio" | "perf"): SelectionTable {
  return category === "bio" ? "bio_attribute_selections" : "perf_attribute_selections";
}

export async function listAttributes(
  category: "bio" | "perf",
  q?: string,
  lang?: string,
): Promise<MeasurementAttributeRow[]> {
  const table = attributesTable(category);
  const query = db<MeasurementAttributeRow>({ a: table })
    .select("a.*")
    .orderBy("a.created_at", "asc");

  if (lang) {
    query.leftJoin({ t: "translations" }, function joinTranslations() {
      this.on("t.namespace", db.raw("?", ["user_attributes"]))
        .andOn("t.language", db.raw("?", [lang]))
        .andOnNull("t.deleted_at")
        .andOn("t.key_path", db.raw("concat('user_attributes.', ??)", ["a.key"]));
    });
  }

  if (q) {
    const trimmed = q.trim();
    if (trimmed) {
      query.where((builder) => {
        builder.whereILike("a.label", `%${trimmed}%`).orWhereILike("a.key", `%${trimmed}%`);
        if (lang) {
          builder.orWhereILike("t.value", `%${trimmed}%`);
        }
      });
    }
  }
  const rows = (await query) as MeasurementAttributeRow[];
  return rows;
}

export async function getAttributeById(
  category: "bio" | "perf",
  attributeId: string,
  trx?: Knex.Transaction,
) {
  const table = attributesTable(category);
  const row = await (trx ?? db)<MeasurementAttributeRow>(table).where({ id: attributeId }).first();
  return row ?? null;
}

export async function getAttributeByNormalizedKey(
  category: "bio" | "perf",
  normalizedKey: string,
  trx?: Knex.Transaction,
) {
  const table = attributesTable(category);
  const row = await (trx ?? db)<MeasurementAttributeRow>(table)
    .where({ normalized_key: normalizedKey })
    .first();
  return row ?? null;
}

export async function insertAttribute(
  category: "bio" | "perf",
  row: Omit<MeasurementAttributeRow, "id" | "created_at" | "updated_at">,
  trx?: Knex.Transaction,
) {
  const table = attributesTable(category);
  const now = new Date().toISOString();
  const [record] = (await (trx ?? db)(table)
    .insert({
      ...row,
      created_at: now,
      updated_at: now,
    })
    .returning("id")) as Array<{ id: string }>;
  return record.id;
}

export async function withMeasurementTransaction<T>(
  work: (trx: Knex.Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(work);
}

export async function listLatestAttributeValues(category: "bio" | "perf", userId: string) {
  const table = valuesTable(category);
  const result = await db.raw<{ rows: MeasurementValueRow[] }>(
    `
      SELECT DISTINCT ON (attribute_id)
        id,
        user_id,
        attribute_id,
        value_number,
        measured_at,
        created_at
      FROM ${table}
      WHERE user_id = ?
        AND deactivated_at IS NULL
      ORDER BY attribute_id, measured_at DESC, created_at DESC
    `,
    [userId],
  );
  return result.rows ?? [];
}

/**
 * Returns the latest active biological measurement for each requested key.
 * Missing or deactivated measurements are omitted from the result.
 */
export async function getLatestBioValuesByKeys<K extends string>(
  userId: string,
  keys: readonly K[],
): Promise<Partial<Record<K, LatestBioValue>>> {
  if (keys.length === 0) {
    return {};
  }

  const result = await db.raw<{
    rows: Array<{ key: K; value_number: number | string; measured_at: string }>;
  }>(
    `
      SELECT DISTINCT ON (a.key)
        a.key,
        v.value_number,
        v.measured_at
      FROM bio_attribute_values v
      INNER JOIN bio_attributes a ON a.id = v.attribute_id
      WHERE v.user_id = ?
        AND a.key = ANY(?::text[])
        AND v.deactivated_at IS NULL
        AND a.deactivated_at IS NULL
      ORDER BY a.key, v.measured_at DESC, v.created_at DESC
    `,
    [userId, [...keys]],
  );

  return (result.rows ?? []).reduce<Partial<Record<K, LatestBioValue>>>((values, row) => {
    values[row.key] = {
      key: row.key,
      valueNumber: Number(row.value_number),
      measuredAt: row.measured_at,
    };
    return values;
  }, {});
}

export async function insertAttributeValue(
  category: "bio" | "perf",
  userId: string,
  attributeId: string,
  valueNumber: number,
  measuredAt?: string,
  trx?: Knex.Transaction,
) {
  const exec = trx ?? db;
  const table = valuesTable(category);
  const now = new Date().toISOString();
  const [record] = (await exec(table)
    .insert({
      id: crypto.randomUUID(),
      user_id: userId,
      attribute_id: attributeId,
      value_number: valueNumber,
      measured_at: measuredAt ?? now,
      created_at: now,
    })
    .returning("id")) as Array<{ id: string }>;
  return record.id;
}

export async function listSelections(category: "bio" | "perf", userId: string) {
  const table = selectionsTable(category);
  return db<MeasurementSelectionRow>(table).where({ user_id: userId });
}

export async function upsertSelection(
  category: "bio" | "perf",
  userId: string,
  attributeId: string,
  isVisible: boolean,
) {
  const table = selectionsTable(category);
  const now = new Date().toISOString();
  return db(table)
    .insert({
      user_id: userId,
      attribute_id: attributeId,
      is_visible: isVisible,
      created_at: now,
    })
    .onConflict(["user_id", "attribute_id"])
    .merge({ is_visible: isVisible });
}
