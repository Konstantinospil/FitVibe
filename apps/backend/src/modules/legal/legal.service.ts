import crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Knex } from "knex";
import { HttpError } from "../../utils/http.js";
import { insertAudit } from "../common/audit.util.js";
import {
  getLegalDocumentDefinition,
  getLegalLanguageDefinition,
  LEGAL_DOCUMENT_REGISTRY,
  LEGAL_DOCUMENT_TYPES,
  SUPPORTED_LEGAL_LANGUAGES,
  toSupportedLegalLanguage,
} from "./legal.registry.js";
import type { SupportedLegalLanguage } from "./legal.registry.js";
import {
  getActiveLegalTranslationRows,
  getCurrentLegalVersion,
  getLatestAcceptanceForDocument,
  getLatestRequiredLegalVersion,
  getLegalSnapshot,
  getLegalVersionById,
  getVersionStringsByPrefix,
  insertLegalSnapshot,
  insertLegalVersion,
  listLegalVersions,
  listSnapshotLanguages,
  lockLegalDocument,
  recordLegalAcceptance,
  revokeLegalAcceptances,
  withLegalTransaction,
} from "./legal.repository.js";
import type {
  LegalChangeClass,
  LegalDocumentContent,
  LegalDocumentType,
  LegalDocumentVersionRow,
  LegalUserAction,
  PublishLegalDocumentInput,
  PublishedLegalDocument,
} from "./legal.types.js";

function assertPublicationPolicy(
  documentType: LegalDocumentType,
  changeClass: Exclude<LegalChangeClass, "legacy">,
  userAction: LegalUserAction,
): void {
  const definition = getLegalDocumentDefinition(documentType);
  if (!(definition.allowedActions as readonly LegalUserAction[]).includes(userAction)) {
    throw new HttpError(400, "LEGAL_ACTION_INVALID", "Invalid user action for legal document");
  }
  if (changeClass === "editorial" && userAction !== "none") {
    throw new HttpError(
      400,
      "LEGAL_EDITORIAL_ACTION_INVALID",
      "Editorial changes cannot require renewed user action",
    );
  }
  if (changeClass === "material" && userAction === "none") {
    throw new HttpError(
      400,
      "LEGAL_MATERIAL_ACTION_REQUIRED",
      "Material changes must define the required user action",
    );
  }
}

function normalizeEffectiveAt(value?: string): string {
  if (!value) {
    return new Date().toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, "LEGAL_EFFECTIVE_AT_INVALID", "Invalid effective date");
  }
  return parsed.toISOString();
}

function setNestedValue(
  target: Record<string, unknown>,
  pathParts: string[],
  value: unknown,
): void {
  let current = target;
  for (let index = 0; index < pathParts.length - 1; index += 1) {
    const key = pathParts[index];
    const existing = current[key];
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[pathParts[pathParts.length - 1]] = value;
}

function loadAuthoringDocument(
  documentType: LegalDocumentType,
  language: SupportedLegalLanguage,
): Record<string, unknown> | null {
  const { filename } = getLegalDocumentDefinition(documentType);
  const { directory } = getLegalLanguageDefinition(language);
  const candidates = [
    path.resolve(process.cwd(), "legal-authoring-locales", directory, filename),
    path.resolve(
      process.cwd(),
      "apps",
      "frontend",
      "src",
      "i18n",
      "locales",
      directory,
      filename,
    ),
    path.resolve(
      process.cwd(),
      "..",
      "frontend",
      "src",
      "i18n",
      "locales",
      directory,
      filename,
    ),
  ];

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) {
        continue;
      }
      const parsed = JSON.parse(fs.readFileSync(candidate, "utf8")) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try the next candidate. Publication will fail below if no source is available.
    }
  }
  return null;
}

