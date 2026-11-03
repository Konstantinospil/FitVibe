import React, { useMemo, useState } from "react";
import { useUiText } from "../i18n/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, InputControl, SelectControl } from "@fitvibe/ui";
import {
  legalPublicationsApi,
  type LegalChangeClass,
  type LegalDocumentType,
  type LegalUserAction,
} from "../services/api";

const ACTIONS_BY_DOCUMENT: Record<LegalDocumentType, LegalUserAction[]> = {
  terms: ["accept"],
  privacy: ["acknowledge", "accept", "renew_consent"],
  cookie: ["renew_consent"],
};

const LegalPublicationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const t = useUiText();
  const [documentType, setDocumentType] = useState<LegalDocumentType>("terms");
  const [changeClass, setChangeClass] = useState<Exclude<LegalChangeClass, "legacy">>("editorial");
  const [userAction, setUserAction] = useState<LegalUserAction>("none");
  const [effectiveAt, setEffectiveAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["legal-publications"],
    queryFn: () => legalPublicationsApi.list(),
  });

  const allowedActions = useMemo(() => {
    return changeClass === "editorial" ? ["none"] : ACTIONS_BY_DOCUMENT[documentType];
  }, [changeClass, documentType]);

  const publishMutation = useMutation({
    mutationFn: () =>
      legalPublicationsApi.publish(documentType, {
        changeClass,
        userAction,
        effectiveAt: effectiveAt ? new Date(effectiveAt).toISOString() : undefined,
      }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["legal-publications"] });
    },
    onError: (err: unknown) => {
      const message =
        err && typeof err === "object" && "response" in err
          ? JSON.stringify((err as { response?: { data?: unknown } }).response?.data)
          : err instanceof Error
            ? err.message
            : t("legal.publicationFailed");
      setError(message);
    },
  });

  const handleChangeClass = (next: Exclude<LegalChangeClass, "legacy">) => {
    setChangeClass(next);
    setUserAction(next === "editorial" ? "none" : ACTIONS_BY_DOCUMENT[documentType][0]);
  };

  const handleDocumentType = (next: LegalDocumentType) => {
    setDocumentType(next);
    if (changeClass === "material") {
      setUserAction(ACTIONS_BY_DOCUMENT[next][0]);
    }
  };

  const publications = data?.data ?? [];

  return (
    <div className="grid grid--gap-lg">
      <div>
        <h1>{t("legal.title")}</h1>
        <p className="text-secondary">
          {t("legal.description")}
        </p>
      </div>

      <section className="card">
        <div className="card-content grid grid--gap-md">
          <h2>{t("legal.publishDraft")}</h2>

          <label className="grid grid--gap-xs">
            <span>{t("legal.document")}</span>
            <SelectControl
              className="form-select"
              value={documentType}
              onChange={(event) => handleDocumentType(event.target.value as LegalDocumentType)}
            >
              <option value="terms">{t("legal.document.terms")}</option>
              <option value="privacy">{t("legal.document.privacy")}</option>
              <option value="cookie">{t("legal.document.cookie")}</option>
            </SelectControl>
          </label>

          <label className="grid grid--gap-xs">
            <span>{t("legal.changeClass")}</span>
            <SelectControl
              className="form-select"
              value={changeClass}
              onChange={(event) =>
                handleChangeClass(event.target.value as Exclude<LegalChangeClass, "legacy">)
              }
            >
              <option value="editorial">{t("legal.class.editorialDescription")}</option>
              <option value="material">{t("legal.class.materialDescription")}</option>
            </SelectControl>
          </label>

          <label className="grid grid--gap-xs">
            <span>{t("legal.userEffect")}</span>
            <SelectControl
              className="form-select"
              value={userAction}
              onChange={(event) => setUserAction(event.target.value as LegalUserAction)}
              disabled={changeClass === "editorial"}
            >
              {allowedActions.map((action) => (
                <option key={action} value={action}>
                  {t(`legal.action.${action}`)}
                </option>
              ))}
            </SelectControl>
          </label>

          <label className="grid grid--gap-xs">
            <span>{t("legal.effectiveFrom")}</span>
            <InputControl
              className="form-input"
              type="datetime-local"
              value={effectiveAt}
              onChange={(event) => setEffectiveAt(event.target.value)}
            />
            <span className="text-secondary text-08">
              {t("legal.immediateHelp")}
            </span>
          </label>

          {error ? <div className="alert alert--error">{error}</div> : null}

          <Button
            type="button"
            className="button button--primary"
            disabled={publishMutation.isPending}
            onClick={() => publishMutation.mutate()}
          >
            {publishMutation.isPending ? t("legal.publishing") : t("legal.publishSnapshot")}
          </Button>
        </div>
      </section>

      <section className="card">
        <div className="card-content">
          <h2>{t("legal.history")}</h2>
          {isLoading ? (
            <p>{t("common.loading")}</p>
          ) : publications.length === 0 ? (
            <p className="text-secondary">{t("legal.empty")}</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th align="left">{t("legal.document")}</th>
                    <th align="left">{t("legal.version")}</th>
                    <th align="left">{t("legal.class")}</th>
                    <th align="left">{t("legal.userEffect")}</th>
                    <th align="left">{t("legal.effective")}</th>
                    <th align="left">{t("legal.languages")}</th>
                  </tr>
                </thead>
                <tbody>
                  {publications.map((publication) => (
                    <tr key={publication.id}>
                      <td>{t(`legal.document.${publication.documentType}`)}</td>
                      <td>{publication.version}</td>
                      <td>{t(`legal.class.${publication.changeClass}`)}</td>
                      <td>{t(`legal.action.${publication.userAction}`)}</td>
                      <td>{new Date(publication.effectiveAt).toLocaleString()}</td>
                      <td>{publication.languages.join(", ") || t("legal.legacyMissing")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default LegalPublicationsPage;
