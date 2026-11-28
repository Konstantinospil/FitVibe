import type { Knex } from "knex";
import { db } from "../../db/connection.js";
import { HttpError } from "../../utils/http.js";
import { insertAudit } from "../common/audit.util.js";
import { INTAKE_TABLE, findSessionIntake, getSessionById } from "./sessions.repository.js";
import type { IntakeKind, SessionIntake } from "./sessions.types.js";

/**
 * Workout-side intake (ADR-045, issue 290): water and food energy recorded during
 * or after a workout. One row per entry in `session_intake_entries`, kept apart
 * from `sessions.calories` (energy the workout used) and from body measurements.
 * Only the session's owner reads or changes it.
 */

/** Largest single entry; the migration's check constraint mirrors these. */
export const INTAKE_LIMITS = {
  waterMaxMl: 5000,
  energyMaxKcal: 5000,
  /** Entries a manual Log may carry in one request. */
  maxEntriesPerLog: 20,
} as const;

export const INTAKE_KINDS: readonly IntakeKind[] = ["water", "energy"];

/** The largest amount one entry of a kind may hold. */
export const intakeMaxAmount = (kind: IntakeKind) =>
  kind === "water" ? INTAKE_LIMITS.waterMaxMl : INTAKE_LIMITS.energyMaxKcal;

const AUDIT_ENTITY = "session_intake";
/** Intake can be recorded once a workout has started, and corrected after. */
const RECORDABLE_STATUSES = new Set(["in_progress", "completed"]);

/** Writes a manual Log's intake inside its create transaction, stamped at the finish. */
export async function insertLoggedIntake(
  trx: Knex.Transaction,
  sessionId: string,
  recordedAt: string,
  entries: { kind: IntakeKind; amount: number }[],
): Promise<void> {
  if (entries.length === 0) {
    return;
  }
  await trx(INTAKE_TABLE).insert(
    entries.map((entry) => ({
      session_id: sessionId,
      kind: entry.kind,
      amount: entry.amount,
      recorded_at: recordedAt,
    })),
  );
}

async function ownSession(userId: string, sessionId: string) {
  const session = await getSessionById(sessionId, userId);
  if (!session) {
    throw new HttpError(404, "E.SESSION.NOT_FOUND", "SESSION_NOT_FOUND");
  }
  return session;
}

/** Records one entry now, during a workout or after it; returns the new intake. */
export async function addIntakeEntry(
  userId: string,
  sessionId: string,
  entry: { kind: IntakeKind; amount: number },
): Promise<SessionIntake> {
  const session = await ownSession(userId, sessionId);
  if (!RECORDABLE_STATUSES.has(session.status)) {
    throw new HttpError(
      409,
      "E.SESSION.INTAKE_NOT_STARTED",
      "Intake can be recorded once the workout has started",
    );
  }
  const [created] = (await db(INTAKE_TABLE)
    .insert({ session_id: sessionId, kind: entry.kind, amount: entry.amount })
    .returning(["id"])) as { id: string }[];
  await insertAudit({
    actorUserId: userId,
    entityType: AUDIT_ENTITY,
    action: "intake_recorded",
    entityId: created.id,
    metadata: { session_id: sessionId, kind: entry.kind, amount: entry.amount },
  });
  return findSessionIntake(sessionId);
}

/** Removes one entry; returns the remaining intake. */
export async function deleteIntakeEntry(
  userId: string,
  sessionId: string,
  entryId: string,
): Promise<SessionIntake> {
  await ownSession(userId, sessionId);
  const removed = await db(INTAKE_TABLE).where({ id: entryId, session_id: sessionId }).del();
  if (removed === 0) {
    throw new HttpError(404, "E.SESSION.INTAKE_NOT_FOUND", "INTAKE_ENTRY_NOT_FOUND");
  }
  await insertAudit({
    actorUserId: userId,
    entityType: AUDIT_ENTITY,
    action: "intake_deleted",
    entityId: entryId,
    metadata: { session_id: sessionId },
  });
  return findSessionIntake(sessionId);
}
