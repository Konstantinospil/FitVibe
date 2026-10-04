import { db } from "../../db/connection.js";
import type { Knex } from "knex";
import type {
  TranslationRecord,
  TranslationInsert,
  TranslationUpdate,
  SupportedLanguage,
  TranslationNamespace,
} from "./translations.types.js";

const TRANSLATIONS_TABLE = "translations";

function withDb(trx?: Knex.Transaction) {
  return trx ?? db;
}

export async function withTranslationTransaction<T>(
  work: (trx: Knex.Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(work);
}

async function lockTranslationKey(
  trx: Knex.Transaction,
  language: SupportedLanguage,
  namespace: TranslationNamespace,
  keyPath: string,
): Promise<void> {
  const lockKey = `${namespace}:${language}:${keyPath}`;
  await trx.raw("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", [lockKey]);
}

/**
 * Get all translations for a language and optional namespace
 * Returns a flat object with dot-notation keys
 * Only returns active (non-deleted) translations
 */
export async function getTranslations(
  language: SupportedLanguage,
  namespace?: TranslationNamespace,
): Promise<Record<string, string>> {
  // Get only the latest active version for each key_path
  let query = db(TRANSLATIONS_TABLE)
    .select("key_path", "value")
    .where("language", language)
    .whereNull("deleted_at");

  if (namespace) {
    query = query.where("namespace", namespace);
  }

  const rows = (await query) as Array<{ key_path: string; value: string }>;
  const result: Record<string, string> = {};

  for (const row of rows) {
    result[row.key_path] = row.value;
  }

  return result;
}

/**
 * Get translations as nested object structure (for i18next format)
 */
export async function getTranslationsNested(
  language: SupportedLanguage,
  namespace?: TranslationNamespace,
): Promise<Record<string, unknown>> {
  const flat = await getTranslations(language, namespace);
  const nested: Record<string, unknown> = {};

  for (const [keyPath, value] of Object.entries(flat)) {
    const keys = keyPath.split(".");
    let current: Record<string, unknown> = nested;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== "object" || current[key] === null) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    current[keys[keys.length - 1]] = value;
  }

  return nested;
}

/**
 * Get a single translation by key path
 * Returns active or deleted translations
 */
export async function getTranslation(
  language: SupportedLanguage,
  namespace: TranslationNamespace,
  keyPath: string,
  includeDeleted = false,
  trx?: Knex.Transaction,
): Promise<TranslationRecord | undefined> {
  let query = withDb(trx)(TRANSLATIONS_TABLE).where({
    language,
    namespace,
    key_path: keyPath,
  });

  if (!includeDeleted) {
    query = query.whereNull("deleted_at");
  }

  return (await query.first()) as TranslationRecord | undefined;
}

/**
 * Create a new translation
 * If a deleted translation exists, restores it by making it active again
 * With the partial unique index, we can check for deleted translations and restore them
 */
export async function createTranslation(
  data: TranslationInsert,
  trx?: Knex.Transaction,
): Promise<TranslationRecord> {
  const work = async (transaction: Knex.Transaction): Promise<TranslationRecord> => {
    await lockTranslationKey(transaction, data.language, data.namespace, data.key_path);

    const active = await transaction(TRANSLATIONS_TABLE)
      .where({
        language: data.language,
        namespace: data.namespace,
        key_path: data.key_path,
      })
      .whereNull("deleted_at")
      .first<TranslationRecord>();

    if (active) {
      const updated = await updateTranslation(
        data.language,
        data.namespace,
        data.key_path,
        { value: data.value },
        data.updated_by ?? null,
        transaction,
      );
      if (!updated) {
        throw new Error(
          `Failed to update active translation for ${data.namespace}.${data.key_path} (${data.language})`,
        );
      }
      return updated;
    }

    const deleted = await transaction(TRANSLATIONS_TABLE)
      .where({
        language: data.language,
        namespace: data.namespace,
        key_path: data.key_path,
      })
      .whereNotNull("deleted_at")
      .orderBy("deleted_at", "desc")
      .first<TranslationRecord>();

    if (deleted) {
      const [record] = (await transaction(TRANSLATIONS_TABLE)
        .where({ id: deleted.id })
        .update({
          value: data.value,
          deleted_at: null,
          updated_at: db.fn.now(),
          updated_by: data.updated_by ?? null,
        })
        .returning("*")) as [TranslationRecord];

      if (!record) {
        throw new Error(
          `Failed to restore deleted translation for ${data.namespace}.${data.key_path} (${data.language})`,
        );
      }
      return record;
    }

    const [record] = (await transaction(TRANSLATIONS_TABLE).insert(data).returning("*")) as [
      TranslationRecord,
    ];
    return record;
  };

  return trx ? work(trx) : db.transaction(work);
}

