import type { Knex } from "knex";
import { db } from "../../db/connection.js";
import type {
  LegalDocumentAcceptanceRow,
  LegalDocumentSnapshotRow,
  LegalDocumentType,
  LegalDocumentVersionRow,
  LegalUserAction,
} from "./legal.types.js";

const VERSION_TABLE = "legal_document_versions";
const SNAPSHOT_TABLE = "legal_document_snapshots";
const ACCEPTANCE_TABLE = "legal_document_acceptances";

export async function withLegalTransaction<T>(
  work: (trx: Knex.Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(work);
}

export async function lockLegalDocument(
  documentType: LegalDocumentType,
  trx: Knex.Transaction,
): Promise<void> {
  await trx.raw("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", [
    `legal-publication:${documentType}`,
  ]);
}

export async function getCurrentLegalVersion(
  documentType: LegalDocumentType,
  trx?: Knex.Transaction,
): Promise<LegalDocumentVersionRow | null> {
  const row = await (trx ?? db)<LegalDocumentVersionRow>(VERSION_TABLE)
    .where({ document_type: documentType })
    .where("effective_at", "<=", new Date().toISOString())
    .orderBy("effective_at", "desc")
    .orderBy("published_at", "desc")
    .first();
  return row ?? null;
}

export async function getLatestRequiredLegalVersion(
  documentType: LegalDocumentType,
): Promise<LegalDocumentVersionRow | null> {
  const row = await db<LegalDocumentVersionRow>(VERSION_TABLE)
    .where({ document_type: documentType })
    .where("effective_at", "<=", new Date().toISOString())
    .whereNot("user_action", "none")
    .orderBy("effective_at", "desc")
    .orderBy("published_at", "desc")
    .first();
  return row ?? null;
}

export async function getLegalVersionById(
  versionId: string,
  trx?: Knex.Transaction,
): Promise<LegalDocumentVersionRow | null> {
  const row = await (trx ?? db)<LegalDocumentVersionRow>(VERSION_TABLE)
    .where({ id: versionId })
    .first();
  return row ?? null;
}

export async function listLegalVersions(
  documentType?: LegalDocumentType,
): Promise<LegalDocumentVersionRow[]> {
  let query = db<LegalDocumentVersionRow>(VERSION_TABLE)
    .select("*")
    .orderBy("effective_at", "desc")
    .orderBy("published_at", "desc");
  if (documentType) {
    query = query.where({ document_type: documentType });
  }
  return query;
}

export async function getLegalSnapshot(
  versionId: string,
  language: string,
): Promise<LegalDocumentSnapshotRow | null> {
  const row = await db<LegalDocumentSnapshotRow>(SNAPSHOT_TABLE)
    .where({ version_id: versionId, language })
    .first();
  return row ?? null;
}

export async function listSnapshotLanguages(versionId: string): Promise<string[]> {
  const rows = (await db(SNAPSHOT_TABLE)
    .select("language")
    .where({ version_id: versionId })
    .orderBy("language")) as Array<{ language: string }>;
  return rows.map((row) => row.language);
}

export async function getActiveLegalTranslationRows(
  documentType: LegalDocumentType,
  trx: Knex.Transaction,
): Promise<Array<{ language: string; key_path: string; value: string }>> {
  return trx("translations")
    .select("language", "key_path", "value")
    .where({ namespace: documentType })
    .whereNull("deleted_at")
    .orderBy("language")
    .orderBy("key_path");
}

export async function getVersionStringsByPrefix(
  documentType: LegalDocumentType,
  prefix: string,
  trx: Knex.Transaction,
): Promise<string[]> {
  const rows = (await trx(VERSION_TABLE)
    .select("version")
    .where({ document_type: documentType })
    .andWhere("version", "like", `${prefix}%`)) as Array<{ version: string }>;
  return rows.map((row) => row.version);
}

export async function insertLegalVersion(
  row: Omit<LegalDocumentVersionRow, "id" | "created_at">,
  trx: Knex.Transaction,
): Promise<LegalDocumentVersionRow> {
  const [created] = (await trx(VERSION_TABLE)
    .insert(row)
    .returning("*")) as LegalDocumentVersionRow[];
  return created;
}

export async function insertLegalSnapshot(
  row: Omit<LegalDocumentSnapshotRow, "id" | "created_at">,
  trx: Knex.Transaction,
): Promise<void> {
  await trx(SNAPSHOT_TABLE).insert(row);
}

export async function recordLegalAcceptance(
  userId: string,
  versionId: string,
  action: Exclude<LegalUserAction, "none">,
  acceptedAt: string,
  source: string,
  trx?: Knex.Transaction,
): Promise<void> {
  await (trx ?? db)(ACCEPTANCE_TABLE)
    .insert({
      user_id: userId,
      version_id: versionId,
      action,
      source,
      accepted_at: acceptedAt,
    })
    .onConflict(["user_id", "version_id"])
    .merge({ action, source, accepted_at: acceptedAt, revoked_at: null });
}

export async function getAcceptanceForVersion(
  userId: string,
  versionId: string,
): Promise<LegalDocumentAcceptanceRow | null> {
  const row = await db<LegalDocumentAcceptanceRow>(ACCEPTANCE_TABLE)
    .where({ user_id: userId, version_id: versionId })
    .whereNull("revoked_at")
    .first();
  return row ?? null;
}

export type LegalAcceptanceWithVersion = LegalDocumentAcceptanceRow & {
  version: string;
  version_effective_at: string;
  version_published_at: string;
};

export async function getLatestAcceptanceForDocument(
  userId: string,
  documentType: LegalDocumentType,
): Promise<LegalAcceptanceWithVersion | null> {
  const row = await db(`${ACCEPTANCE_TABLE} as a`)
    .join(`${VERSION_TABLE} as v`, "v.id", "a.version_id")
    .where("a.user_id", userId)
    .andWhere("v.document_type", documentType)
    .whereNull("a.revoked_at")
    .select(
      "a.*",
      "v.version",
      "v.effective_at as version_effective_at",
      "v.published_at as version_published_at",
    )
    .orderBy("a.accepted_at", "desc")
    .first<LegalAcceptanceWithVersion>();
  return row ?? null;
}

export async function revokeLegalAcceptances(
  userId: string,
  documentType: LegalDocumentType,
  revokedAt: string,
  trx?: Knex.Transaction,
): Promise<number> {
  const exec = trx ?? db;
  return exec(ACCEPTANCE_TABLE)
    .where({ user_id: userId })
    .whereNull("revoked_at")
    .whereIn("version_id", exec(VERSION_TABLE).select("id").where({ document_type: documentType }))
    .update({ revoked_at: revokedAt });
}
