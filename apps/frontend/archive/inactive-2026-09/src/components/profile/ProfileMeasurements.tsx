import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { listEnabledMeasurementAttributes, type MeasurementAttribute } from "../../services/api";
import { Alert } from "../ui/Alert";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";

export const ProfileMeasurements: React.FC = () => {
  const { t, i18n } = useTranslation("common");
  const [bio, setBio] = useState<MeasurementAttribute[]>([]);
  const [perf, setPerf] = useState<MeasurementAttribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextBio, nextPerf] = await Promise.all([
        listEnabledMeasurementAttributes("bio", i18n.language),
        listEnabledMeasurementAttributes("perf", i18n.language),
      ]);
      setBio(nextBio);
      setPerf(nextPerf);
    } catch {
      setError(t("profile.measurements.loadError"));
    } finally {
      setLoading(false);
    }
  }, [i18n.language, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => [...bio, ...perf], [bio, perf]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profile.measurements.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {error && <Alert variant="danger">{error}</Alert>}
        {loading ? (
          <p>{t("common.loading")}</p>
        ) : visible.length === 0 ? (
          <p>{t("profile.measurements.empty")}</p>
        ) : (
          <dl className="grid grid--gap-sm">
            {visible.map((attribute) => (
              <div
                key={attribute.id}
                className="flex flex--justify-between flex--align-center flex--gap-md"
              >
                <dt>{attribute.label}</dt>
                <dd style={{ margin: 0 }}>
                  {attribute.latestValue
                    ? `${attribute.latestValue.valueNumber} ${attribute.granularity}`
                    : t("profile.measurements.noValue")}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
};