function cloneDocument(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function buildSnapshots(
  documentType: LegalDocumentType,
  rows: Array<{ language: string; key_path: string; value: string }>,
): Map<string, Record<string, unknown>> {
  const normalizedRows = rows.map((row) => {
    const language = toSupportedLegalLanguage(row.language);
    if (!language) {
      throw new HttpError(
        409,
        "LEGAL_LANGUAGE_UNSUPPORTED",
        "Cannot publish legal content for an unsupported language",
      );
    }
    return { ...row, language };
  });
  const languages = new Set<SupportedLegalLanguage>(SUPPORTED_LEGAL_LANGUAGES);
  const snapshots = new Map<string, Record<string, unknown>>();

  for (const language of languages) {
    const base = loadAuthoringDocument(documentType, language);
    if (base) {
      snapshots.set(language, cloneDocument(base));
    }
  }

  for (const row of normalizedRows) {
    const content = snapshots.get(row.language) ?? {};
    const prefix = `${documentType}.`;
    const relativePath = row.key_path.startsWith(prefix)
      ? row.key_path.slice(prefix.length)
      : row.key_path;
    const keys = relativePath.split(".").filter(Boolean);
    if (keys.length === 0) {
      continue;
    }
    setNestedValue(content, keys, row.value);
    snapshots.set(row.language, content);
  }
  return snapshots;
}

function hashSnapshot(content: Record<string, unknown>): string {
  return crypto.createHash("sha256").update(JSON.stringify(content)).digest("hex");
}

function nextVersion(prefix: string, existing: string[]): string {
  let highest = 0;
  for (const version of existing) {
    const match = new RegExp(`^${prefix}\\.(\\d+)$`).exec(version);
    if (match) {
      highest = Math.max(highest, Number(match[1]));
    }
  }
  return `${prefix}.${highest + 1}`;
}

export async function publishLegalDocument(
  input: PublishLegalDocumentInput,
  publishedBy: string,
): Promise<PublishedLegalDocument> {
  assertPublicationPolicy(input.documentType, input.changeClass, input.userAction);
  const effectiveAt = normalizeEffectiveAt(input.effectiveAt);
  const publishedAt = new Date().toISOString();

  const publication = await withLegalTransaction(async (trx) => {
    await lockLegalDocument(input.documentType, trx);

    const rows = await getActiveLegalTranslationRows(input.documentType, trx);
    if (rows.length === 0) {
      throw new HttpError(
        409,
        "LEGAL_TRANSLATIONS_EMPTY",
        "Cannot publish a legal document without active translations",
      );
    }

    const snapshots = buildSnapshots(input.documentType, rows);
    if (snapshots.size === 0) {
      throw new HttpError(
        409,
        "LEGAL_SNAPSHOT_EMPTY",
        "Cannot publish an empty legal document snapshot",
      );
    }

    const prefix = publishedAt.slice(0, 10);
    const existing = await getVersionStringsByPrefix(input.documentType, prefix, trx);
    const version = nextVersion(prefix, existing);

    const created = await insertLegalVersion(
      {
        document_type: input.documentType,
        version,
        change_class: input.changeClass,
        user_action: input.userAction,
        effective_at: effectiveAt,
        published_at: publishedAt,
        published_by: publishedBy,
        source: "backoffice",
      },
      trx,
    );

    for (const [language, content] of snapshots.entries()) {
      await insertLegalSnapshot(
        {
          version_id: created.id,
          language,
          content,
          content_hash: hashSnapshot(content),
        },
        trx,
      );
    }

    return { created, languages: [...snapshots.keys()].sort() };
  });

  await insertAudit({
    actorUserId: publishedBy,
    entityType: "legal_document_version",
    action: "publish",
    entityId: publication.created.id,
    outcome: "success",
    metadata: {
      documentType: publication.created.document_type,
      version: publication.created.version,
      changeClass: publication.created.change_class,
      userAction: publication.created.user_action,
      effectiveAt: publication.created.effective_at,
      languages: publication.languages,
    },
  });

  return {
    id: publication.created.id,
    documentType: publication.created.document_type,
    version: publication.created.version,
    changeClass: publication.created.change_class,
    userAction: publication.created.user_action,
    effectiveAt: publication.created.effective_at,
    publishedAt: publication.created.published_at,
    publishedBy: publication.created.published_by,
    languages: publication.languages,
  };
}

export async function getCurrentLegalPublication(
  documentType: LegalDocumentType,
): Promise<LegalDocumentVersionRow> {
  const version = await getCurrentLegalVersion(documentType);
  if (!version) {
    throw new HttpError(
      503,
      "LEGAL_VERSION_UNAVAILABLE",
      "No effective legal version is published",
    );
  }
  return version;
}

export async function getCurrentLegalVersions(): Promise<Record<LegalDocumentType, string>> {
  const entries = await Promise.all(
    LEGAL_DOCUMENT_TYPES.map(async (documentType) => {
      const publication = await getCurrentLegalPublication(documentType);
      return [documentType, publication.version] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<LegalDocumentType, string>;
}

export async function getCurrentLegalDocument(
  documentType: LegalDocumentType,
  language: string,
): Promise<LegalDocumentContent> {
  const publication = await getCurrentLegalPublication(documentType);
  const requested = await getLegalSnapshot(publication.id, language);
  const fallback =
    requested ?? (language === "en" ? null : await getLegalSnapshot(publication.id, "en"));
  return {
    documentType,
    version: publication.version,
    changeClass: publication.change_class,
    userAction: publication.user_action,
    effectiveAt: publication.effective_at,
    publishedAt: publication.published_at,
    language: fallback?.language ?? language,
    content: fallback?.content ?? null,
    legacyWithoutSnapshot: fallback === null,
  };
}

export async function listLegalPublications(
  documentType?: LegalDocumentType,
): Promise<PublishedLegalDocument[]> {
  const versions = await listLegalVersions(documentType);
  return Promise.all(
    versions.map(async (version) => ({
      id: version.id,
      documentType: version.document_type,
      version: version.version,
      changeClass: version.change_class,
      userAction: version.user_action,
      effectiveAt: version.effective_at,
      publishedAt: version.published_at,
      publishedBy: version.published_by,
      languages: await listSnapshotLanguages(version.id),
    })),
  );
}

export async function legalVersionSatisfiesCurrentRequirement(
  documentType: LegalDocumentType,
  versionId: string | null | undefined,
): Promise<boolean> {
  if (!versionId) {
    return false;
  }
  const [version, required] = await Promise.all([
    getLegalVersionById(versionId),
    getLatestRequiredLegalVersion(documentType),
  ]);
  if (!version || version.document_type !== documentType) {
    return false;
  }
  if (!required) {
    return true;
  }

  const versionEffectiveAt = new Date(version.effective_at).getTime();
  const requiredEffectiveAt = new Date(required.effective_at).getTime();
  return (
    versionEffectiveAt > requiredEffectiveAt ||
    (versionEffectiveAt === requiredEffectiveAt &&
      new Date(version.published_at).getTime() >= new Date(required.published_at).getTime())
  );
}

export async function getLegalActionStatus(
  userId: string,
  documentType: LegalDocumentType,
): Promise<{
  currentVersion: string;
  requiredVersion: string | null;
  acceptedVersion: string | null;
  acceptedAt: string | null;
  requiredAction: LegalUserAction;
  needsAction: boolean;
}> {
  const [current, required, latestAcceptance] = await Promise.all([
    getCurrentLegalPublication(documentType),
    getLatestRequiredLegalVersion(documentType),
    getLatestAcceptanceForDocument(userId, documentType),
  ]);

  if (!required) {
    return {
      currentVersion: current.version,
      requiredVersion: null,
      acceptedVersion: latestAcceptance?.version ?? null,
      acceptedAt: latestAcceptance?.accepted_at ?? null,
      requiredAction: "none",
      needsAction: false,
    };
  }

  const latestAcceptedEffectiveAt = latestAcceptance
    ? new Date(latestAcceptance.version_effective_at).getTime()
    : Number.NEGATIVE_INFINITY;
  const requiredEffectiveAt = new Date(required.effective_at).getTime();

  const acceptedRequiredOrNewer =
    latestAcceptedEffectiveAt > requiredEffectiveAt ||
    (latestAcceptedEffectiveAt === requiredEffectiveAt &&
      latestAcceptance !== null &&
      new Date(latestAcceptance.version_published_at).getTime() >=
        new Date(required.published_at).getTime());

  return {
    currentVersion: current.version,
    requiredVersion: required.version,
    acceptedVersion: latestAcceptance?.version ?? null,
    acceptedAt: latestAcceptance?.accepted_at ?? null,
    requiredAction: required.user_action,
    needsAction: !acceptedRequiredOrNewer,
  };
}

export async function acceptLegalDocumentVersion(
  userId: string,
  versionId: string,
  source = "application",
  trx?: Knex.Transaction,
): Promise<LegalDocumentVersionRow> {
  const version = await getLegalVersionById(versionId, trx);
  if (!version) {
    throw new HttpError(404, "LEGAL_VERSION_NOT_FOUND", "Legal version not found");
  }
  const action: Exclude<LegalUserAction, "none"> =
    version.user_action === "none"
      ? version.document_type === "cookie"
        ? "renew_consent"
        : version.document_type === "privacy"
          ? "acknowledge"
          : "accept"
      : version.user_action;
  await recordLegalAcceptance(userId, version.id, action, new Date().toISOString(), source, trx);
  return version;
}

export async function acceptCurrentLegalDocument(
  userId: string,
  documentType: LegalDocumentType,
  source = "application",
): Promise<LegalDocumentVersionRow> {
  const version = await getCurrentLegalPublication(documentType);
  const action: Exclude<LegalUserAction, "none"> =
    version.user_action === "none"
      ? documentType === "cookie"
        ? "renew_consent"
        : documentType === "privacy"
          ? "acknowledge"
          : "accept"
      : version.user_action;
  await recordLegalAcceptance(userId, version.id, action, new Date().toISOString(), source);
  return version;
}

export async function revokeLegalDocumentAcceptances(
  userId: string,
  documentType: LegalDocumentType,
  revokedAt = new Date().toISOString(),
  trx?: Knex.Transaction,
): Promise<void> {
  await revokeLegalAcceptances(userId, documentType, revokedAt, trx);
}
