export type LegalDocumentType = "terms" | "privacy" | "cookie";
export type LegalChangeClass = "legacy" | "editorial" | "material";
export type LegalUserAction = "none" | "acknowledge" | "accept" | "renew_consent";

export interface LegalDocumentVersionRow {
  id: string;
  document_type: LegalDocumentType;
  version: string;
  change_class: LegalChangeClass;
  user_action: LegalUserAction;
  effective_at: string;
  published_at: string;
  published_by: string | null;
  source: string;
  created_at: string;
}

export interface LegalDocumentSnapshotRow {
  id: string;
  version_id: string;
  language: string;
  content: Record<string, unknown>;
  content_hash: string;
  created_at: string;
}

export interface LegalDocumentAcceptanceRow {
  id: string;
  user_id: string;
  version_id: string;
  action: Exclude<LegalUserAction, "none">;
  source: string;
  accepted_at: string;
  revoked_at: string | null;
  created_at: string;
}

export interface PublishLegalDocumentInput {
  documentType: LegalDocumentType;
  changeClass: Exclude<LegalChangeClass, "legacy">;
  userAction: LegalUserAction;
  effectiveAt?: string;
}

export interface PublishedLegalDocument {
  id: string;
  documentType: LegalDocumentType;
  version: string;
  changeClass: LegalChangeClass;
  userAction: LegalUserAction;
  effectiveAt: string;
  publishedAt: string;
  publishedBy: string | null;
  languages: string[];
}

export interface LegalDocumentContent {
  documentType: LegalDocumentType;
  version: string;
  changeClass: LegalChangeClass;
  userAction: LegalUserAction;
  effectiveAt: string;
  publishedAt: string;
  language: string;
  content: Record<string, unknown> | null;
  legacyWithoutSnapshot: boolean;
}
