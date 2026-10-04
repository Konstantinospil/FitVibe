import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async-handler.js";
import { validate } from "../../utils/validation.js";
import { requireAccessToken } from "../auth/auth.middleware.js";
import { requireRole } from "../common/rbac.middleware.js";
import { rateLimit } from "../common/rateLimiter.js";
import {
  getLegalDocumentHandler,
  getLegalVersionsHandler,
  listLegalPublicationsHandler,
  publishLegalDocumentHandler,
} from "./legal.controller.js";

const PublishLegalDocumentSchema = z.object({
  changeClass: z.enum(["editorial", "material"]),
  userAction: z.enum(["none", "acknowledge", "accept", "renew_consent"]),
  effectiveAt: z.string().datetime().optional(),
});

export const legalRouter = Router();

legalRouter.get(
  "/versions",
  rateLimit("legal_versions", 60, 60),
  asyncHandler(getLegalVersionsHandler),
);
legalRouter.get(
  "/documents/:documentType",
  rateLimit("legal_document", 60, 60),
  asyncHandler(getLegalDocumentHandler),
);

legalRouter.get(
  "/publications",
  rateLimit("legal_publications_list", 30, 60),
  requireAccessToken,
  requireRole("admin"),
  asyncHandler(listLegalPublicationsHandler),
);

legalRouter.post(
  "/publications/:documentType",
  rateLimit("legal_publications_publish", 10, 60),
  requireAccessToken,
  requireRole("admin"),
  validate(PublishLegalDocumentSchema),
  asyncHandler(publishLegalDocumentHandler),
);
