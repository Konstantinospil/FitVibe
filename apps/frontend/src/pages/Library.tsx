import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Eye, Pencil, Plus } from "lucide-react";
import { Button, InputControl, SelectControl } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import {
  deleteExercise,
  listExercises,
  listExerciseTypes,
  type Exercise,
} from "../services/api";
import ExerciseCreator from "../components/composites/ExerciseCreator";
import { Modal } from "../components/composites/Modal";
import { RetryErrorPanel } from "../components/composites/StatusPanel";
import {
  TrainingPanel,
  TrainingSummaryCard,
} from "../components/composites/TrainingSurface";
import WorkoutEditor from "../components/composites/WorkoutEditor";
import { useAuthStore } from "../store/auth.store";
import { logger } from "../utils/logger";

const PAGE_SIZE = 20;

const Library: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [search, setSearch] = useState("");
  const [typeCode, setTypeCode] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [equipment, setEquipment] = useState("");
  const [tags, setTags] = useState("");
  const [offset, setOffset] = useState(0);
  const [creatorExercise, setCreatorExercise] = useState<Exercise | null | undefined>(undefined);
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Exercise | null>(null);
  const [workoutExercise, setWorkoutExercise] = useState<Exercise | null | undefined>(undefined);
  const [archiving, setArchiving] = useState(false);

  const tagList = useMemo(
    () =>
      tags
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    [tags],
  );

  const exercises = useQuery({
    queryKey: [
      "library",
      "exercises",
      search,
      typeCode,
      muscleGroup,
      equipment,
      tagList.join(","),
      offset,
    ],
    queryFn: () =>
      listExercises({
        q: search.trim() || undefined,
        type_code: typeCode || undefined,
        muscle_group: muscleGroup.trim() || undefined,
        equipment: equipment.trim() || undefined,
        tags: tagList.length ? tagList : undefined,
        limit: PAGE_SIZE,
        offset,
      }),
  });

  const types = useQuery({
    queryKey: ["exercise-library", "types"],
    queryFn: listExerciseTypes,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (exercises.error) {
      logger.apiError(
        "Failed to load Library exercises",
        exercises.error,
        "/api/v1/exercises",
        "GET",
      );
    }
  }, [exercises.error]);

  useEffect(() => {
    setOffset(0);
  }, [search, typeCode, muscleGroup, equipment, tags]);

  const source = (exercise: Exercise) =>
    exercise.owner_id === null
      ? "global"
      : exercise.owner_id === user?.id
        ? "mine"
        : "public";

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: ["library", "exercises"],
    });

  const archive = async () => {
    if (!archiveTarget || archiving) {
      return;
    }

    setArchiving(true);
    try {
      await deleteExercise(archiveTarget.id);
      setArchiveTarget(null);
      await refresh();
    } finally {
      setArchiving(false);
    }
  };

  const data = exercises.data?.data ?? [];
  const total = exercises.data?.total ?? 0;
  const hasNext = offset + data.length < total;

  return (
    <main className="training-page" aria-labelledby="library-title">
      <div
        style={{
          display: "flex",
          gap: "var(--space-md)",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 id="library-title">{t("librarySurface.title")}</h1>
          <p>{t("librarySurface.description")}</p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "var(--space-sm)",
            flexWrap: "wrap",
          }}
        >
          <Button
            variant="secondary"
            leadingIcon={<Plus />}
            onClick={() => setWorkoutExercise(null)}
          >
            {t("librarySurface.actions.createWorkout")}
          </Button>
          <Button leadingIcon={<Plus />} onClick={() => setCreatorExercise(null)}>
            {t("librarySurface.actions.createExercise")}
          </Button>
        </div>
      </div>

      <TrainingPanel title={t("librarySurface.sections.search")}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
            gap: "var(--space-sm)",
          }}
        >
          <label className="form-label">
            <span className="form-label-text">{t("librarySurface.filters.search")}</span>
            <InputControl value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>

          <label className="form-label">
            <span className="form-label-text">{t("librarySurface.filters.type")}</span>
            <SelectControl value={typeCode} onChange={(e) => setTypeCode(e.target.value)}>
              <option value="">{t("librarySurface.filters.allTypes")}</option>
              {(types.data ?? []).map((type) => (
                <option key={type.code} value={type.code}>
                  {type.name}
                </option>
              ))}
            </SelectControl>
          </label>

          <label className="form-label">
            <span className="form-label-text">{t("librarySurface.filters.muscleGroup")}</span>
            <InputControl
              value={muscleGroup}
              onChange={(e) => setMuscleGroup(e.target.value)}
            />
          </label>

          <label className="form-label">
            <span className="form-label-text">{t("librarySurface.filters.equipment")}</span>
            <InputControl
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
            />
          </label>

          <label className="form-label">
            <span className="form-label-text">{t("librarySurface.filters.tags")}</span>
            <InputControl value={tags} onChange={(e) => setTags(e.target.value)} />
          </label>
        </div>
      </TrainingPanel>

      <TrainingPanel title={t("librarySurface.sections.exercises")}>
        {exercises.isError ? (
          <RetryErrorPanel
            message={t("librarySurface.states.error")}
            retryLabel={t("actions.retry")}
            onRetry={() => void exercises.refetch()}
            isRetrying={exercises.isFetching}
          />
        ) : exercises.isLoading ? (
          <div className="training-empty">{t("librarySurface.states.loading")}</div>
        ) : data.length === 0 ? (
          <div className="training-empty">{t("librarySurface.states.noResults")}</div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))",
                gap: "var(--space-md)",
              }}
            >
              {data.map((exercise) => (
                <TrainingSummaryCard
                  key={exercise.id}
                  title={exercise.name}
                  meta={t(`librarySurface.source.${source(exercise)}`)}
                  supporting={[exercise.type_code, exercise.muscle_group, exercise.equipment]
                    .filter(Boolean)
                    .join(" · ")}
                  trailing={
                    <div
                      style={{
                        display: "flex",
                        gap: "var(--space-xs)",
                        flexWrap: "wrap",
                      }}
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        leadingIcon={<Eye />}
                        onClick={() => setDetail(exercise)}
                      >
                        {t("librarySurface.actions.details")}
                      </Button>

                      <Button
                        size="sm"
                        variant="secondary"
                        leadingIcon={<Plus />}
                        onClick={() => setWorkoutExercise(exercise)}
                      >
                        {t("librarySurface.actions.addToWorkout")}
                      </Button>

                      {exercise.owner_id === user?.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            leadingIcon={<Pencil />}
                            onClick={() => setCreatorExercise(exercise)}
                          >
                            {t("librarySurface.actions.edit")}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            leadingIcon={<Archive />}
                            onClick={() => setArchiveTarget(exercise)}
                          >
                            {t("librarySurface.actions.archive")}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  }
                />
              ))}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "var(--space-sm)",
                paddingTop: "var(--space-sm)",
              }}
            >
              <Button
                size="sm"
                variant="ghost"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                {t("librarySurface.actions.previous")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!hasNext}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                {t("librarySurface.actions.next")}
              </Button>
            </div>
          </>
        )}
      </TrainingPanel>

      <ExerciseCreator
        open={creatorExercise !== undefined}
        exercise={creatorExercise ?? null}
        onClose={() => setCreatorExercise(undefined)}
        onSaved={() => void refresh()}
      />

      <WorkoutEditor
        open={workoutExercise !== undefined}
        initialExercise={workoutExercise ?? null}
        onClose={() => setWorkoutExercise(undefined)}
      />

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.name ?? ""}>
        {detail ? (
          <div
            style={{
              display: "grid",
              gap: "var(--space-sm)",
            }}
          >
            <div>{t(`librarySurface.source.${source(detail)}`)}</div>
            <div>{detail.description_en || t("librarySurface.details.noDescription")}</div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        title={t("librarySurface.archive.title")}
        footer={
          <Button variant="danger" isLoading={archiving} onClick={() => void archive()}>
            {t("librarySurface.actions.confirmArchive")}
          </Button>
        }
      >
        {t("librarySurface.archive.description", {
          name: archiveTarget?.name ?? "",
        })}
      </Modal>
    </main>
  );
};

export default Library;
