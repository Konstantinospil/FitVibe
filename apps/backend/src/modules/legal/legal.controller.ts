import type { Request, Response } from "express";
import { HttpError } from "../../utils/http.js";
import {
  getCurrentLegalDocument,
  getCurrentLegalVersions,
  listLegalPublications,
  publishLegalDocument,
} from "./legal.service.js";
import type { LegalDocumentType, PublishLegalDocumentInput } from "./legal.types.js";

const DOCUMENT_TYPES = new Set<LegalDocumentType>(["terms", "privacy", "cookie"]);

function parseDocumentType(value: string): LegalDocumentType {
  if (!DOCUMENT_TYPES.has(value as LegalDocumentType)) {
    throw new HttpError(400, "LEGAL_DOCUMENT_TYPE_INVALID", "Invalid legal document type");
  }
  return value as LegalDocumentType;
}

export async function getLegalVersionsHandler(_req: Request, res: Response): Promise<void> {
  res.json(await getCurrentLegalVersions());
}

export async function getLegalDocumentHandler(req: Request, res: Response): Promise<void> {
  const documentType = parseDocumentType(readRouteParam(req.params.documentType, "documentType"));
  const language = typeof req.query.language === "string" ? req.query.language : "en";
  res.json(await getCurrentLegalDocument(documentType, language));
}

export async function listLegalPublicationsHandler(req: Request, res: Response): Promise<void> {
  const documentType =
    typeof req.query.documentType === "string"
      ? parseDocumentType(req.query.documentType)
      : undefined;
  res.json({ data: await listLegalPublications(documentType) });
}

export async function publishLegalDocumentHandler(req: Request, res: Response): Promise<void> {
  const authUser = req.user ?? null;
  if (!authUser?.sub) {
    throw new HttpError(401, "UNAUTHENTICATED", "UNAUTHENTICATED");
  }
  const body = req.body as Omit<PublishLegalDocumentInput, "documentType">;
  const documentType = parseDocumentType(readRouteParam(req.params.documentType, "documentType"));
  const publication = await publishLegalDocument(
    {
      documentType,
      changeClass: body.changeClass,
      userAction: body.userAction,
      effectiveAt: body.effectiveAt,
    },
    authUser.sub,
  );
  res.status(201).json(publication);
}
