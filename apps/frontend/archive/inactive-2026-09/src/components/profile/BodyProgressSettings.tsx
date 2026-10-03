import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, Trash2, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  addBodyWeight,
  apiClient,
  deleteBodyProgressPhoto,
  getBodyProgress,
  uploadBodyProgressPhoto,
  type BodyProgressPhoto,
  type BodyWeightEntry,
} from "../../services/api";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Alert } from "../ui/Alert";

export const BodyProgressSettings: React.FC = () => {
  const { t } = useTranslation("common");
  const [weights, setWeights] = useState<BodyWeightEntry[]>([]);
  const [photos, setPhotos] = useState<BodyProgressPhoto[]>([]);
  const [weight, setWeight] = useState("");
  const [measuredAt, setMeasuredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingWeight, setSavingWeight] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBodyProgress();
      setWeights(data.weights);
      setPhotos(data.photos);
    } catch {
      setError(t("settings.progress.loadError") || "Failed to load body progress.");
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const latestWeight = useMemo(() => weights[0]?.weightKg ?? null, [weights]);

  const saveWeight = async () => {
    const value = Number(weight);
    if (!Number.isFinite(value) || value < 20 || value > 500) {
      setError(t("settings.progress.invalidWeight") || "Enter a weight between 20 and 500 kg.");
      return;
    }

    setSavingWeight(true);
    setError(null);
    try {
      const entry = await addBodyWeight({
        weightKg: value,
        measuredAt: new Date(measuredAt).toISOString(),
      });
      setWeights((current) => [entry, ...current]);
      setWeight("");
    } catch {
      setError(t("settings.progress.saveWeightError") || "Failed to save weight.");
    } finally {
      setSavingWeight(false);
    }
  };

  const uploadPhoto = async () => {
    if (!photoFile) {
      setError(t("settings.progress.photoRequired") || "Select a photo first.");
      return;
    }

    setUploadingPhoto(true);
    setError(null);
    try {
      const photo = await uploadBodyProgressPhoto(photoFile);
      setPhotos((current) => [photo, ...current]);
      setPhotoFile(null);
    } catch {
      setError(t("settings.progress.photoUploadError") || "Failed to upload progress photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const deletePhoto = async (id: string) => {
    setError(null);
    try {
      await deleteBodyProgressPhoto(id);
      setPhotos((current) => current.filter((photo) => photo.id !== id));
    } catch {
      setError(t("settings.progress.photoDeleteError") || "Failed to delete progress photo.");
    }
  };

  const photoUrl = (photo: BodyProgressPhoto) => {
    const base = apiClient.defaults.baseURL ?? "";
    return photo.fileUrl.startsWith("http") ? photo.fileUrl : `${base}${photo.fileUrl}`;
  };

  return (
    <div className="grid grid--gap-lg">
      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.progress.weightTitle") || "Weight history"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid--gap-md">
            <div className="flex flex--align-center flex--gap-sm">
              <TrendingUp size={20} />
              <strong>
                {latestWeight !== null
                  ? `${latestWeight.toFixed(1)} kg`
                  : t("settings.progress.noWeight") || "No weight recorded yet"}
              </strong>
            </div>

            <div
              className="grid"
              style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) auto", gap: "0.75rem" }}
            >
              <input
                className="form-input"
                type="number"
                min="20"
                max="500"
                step="0.1"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                placeholder={t("settings.progress.weightPlaceholder") || "Weight in kg"}
              />
              <input
                className="form-input"
                type="datetime-local"
                value={measuredAt}
                onChange={(event) => setMeasuredAt(event.target.value)}
              />
              <Button type="button" onClick={() => void saveWeight()} isLoading={savingWeight}>
                {t("settings.progress.saveWeight") || "Add weight"}
              </Button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "0.5rem 0" }}>
                      {t("settings.progress.date") || "Date"}
                    </th>
                    <th style={{ textAlign: "left", padding: "0.5rem 0" }}>
                      {t("settings.progress.weight") || "Weight"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={2} style={{ padding: "0.75rem 0" }}>
                        {t("common.loading") || "Loading..."}
                      </td>
                    </tr>
                  ) : weights.length === 0 ? (
                    <tr>
                      <td colSpan={2} style={{ padding: "0.75rem 0" }}>
                        {t("settings.progress.noHistory") || "No weight history yet."}
                      </td>
                    </tr>
                  ) : (
                    weights.slice(0, 20).map((entry) => (
                      <tr key={entry.id}>
                        <td style={{ padding: "0.5rem 0" }}>
                          {new Date(entry.measuredAt).toLocaleString()}
                        </td>
                        <td style={{ padding: "0.5rem 0" }}>{entry.weightKg.toFixed(1)} kg</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.progress.photosTitle") || "Progress photos"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid--gap-md">
            <div className="flex flex--align-center flex--gap-sm flex--wrap">
              <Camera size={20} />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                onClick={() => void uploadPhoto()}
                isLoading={uploadingPhoto}
                disabled={!photoFile}
              >
                {t("settings.progress.uploadPhoto") || "Upload photo"}
              </Button>
            </div>

            {photos.length === 0 ? (
              <p className="text-muted">
                {t("settings.progress.noPhotos") || "No progress photos uploaded yet."}
              </p>
            ) : (
              <div
                className="grid"
                style={{
                  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                  gap: "1rem",
                }}
              >
                {photos.map((photo) => (
                  <div key={photo.id} className="card" style={{ padding: "0.75rem" }}>
                    <img
                      src={photoUrl(photo)}
                      alt={t("settings.progress.photoAlt") || "Progress"}
                      style={{
                        width: "100%",
                        aspectRatio: "1 / 1",
                        objectFit: "cover",
                        borderRadius: "10px",
                      }}
                    />
                    <div
                      className="flex flex--justify-between flex--align-center"
                      style={{ marginTop: "0.75rem", gap: "0.5rem" }}
                    >
                      <span className="text-085 text-muted">
                        {new Date(photo.createdAt).toLocaleDateString()}
                      </span>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        leftIcon={<Trash2 size={14} />}
                        onClick={() => void deletePhoto(photo.id)}
                      >
                        {t("common.delete") || "Delete"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
