import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  listMeasurementAttributes,
  updateMeasurementVisibility,
  type MeasurementAttribute,
  type MeasurementCategory,
} from "../../services/api";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";

export const MeasurementDiscoverySettings: React.FC = () => {
  const { t, i18n } = useTranslation("common");
  const [category, setCategory] = useState<MeasurementCategory>("bio");
  const [query, setQuery] = useState("");
  const [attributes, setAttributes] = useState<MeasurementAttribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await listMeasurementAttributes(category, {
        lang: i18n.language,
        q: query.trim() || undefined,
        includeHidden: true,
      });
      setAttributes(next);
    } catch {
      setError(t("settings.measurementDiscovery.loadError"));
    } finally {
      setLoading(false);
    }
  }, [category, i18n.language, query, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (attribute: MeasurementAttribute) => {
    setSavingId(attribute.id);
    setError(null);
    try {
      await updateMeasurementVisibility(category, attribute.id, !attribute.isVisible);
      setAttributes((current) =>
        current.map((item) =>
          item.id === attribute.id ? { ...item, isVisible: !item.isVisible } : item,
        ),
      );
    } catch {
      setError(t("settings.measurementDiscovery.saveError"));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.measurementDiscovery.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid--gap-md">
          <p className="text-secondary">{t("settings.measurementDiscovery.description")}</p>
          {error && <Alert variant="danger">{error}</Alert>}

          <div
            className="flex flex--gap-sm"
            role="group"
            aria-label={t("settings.measurementDiscovery.category")}
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

          <label className="grid grid--gap-sm">
            <span>{t("settings.measurementDiscovery.search")}</span>
            <input
              className="form-input"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("settings.measurementDiscovery.searchPlaceholder")}
            />
          </label>

          {loading ? (
            <p>{t("common.loading")}</p>
          ) : attributes.length === 0 ? (
            <p>{t("settings.measurementDiscovery.empty")}</p>
          ) : (
            <div className="grid grid--gap-sm">
              {attributes.map((attribute) => (
                <div
                  key={attribute.id}
                  className="flex flex--justify-between flex--align-center flex--gap-md"
                >
                  <div className="grid" style={{ gap: "0.25rem" }}>
                    <strong>{attribute.label}</strong>
                    <span className="text-secondary">
                      {attribute.description || attribute.granularity}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant={attribute.isVisible ? "secondary" : "primary"}
                    isLoading={savingId === attribute.id}
                    aria-pressed={attribute.isVisible}
                    onClick={() => void toggle(attribute)}
                  >
                    {attribute.isVisible
                      ? t("settings.measurementDiscovery.remove")
                      : t("settings.measurementDiscovery.add")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
