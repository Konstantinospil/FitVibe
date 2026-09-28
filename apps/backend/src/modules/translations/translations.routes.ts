import { Router } from "express";
import { rateLimit } from "../common/rateLimiter.js";
import { validate } from "../../utils/validation.js";
import { requireAccessToken } from "../auth/auth.middleware.js";
import { requireRole } from "../common/rbac.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  getTranslations,
  listTranslations,
  getNamespaceUpdates,
  getTranslationMetadata,
  createTranslation,
  updateTranslation,
  bulkUpdateTranslation,
  deleteTranslation,
} from "./translations.controller.js";
import {
  GetTranslationsParamsSchema,
  CreateTranslationSchema,
  UpdateTranslationSchema,
  BulkUpdateTranslationSchema,
  ListTranslationsQuerySchema,
} from "./translations.schemas.js";

export const translationsRouter = Router();

// Admin endpoint: Get latest namespace updates
translationsRouter.get(
  "/namespace-updates",
  rateLimit("translations_namespace_updates"),
  requireAccessToken,
  requireRole("admin"),
  asyncHandler(getNamespaceUpdates),
);

// Admin endpoint: Get available namespaces and languages
translationsRouter.get(
  "/metadata",
  rateLimit("translations_metadata"),
  requireAccessToken,
  requireRole("admin"),
  asyncHandler(getTranslationMetadata),
);

// Public endpoint: Get translations for a language
translationsRouter.get(
  "/:language",
  rateLimit("translations_get"), // 100 requests per minute
  validate(GetTranslationsParamsSchema, "params"),
  asyncHandler(getTranslations),
);

// Admin endpoints: Manage translations
translationsRouter.use(requireAccessToken); // Require auth for all admin routes below

translationsRouter.get(
  "/",
  rateLimit("translations_list"),
  requireRole("admin"),
  validate(ListTranslationsQuerySchema, "query"),
  asyncHandler(listTranslations),
);

translationsRouter.post(
  "/",
  rateLimit("translations_create"),
  requireRole("admin"),
  validate(CreateTranslationSchema),
  asyncHandler(createTranslation),
);

translationsRouter.put(
  "/:language/:namespace/:keyPath",
  rateLimit("translations_update"),
  requireRole("admin"),
  validate(UpdateTranslationSchema),
  asyncHandler(updateTranslation),
);

translationsRouter.post(
  "/bulk",
  rateLimit("translations_bulk"),
  requireRole("admin"),
  validate(BulkUpdateTranslationSchema),
  asyncHandler(bulkUpdateTranslation),
);

translationsRouter.delete(
  "/:language/:namespace/:keyPath",
  rateLimit("translations_delete"),
  requireRole("admin"),
  asyncHandler(deleteTranslation),
);
