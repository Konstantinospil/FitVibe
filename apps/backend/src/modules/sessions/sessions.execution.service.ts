import { v4 as uuidv4 } from "uuid";
import type { Knex } from "knex";
import { db } from "../../db/connection.js";
import { HttpError } from "../../utils/http.js";
import { insertAudit } from "../common/audit.util.js";
import { getSessionWithDetails } from "./sessions.repository.js";
import {
  EMPTY_SET_METRICS,
  hasMetricValue,
  normalizeSetMetrics,
  trimToNull,
} from "./sessions.normalization.js";
import type { Session, SessionSetPlannedValues, SessionWithExercises } from "./sessions.types.js";

/**
 * Live workout execution (ADR-043, #365). Every command works on a session the
 * athlete owns that is in progress, runs in one transaction with the session row
 * locked, and returns the whole session so the client never derives the
 * authoritative order or state on its own. Commands are idempotent where a retry
 * could otherwise repeat work: recording or skipping the same set twice leaves
 * one result; pausing or resuming twice changes nothing.
 */

export interface RecordSetCommand {
  status: "completed" | "skipped";
  reps?: number | null;
  weight_kg?: number | null;
  distance_m?: number | null;
  duration_sec?: number | null;
  rpe?: number | null;
  rest_sec?: number | null;
  notes?: string | null;
}

export interface AddSetCommand {
  planned?: SessionSetPlannedValues | null;
}

export interface AddExerciseCommand {
  exercise_id: string;
}

type ActiveSession = Pick<Session, "id" | "owner_id" | "status" | "paused_at" | "paused_seconds">;

const secondsBetween = (from: string | Date, to: Date) =>
  Math.max(0, Math.round((to.getTime() - new Date(from).getTime()) / 1000));

/**
 * Seconds of an open pause folded into the total, for a session that resumes or
 * finishes while paused.
 */
export function closedPause(session: Pick<Session, "paused_at" | "paused_seconds">, now: Date) {
  return {
    paused_at: null,
    paused_seconds:
      (session.paused_seconds ?? 0) +
      (session.paused_at ? secondsBetween(session.paused_at, now) : 0),
  };
}

async function lockActiveSession(
  trx: Knex.Transaction,
  userId: string,
  sessionId: string,
): Promise<ActiveSession> {
  const session = (await trx("sessions")
    .where({ id: sessionId, owner_id: userId })
    .whereNull("deleted_at")
    .forUpdate()
    .first("id", "owner_id", "status", "paused_at", "paused_seconds")) as ActiveSession | undefined;
  if (!session) {
    throw new HttpError(404, "E.SESSION.NOT_FOUND", "SESSION_NOT_FOUND");
  }
  if (session.status !== "in_progress") {
    throw new HttpError(
      409,
      "E.SESSION.NOT_ACTIVE",
      "Only a workout in progress can be changed while training",
    );
  }
  return session;
}

async function exerciseOfSession(trx: Knex.Transaction, sessionId: string, exerciseRowId: string) {
  const exercise = (await trx("session_exercises")
    .where({ id: exerciseRowId, session_id: sessionId })
    .first("id", "status")) as { id: string; status: string } | undefined;
  if (!exercise) {
    throw new HttpError(404, "E.SESSION.EXERCISE_NOT_FOUND", "Exercise not found in this workout");
  }
  return exercise;
}

async function run(
  userId: string,
  sessionId: string,
  action: string,
  command: (trx: Knex.Transaction, session: ActiveSession) => Promise<Record<string, unknown>>,
): Promise<SessionWithExercises> {
  const metadata = await db.transaction(async (trx) => {
    const session = await lockActiveSession(trx, userId, sessionId);
    const details = await command(trx, session);
    await trx("sessions").where({ id: sessionId }).update({ updated_at: new Date().toISOString() });
    return details;
  });
  await insertAudit({
    actorUserId: userId,
    entityType: "sessions",
    action,
    entityId: sessionId,
    metadata,
  });
  const updated = await getSessionWithDetails(sessionId, userId);
  if (!updated) {
    throw new HttpError(500, "E.SESSION.UPDATE_FAILED", "SESSION_UPDATE_FAILED");
  }
  return updated;
}

export function pauseSession(userId: string, sessionId: string) {
  return run(userId, sessionId, "pause", async (trx, session) => {
    if (!session.paused_at) {
      await trx("sessions")
        .where({ id: session.id })
        .update({ paused_at: new Date().toISOString() });
    }
    return {};
  });
}

export function resumeSession(userId: string, sessionId: string) {
  return run(userId, sessionId, "resume", async (trx, session) => {
    if (session.paused_at) {
      await trx("sessions").where({ id: session.id }).update(closedPause(session, new Date()));
    }
    return {};
  });
}

