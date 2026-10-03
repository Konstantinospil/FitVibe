import { db } from "../../db/connection.js";
import { getLatestBioValuesByKeys } from "../measurements/measurements.repository.js";
import { getOne } from "./sessions.service.js";
import type { SessionWithExercises } from "./sessions.types.js";

export interface ExerciseEstimationInput {
  id: string;
  metValue: number | null;
  secondsPerRep: number | null;
}

export interface SessionEstimate {
  activeDurationSec: number | null;
  restDurationSec: number;
  minimumTotalDurationSec: number | null;
  normalizedMet: number | null;
  estimatedKcalPerMin: number | null;
  estimatedActiveKcal: number | null;
  complete: boolean;
  missingInputs: string[];
}

function finiteNonNegative(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function parseIntervalSeconds(value?: string | null): number | null {
  if (!value) {
    return null;
  }

  const hms = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (hms) {
    const hasHours = hms[3] !== undefined;
    const hours = hasHours ? Number(hms[1]) : 0;
    const minutes = hasHours ? Number(hms[2]) : Number(hms[1]);
    const seconds = hasHours ? Number(hms[3]) : Number(hms[2]);
    return hours * 3600 + minutes * 60 + seconds;
  }

  const iso = /^P(?:\d+D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value);
  if (!iso) {
    return null;
  }

  return Number(iso[1] ?? 0) * 3600 + Number(iso[2] ?? 0) * 60 + Number(iso[3] ?? 0);
}

export function estimateSessionComposition(
  session: SessionWithExercises,
  inputs: Map<string, ExerciseEstimationInput>,
  bodyWeightKg: number | null,
): SessionEstimate {
  let activeDurationSec = 0;
  let restDurationSec = 0;
  let weightedMetSeconds = 0;
  const missing = new Set<string>();
  let durationComplete = true;
  let intensityComplete = true;

  session.exercises.forEach((exercise, exerciseIndex) => {
    const input = exercise.exercise_id ? inputs.get(exercise.exercise_id) : undefined;
    let exerciseActiveSec = 0;
    let exerciseDurationComplete = true;

    if (exercise.sets.length > 0) {
      exercise.sets.forEach((set, setIndex) => {
        const explicitDuration = finiteNonNegative(set.duration_sec);
        const reps = finiteNonNegative(set.reps);

        if (explicitDuration !== null && explicitDuration > 0) {
          exerciseActiveSec += explicitDuration;
        } else if (reps !== null && reps > 0 && input?.secondsPerRep !== null && input?.secondsPerRep !== undefined) {
          exerciseActiveSec += reps * input.secondsPerRep;
        } else {
          exerciseDurationComplete = false;
          missing.add(`exercise:${exercise.exercise_id ?? exercise.id}:duration`);
        }

        if (setIndex < exercise.sets.length - 1) {
          restDurationSec += finiteNonNegative(set.rest_sec) ?? 0;
        }
      });
    } else {
      const plannedDuration = parseIntervalSeconds(exercise.planned?.duration);
      const plannedSets = finiteNonNegative(exercise.planned?.sets) ?? 1;
      const plannedReps = finiteNonNegative(exercise.planned?.reps);

      if (plannedDuration !== null && plannedDuration > 0) {
        exerciseActiveSec += plannedDuration;
      } else if (plannedReps !== null && plannedReps > 0 && input?.secondsPerRep !== null && input?.secondsPerRep !== undefined) {
        exerciseActiveSec += plannedSets * plannedReps * input.secondsPerRep;
      } else if (plannedReps !== null && plannedReps > 0) {
        exerciseDurationComplete = false;
        missing.add(`exercise:${exercise.exercise_id ?? exercise.id}:seconds_per_rep`);
      } else {
        exerciseDurationComplete = false;
        missing.add(`exercise:${exercise.exercise_id ?? exercise.id}:duration`);
      }

      const plannedRest = parseIntervalSeconds(exercise.planned?.rest);
      if (plannedRest !== null && plannedSets > 1) {
        restDurationSec += plannedRest * (plannedSets - 1);
      }
    }

    const restAfterExercise =
      typeof exercise.planned?.extras?.rest_after_exercise_sec === "number"
        ? finiteNonNegative(exercise.planned.extras.rest_after_exercise_sec)
        : null;
    if (exerciseIndex < session.exercises.length - 1 && restAfterExercise !== null) {
      restDurationSec += restAfterExercise;
    }

    if (!exerciseDurationComplete) {
      durationComplete = false;
      intensityComplete = false;
    }

    if (exerciseActiveSec > 0) {
      activeDurationSec += exerciseActiveSec;
      if (input?.metValue === null || input?.metValue === undefined) {
        intensityComplete = false;
        missing.add(`exercise:${exercise.exercise_id ?? exercise.id}:met_value`);
      } else {
        weightedMetSeconds += input.metValue * exerciseActiveSec;
      }
    }
  });

  const normalizedMet =
    intensityComplete && activeDurationSec > 0 ? weightedMetSeconds / activeDurationSec : null;
  const activeDuration = durationComplete ? Math.round(activeDurationSec) : null;
  const minimumTotalDurationSec =
    activeDuration === null ? null : Math.round(activeDuration + restDurationSec);

  let estimatedKcalPerMin: number | null = null;
  let estimatedActiveKcal: number | null = null;
  if (normalizedMet !== null) {
    if (bodyWeightKg === null) {
      missing.add("athlete:weight_kg");
    } else {
      estimatedKcalPerMin = (normalizedMet * 3.5 * bodyWeightKg) / 200;
      if (activeDuration !== null) {
        estimatedActiveKcal = estimatedKcalPerMin * (activeDuration / 60);
      }
    }
  }

  return {
    activeDurationSec: activeDuration,
    restDurationSec: Math.round(restDurationSec),
    minimumTotalDurationSec,
    normalizedMet: normalizedMet === null ? null : Number(normalizedMet.toFixed(2)),
    estimatedKcalPerMin:
      estimatedKcalPerMin === null ? null : Number(estimatedKcalPerMin.toFixed(2)),
    estimatedActiveKcal:
      estimatedActiveKcal === null ? null : Number(estimatedActiveKcal.toFixed(1)),
    complete: missing.size === 0,
    missingInputs: [...missing].sort(),
  };
}

async function getExerciseInputs(
  exerciseIds: string[],
): Promise<Map<string, ExerciseEstimationInput>> {
  if (exerciseIds.length === 0) {
    return new Map();
  }

  const rows = (await db("exercises")
    .select("id", "met_value", "seconds_per_rep")
    .whereIn("id", exerciseIds)) as Array<{
    id: string;
    met_value: number | string | null;
    seconds_per_rep: number | string | null;
  }>;

  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        metValue: row.met_value === null ? null : Number(row.met_value),
        secondsPerRep: row.seconds_per_rep === null ? null : Number(row.seconds_per_rep),
      },
    ]),
  );
}

export async function getSessionEstimate(
  userId: string,
  sessionId: string,
): Promise<SessionEstimate> {
  const session = await getOne(userId, sessionId);
  const exerciseIds = Array.from(
    new Set(
      session.exercises
        .map((exercise) => exercise.exercise_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const [inputs, weightValues] = await Promise.all([
    getExerciseInputs(exerciseIds),
    getLatestBioValuesByKeys(userId, ["weight_kg"] as const),
  ]);

  return estimateSessionComposition(session, inputs, weightValues.weight_kg?.valueNumber ?? null);
}