export async function updateTranslation(
  language: SupportedLanguage,
  namespace: TranslationNamespace,
  keyPath: string,
  updates: TranslationUpdate,
  userId?: string | null,
  trx?: Knex.Transaction,
): Promise<TranslationRecord | undefined> {
  const work = async (transaction: Knex.Transaction): Promise<TranslationRecord | undefined> => {
    await lockTranslationKey(transaction, language, namespace, keyPath);

    const existing = await transaction(TRANSLATIONS_TABLE)
      .where({ language, namespace, key_path: keyPath })
      .whereNull("deleted_at")
      .first<TranslationRecord>();

    if (!existing) {
      return undefined;
    }

    const now = new Date().toISOString();
    const retired = await transaction(TRANSLATIONS_TABLE)
      .where({ id: existing.id, deleted_at: null })
      .update({
        deleted_at: now,
        updated_at: now,
        updated_by: userId ?? null,
      });

    if (retired !== 1) {
      throw new Error(`Translation changed concurrently for ${namespace}.${keyPath} (${language})`);
    }

    const [newRecord] = (await transaction(TRANSLATIONS_TABLE)
      .insert({
        namespace: existing.namespace,
        key_path: existing.key_path,
        language: existing.language,
        value: updates.value ?? existing.value,
        created_at: now,
        updated_at: now,
        created_by: userId ?? existing.created_by,
        updated_by: userId ?? null,
      })
      .returning("*")) as [TranslationRecord];

    return newRecord;
  };

  return trx ? work(trx) : db.transaction(work);
}

export async function upsertTranslation(
  data: TranslationInsert,
  trx?: Knex.Transaction,
): Promise<TranslationRecord> {
  const work = async (transaction: Knex.Transaction): Promise<TranslationRecord> => {
    await lockTranslationKey(transaction, data.language, data.namespace, data.key_path);

    const active = await transaction(TRANSLATIONS_TABLE)
      .where({
        language: data.language,
        namespace: data.namespace,
        key_path: data.key_path,
      })
      .whereNull("deleted_at")
      .first<TranslationRecord>();

    if (active) {
      const [record] = (await transaction(TRANSLATIONS_TABLE)
        .where({ id: active.id, deleted_at: null })
        .update({
          value: data.value,
          updated_at: db.fn.now(),
          updated_by: data.updated_by ?? null,
        })
        .returning("*")) as [TranslationRecord];

      if (!record) {
        throw new Error(
          `Failed to update active translation for ${data.namespace}.${data.key_path} (${data.language})`,
        );
      }
      return record;
    }

    const deleted = await transaction(TRANSLATIONS_TABLE)
      .where({
        language: data.language,
        namespace: data.namespace,
        key_path: data.key_path,
      })
      .whereNotNull("deleted_at")
      .orderBy("deleted_at", "desc")
      .first<TranslationRecord>();

    if (deleted) {
      const [record] = (await transaction(TRANSLATIONS_TABLE)
        .where({ id: deleted.id })
        .update({
          value: data.value,
          deleted_at: null,
          updated_at: db.fn.now(),
          updated_by: data.updated_by ?? null,
        })
        .returning("*")) as [TranslationRecord];

      if (!record) {
        throw new Error(
          `Failed to restore deleted translation for ${data.namespace}.${data.key_path} (${data.language})`,
        );
      }
      return record;
    }

    const [record] = (await transaction(TRANSLATIONS_TABLE).insert(data).returning("*")) as [
      TranslationRecord,
    ];
    return record;
  };

  return trx ? work(trx) : db.transaction(work);
}

