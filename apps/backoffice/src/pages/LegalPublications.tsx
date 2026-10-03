import React, { useMemo, useState } from "react";
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
            : "Publication failed";
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
        <h1>Legal Publications</h1>
        <p className="text-secondary">
          Translation namespaces are the drafting source. Publishing freezes the current legal
          namespace into immutable language snapshots.
        </p>
      </div>

      <section className="card">
        <div className="card-content grid grid--gap-md">
          <h2>Publish current draft</h2>

          <label className="grid grid--gap-xs">
            <span>Document</span>
            <SelectControl
              className="form-select"
              value={documentType}
              onChange={(event) => handleDocumentType(event.target.value as LegalDocumentType)}
            >
              <option value="terms">Terms and Conditions</option>
              <option value="privacy">Privacy Policy</option>
              <option value="cookie">Cookie Policy</option>
            </SelectControl>
          </label>

          <label className="grid grid--gap-xs">
            <span>Change classification</span>
            <SelectControl
              className="form-select"
              value={changeClass}
              onChange={(event) =>
                handleChangeClass(event.target.value as Exclude<LegalChangeClass, "legacy">)
              }
            >
              <option value="editorial">Editorial — existing user action remains valid</option>
              <option value="material">Material — renewed user action is required</option>
            </SelectControl>
          </label>

          <label className="grid grid--gap-xs">
            <span>User effect</span>
            <SelectControl
              className="form-select"
              value={userAction}
              onChange={(event) => setUserAction(event.target.value as LegalUserAction)}
              disabled={changeClass === "editorial"}
            >
              {allowedActions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </SelectControl>
          </label>

          <label className="grid grid--gap-xs">
            <span>Effective from</span>
            <InputControl
              className="form-input"
              type="datetime-local"
              value={effectiveAt}
              onChange={(event) => setEffectiveAt(event.target.value)}
            />
            <span className="text-secondary text-08">
              Leave empty to make the publication effective immediately.
            </span>
          </label>

          {error ? <div className="alert alert--error">{error}</div> : null}

          <Button
            type="button"
            className="button button--primary"
            disabled={publishMutation.isPending}
            onClick={() => publishMutation.mutate()}
          >
            {publishMutation.isPending ? "Publishing…" : "Publish immutable snapshot"}
          </Button>
        </div>
      </section>

      <section className="card">
        <div className="card-content">
          <h2>Publication history</h2>
          {isLoading ? (
            <p>Loading…</p>
          ) : publications.length === 0 ? (
            <p className="text-secondary">No publications found.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th align="left">Document</th>
                    <th align="left">Version</th>
                    <th align="left">Class</th>
                    <th align="left">User effect</th>
                    <th align="left">Effective</th>
                    <th align="left">Languages</th>
                  </tr>
                </thead>
                <tbody>
                  {publications.map((publication) => (
                    <tr key={publication.id}>
                      <td>{publication.documentType}</td>
                      <td>{publication.version}</td>
                      <td>{publication.changeClass}</td>
                      <td>{publication.userAction}</td>
                      <td>{new Date(publication.effectiveAt).toLocaleString()}</td>
                      <td>{publication.languages.join(", ") || "legacy snapshot unavailable"}</td>
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
