import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  addMeasurementValue,
  listEnabledMeasurementAttributes,
  type MeasurementAttribute,
  type MeasurementCategory,
} from "../../services/api";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";

type DraftMap = Record<string, { value: string; measuredAt: string }>;

function currentLocalDateTime(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
}

function rangeFor(attribute: MeasurementAttribute): { min: number | null; max: number | null } {
  return attribute.measurementSystem === "metric"
    ? { min: attribute.minValueMetric, max: attribute.maxValueMetric }
    : { min: attribute.minValueImperial, max: attribute.maxValueImperial };
}

export const MeasurementValuesSettings: React.FC = () => {
  const { t, i18n } = useTranslation("common");
  const [category, setCategory] = useState<MeasurementCategory>("bio");
  const [attributes, setAttributes] = useState<MeasurementAttribute[]>([]);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await listEnabledMeasurementAttributes(category, i18n.language);
      setAttributes(next);
      setDrafts((current) => {
        const result = { ...current };
        for (const attribute of next) {
          result[attribute.id] ??= { value: "", measuredAt: currentLocalDateTime() };
        }
        return result;
      });
    } catch {
      setError(t("settings.measurements.loadError"));
    } finally {
      setLoading(false);
    }
  }, [category, i18n.language, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const editable = useMemo(
    () => attributes.filter((attribute) => attribute.derivedOperator === null),
    [attributes],
  );

  const save = async (attribute: MeasurementAttribute) => {
    const draft = drafts[attribute.id];
    if (!draft) {
      return;
    }

    const valueNumber = Number(draft.value);
    const { min, max } = rangeFor(attribute);
    if (
      !Number.isFinite(valueNumber) ||
      (min !== null && valueNumber < min) ||
      (max !== null && valueNumber > max)
    ) {
      setError(t("settings.measurements.invalidValue"));
      return;
    }

    setSavingId(attribute.id);
    setError(null);
    try {
      const latestValue = await addMeasurementValue(category, attribute.id, {
        valueNumber,
        measuredAt: new Date(draft.measuredAt).toISOString(),
      });
      setAttributes((current) =>
        current.map((item) => (item.id === attribute.id ? { ...item, latestValue } : item)),
      );
      setDrafts((current) => ({
        ...current,
        [attribute.id]: { value: "", measuredAt: currentLocalDateTime() },
      }));
    } catch {
      setError(t("settings.measurements.saveError"));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.measurements.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid--gap-md">
          <p className="text-secondary">{t("settings.measurements.description")}</p>
          {error && <Alert variant="danger">{error}</Alert>}

          <div
            className="flex flex--gap-sm"
            role="group"
            aria-label={t("settings.measurements.category")}
          >
            <Button
              type="button"
              variant={category === "bio" ? "primary" : "secondary"}
              onClick={() => setCategory("bio")}
            >
              {t("settings.measurements.biometric")}
            </Button>
            <Button
              type="button"
              variant={category === "perf" ? "primary" : "secondary"}
              onClick={() => setCategory("perf")}
            >
              {t("settings.measurements.performance")}
            </Button>
          </div>

          {loading ? (
            <p>{t("common.loading")}</p>
          ) : editable.length === 0 ? (
            <p>{t("settings.measurements.noneEnabled")}</p>
          ) : (
            <div className="grid grid--gap-md">
              {editable.map((attribute) => {
                const draft = drafts[attribute.id] ?? {
                  value: "",
                  measuredAt: currentLocalDateTime(),
                };
                const range = rangeFor(attribute);
                return (
                  <div key={attribute.id} className="grid grid--gap-sm">
                    <div>
                      <strong>{attribute.label}</strong>
                      <div className="text-secondary">
                        {attribute.granularity}
                        {attribute.latestValue
                          ? ` · ${t("settings.measurements.latest")}: ${attribute.latestValue.valueNumber}`
                          : ""}
                      </div>
                    </div>
                    <div
                      className="grid"
                      style={{
                        gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) auto",
                        gap: "0.75rem",
                      }}
                    >
                      <input
                        className="form-input"
                        aria-label={`${attribute.label} ${t("settings.measurements.value")}`}
                        type="number"
                        min={range.min ?? undefined}
                        max={range.max ?? undefined}
                        step="any"
                        value={draft.value}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [attribute.id]: { ...draft, value: event.target.value },
                          }))
                        }
                      />
                      <input
                        className="form-input"
                        aria-label={`${attribute.label} ${t("settings.measurements.measuredAt")}`}
                        type="datetime-local"
                        value={draft.measuredAt}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [attribute.id]: { ...draft, measuredAt: event.target.value },
                          }))
                        }
                      />
                      <Button
                        type="button"
                        isLoading={savingId === attribute.id}
                        onClick={() => void save(attribute)}
                      >
                        {t("settings.measurements.save")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