export async function deleteTranslation(
  language: SupportedLanguage,
  namespace: TranslationNamespace,
  keyPath: string,
  trx?: Knex.Transaction,
): Promise<boolean> {
  const updated = await withDb(trx)(TRANSLATIONS_TABLE)
    .where({
      language,
      namespace,
      key_path: keyPath,
    })
    .whereNull("deleted_at")
    .update({
      deleted_at: db.fn.now(),
      updated_at: db.fn.now(),
    });

  return updated > 0;
}

export async function updateMeasurementAttributeLabel(
  attributeKey: string,
  label: string,
  trx?: Knex.Transaction,
): Promise<void> {
  const dbInstance = withDb(trx);
  await Promise.all([
    dbInstance("bio_attributes").where({ key: attributeKey }).update({ label }),
    dbInstance("perf_attributes").where({ key: attributeKey }).update({ label }),
  ]);
}

/**
 * List all translations with pagination
 */
export async function listTranslations(
  filters?: {
    language?: SupportedLanguage;
    namespace?: TranslationNamespace;
    search?: string;
    keyPath?: string;
    activeOnly?: boolean;
  },
  pagination?: {
    limit?: number;
    offset?: number;
  },
): Promise<{ translations: TranslationRecord[]; total: number }> {
  let query = db(TRANSLATIONS_TABLE).select("*");

  if (filters?.language) {
    query = query.where("language", filters.language);
  }

  if (filters?.namespace) {
    query = query.where("namespace", filters.namespace);
  }

  if (filters?.keyPath) {
    query = query.where("key_path", "ilike", `%${filters.keyPath}%`);
  }

  if (filters?.search) {
    query = query.where(function () {
      this.where("key_path", "ilike", `%${filters.search}%`).orWhere(
        "value",
        "ilike",
        `%${filters.search}%`,
      );
    });
  }

  // Filter by active status
  // Default: show only active records (deleted_at IS NULL)
  // When activeOnly is explicitly false, show all records (including deleted)
  // When activeOnly is true or undefined, show only active records
  if (filters?.activeOnly === false) {
    // Show all including deleted - no filter applied
  } else {
    // Default: show only active (deleted_at IS NULL)
    query = query.whereNull("deleted_at");
  }

  // Get total count
  const countQuery = query.clone().clearSelect().clearOrder().count("* as total").first();
  const { total } = (await countQuery) as { total: string | number };
  const totalCount = typeof total === "string" ? parseInt(total, 10) : total;

  // Apply pagination
  if (pagination?.limit) {
    query = query.limit(pagination.limit);
  }
  if (pagination?.offset) {
    query = query.offset(pagination.offset);
  }

  // Order by language, namespace, key_path for consistent display
  query = query.orderBy("language").orderBy("namespace").orderBy("key_path");

  const translations = (await query) as TranslationRecord[];

  return {
    translations,
    total: totalCount,
  };
}

export async function getLatestNamespaceUpdates(): Promise<
  Array<{ namespace: TranslationNamespace; updated_at: string | null }>
> {
  const rows = (await db(TRANSLATIONS_TABLE)
    .select("namespace")
    .max("created_at as updated_at")
    .whereNull("deleted_at")
    .groupBy("namespace")) as Array<{ namespace: TranslationNamespace; updated_at: Date | string }>;

  return rows.map((row) => ({
    namespace: row.namespace,
    updated_at:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : (row.updated_at ?? null),
  }));
}

export async function getTranslationMetadata(): Promise<{
  languages: SupportedLanguage[];
  namespaces: TranslationNamespace[];
}> {
  const languageRows = (await db(TRANSLATIONS_TABLE)
    .distinct("language")
    .whereNull("deleted_at")
    .orderBy("language")) as Array<{ language: SupportedLanguage }>;

  const namespaceRows = (await db(TRANSLATIONS_TABLE)
    .distinct("namespace")
    .whereNull("deleted_at")
    .orderBy("namespace")) as Array<{ namespace: TranslationNamespace }>;

  return {
    languages: languageRows.map((row) => row.language),
    namespaces: namespaceRows.map((row) => row.namespace),
  };
}

export async function getNamespacesForLanguage(
  language: SupportedLanguage,
): Promise<TranslationNamespace[]> {
  const rows = (await db(TRANSLATIONS_TABLE)
    .distinct("namespace")
    .where({ language })
    .whereNull("deleted_at")
    .orderBy("namespace")) as Array<{ namespace: TranslationNamespace }>;

  return rows.map((row) => row.namespace);
}