/** Record what was done in a set, correct it, or skip it. */
export function recordSet(
  userId: string,
  sessionId: string,
  setId: string,
  command: RecordSetCommand,
) {
  return run(userId, sessionId, "record_set", async (trx) => {
    const set = (await trx("exercise_sets as s")
      .join("session_exercises as se", "se.id", "s.session_exercise_id")
      .where({ "s.id": setId, "se.session_id": sessionId })
      .first("s.id", "s.recorded_at")) as
      { id: string; recorded_at: Date | string | null } | undefined;
    if (!set) {
      throw new HttpError(404, "E.SESSION.SET_NOT_FOUND", "Set not found in this workout");
    }

    const performed = normalizeSetMetrics(command, "set");
    if (command.status === "skipped" && hasMetricValue(performed)) {
      throw new HttpError(
        422,
        "E.SESSION.INVALID_SET",
        "set: a skipped set cannot have performed values",
      );
    }
    const completed = command.status === "completed";
    await trx("exercise_sets")
      .where({ id: setId })
      .update({
        status: command.status,
        ...(completed ? performed : EMPTY_SET_METRICS),
        // A correction keeps the time the set was first recorded.
        recorded_at: completed ? (set.recorded_at ?? new Date().toISOString()) : null,
        ...(command.notes !== undefined ? { notes: trimToNull(command.notes) } : {}),
      });
    return { set_id: setId, status: command.status };
  });
}

/** Add a set to an exercise while training; it starts as planned work. */
export function addSet(
  userId: string,
  sessionId: string,
  exerciseRowId: string,
  command: AddSetCommand,
) {
  return run(userId, sessionId, "add_set", async (trx) => {
    await exerciseOfSession(trx, sessionId, exerciseRowId);
    const last = (await trx("exercise_sets")
      .where({ session_exercise_id: exerciseRowId })
      .max<{ max: number | null }>("order_index as max")
      .first()) ?? { max: null };
    const planned = normalizeSetMetrics(command.planned, "set planned");
    const id = uuidv4();
    await trx("exercise_sets").insert({
      id,
      session_exercise_id: exerciseRowId,
      order_index: (last.max ?? 0) + 1,
      status: "planned",
      source: "added",
      planned_reps: planned.reps,
      planned_weight_kg: planned.weight_kg,
      planned_distance_m: planned.distance_m,
      planned_duration_sec: planned.duration_sec,
      planned_rpe: planned.rpe,
      planned_rest_sec: planned.rest_sec,
      created_at: new Date().toISOString(),
    });
    // Adding a set to a skipped exercise brings the exercise back.
    await trx("session_exercises")
      .where({ id: exerciseRowId })
      .update({ status: "planned", updated_at: new Date().toISOString() });
    return { exercise_row_id: exerciseRowId, set_id: id };
  });
}

/** Add an exercise at the end of the workout, with one empty set to record. */
export function addExercise(userId: string, sessionId: string, command: AddExerciseCommand) {
  return run(userId, sessionId, "add_exercise", async (trx) => {
    const exercise = (await trx("exercises")
      .where({ id: command.exercise_id })
      .whereNull("archived_at")
      .andWhere((query) => {
        void query.where({ owner_id: userId }).orWhereNull("owner_id").orWhere({ is_public: true });
      })
      .first("id", "name")) as { id: string; name: string } | undefined;
    if (!exercise) {
      throw new HttpError(404, "E.EXERCISE.NOT_FOUND", "Exercise not found");
    }
    const last = (await trx("session_exercises")
      .where({ session_id: sessionId })
      .max<{ max: number | null }>("order_index as max")
      .first()) ?? { max: null };
    const id = uuidv4();
    const now = new Date().toISOString();
    await trx("session_exercises").insert({
      id,
      session_id: sessionId,
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      order_index: (last.max ?? 0) + 1,
      status: "planned",
      source: "added",
      created_at: now,
      updated_at: now,
    });
    await trx("exercise_sets").insert({
      id: uuidv4(),
      session_exercise_id: id,
      order_index: 1,
      status: "planned",
      source: "added",
      created_at: now,
    });
    return { exercise_row_id: id, exercise_id: exercise.id };
  });
}

/** Skip an exercise: its remaining planned sets are skipped, recorded sets stay. */
export function skipExercise(userId: string, sessionId: string, exerciseRowId: string) {
  return run(userId, sessionId, "skip_exercise", async (trx) => {
    await exerciseOfSession(trx, sessionId, exerciseRowId);
    await trx("session_exercises")
      .where({ id: exerciseRowId })
      .update({ status: "skipped", updated_at: new Date().toISOString() });
    await trx("exercise_sets")
      .where({ session_exercise_id: exerciseRowId, status: "planned" })
      .update({ status: "skipped" });
    return { exercise_row_id: exerciseRowId };
  });
}
