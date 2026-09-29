import type { Request, Response } from "express";
import {
  getLanguageTranslations,
  getAllTranslationsForLanguage,
  createTranslationService,
  updateTranslationService,
  bulkUpdateTranslationService,
  deleteTranslationService,
  listTranslationsService,
  getLatestNamespaceUpdatesService,
  getTranslationMetadataService,
} from "./translations.service.js";
import type { SupportedLanguage, TranslationNamespace } from "./translations.types.js";
import {
  CreateTranslationSchema,
  UpdateTranslationSchema,
  BulkUpdateTranslationSchema,
  ListTranslationsQuerySchema,
  TranslationParamsSchema,
} from "./translations.schemas.js";
import type { z } from "zod";

/**
 * GET /translations/:language
 * Get all translations for a language (optionally filtered by namespace)
 */
export async function getTranslations(req: Request, res: Response): Promise<void> {
  const { language } = req.params as { language: SupportedLanguage };
  const namespace = req.query.namespace as TranslationNamespace | undefined;

  const translations = namespace
    ? await getLanguageTranslations(language, namespace)
    : await getAllTranslationsForLanguage(language);

  res.json(translations);
}

/**
 * GET /translations
 * List translations with filters and pagination (admin endpoint)
 */
export async function listTranslations(req: Request, res: Response): Promise<void> {
  const params: z.infer<typeof ListTranslationsQuerySchema> = ListTranslationsQuerySchema.parse(
    req.query,
  );
  const result = await listTranslationsService(params);

  res.json({
    data: result.translations,
    pagination: {
      total: result.total,
      limit: params.limit ?? 100,
      offset: params.offset ?? 0,
    },
  });
}

/**
 * GET /translations/namespace-updates
 * Get latest created_at per namespace (admin endpoint)
 */
export async function getNamespaceUpdates(req: Request, res: Response): Promise<void> {
  const updates = await getLatestNamespaceUpdatesService();
  res.json({ data: updates });
}

/**
 * GET /translations/metadata
 * Get available languages and namespaces (admin endpoint)
 */
export async function getTranslationMetadata(req: Request, res: Response): Promise<void> {
  const metadata = await getTranslationMetadataService();
  res.json({ data: metadata });
}

/**
 * POST /translations
 * Create a new translation (admin endpoint)
 */
export async function createTranslation(req: Request, res: Response): Promise<void> {
  const dto = CreateTranslationSchema.parse(req.body);
  const userId = req.user?.sub;

  const translation = await createTranslationService(dto, userId);

  res.status(201).json(translation);
}

/**
 * PUT /translations/:language/:namespace/:keyPath
 * Update an existing translation (admin endpoint)
 */
export async function updateTranslation(req: Request, res: Response): Promise<void> {
  const params = TranslationParamsSchema.parse({
    language: readRouteParam(req.params.language, "language"),
    namespace: readRouteParam(req.params.namespace, "namespace"),
    keyPath: decodeURIComponent(readRouteParam(req.params.keyPath, "keyPath", "")).replace(/%2E/g, "."), // Decode dots in URL
  });

  const dto = UpdateTranslationSchema.parse(req.body);
  const userId = req.user?.sub;

  const translation = await updateTranslationService(
    params.language,
    params.namespace,
    params.keyPath,
    dto,
    userId,
  );

  res.json(translation);
}

/**
 * POST /translations/bulk
 * Bulk update translations for a key across multiple languages (admin endpoint)
 */
export async function bulkUpdateTranslation(req: Request, res: Response): Promise<void> {
  const dto = BulkUpdateTranslationSchema.parse(req.body);
  const userId = req.user?.sub;

  const translations = await bulkUpdateTranslationService(dto, userId);

  res.json({ translations });
}

/**
 * DELETE /translations/:language/:namespace/:keyPath
 * Delete a translation (admin endpoint)
 */
export async function deleteTranslation(req: Request, res: Response): Promise<void> {
  const params = TranslationParamsSchema.parse({
    language: readRouteParam(req.params.language, "language"),
    namespace: readRouteParam(req.params.namespace, "namespace"),
    keyPath: decodeURIComponent(readRouteParam(req.params.keyPath, "keyPath", "")).replace(/%2E/g, "."), // Decode dots in URL
  });

  await deleteTranslationService(params.language, params.namespace, params.keyPath);

  res.status(204).send();
}
