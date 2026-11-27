import type { Request, Response } from "express";
import { readRouteParam } from "../../utils/http.js";
import { z } from "zod";
import {
  getAll,
  getOne,
  getSessionVibeChanges,
  createOne,
  updateOne,
  cancelOne,
  reopenOne,
  cloneOne,
  applyRecurrence,
} from "./sessions.service.js";
import { getSessionEstimate } from "./sessions.estimation.service.js";
import {
  addExercise,
  addSet,
  pauseSession,
  recordSet,
  resumeSession,
  skipExercise,
} from "./sessions.execution.service.js";
import { getIdempotencyKey, handleIdempotentRequest } from "../common/idempotency.helpers.js";
import { SESSION_DURATION_LIMITS } from "./sessions.schedule.js";

const statusEnum = z.enum(["planned", "in_progress", "completed", "canceled"]);
const visibilityEnum = z.enum(["private", "followers", "public", "link"]);
const setStatusEnum = z.enum(["planned", "completed", "skipped"]);
const setSourceEnum = z.enum(["prescribed", "added"]);
const completionOutcomeEnum = z.enum(["completed", "stopped_early"]);

const titleSchema = z
  .string()
  .trim()
  .min(2, "SESSION_INVALID_PLAN")
  .max(100, "SESSION_INVALID_PLAN");

const intervalPattern =
  /^(?:P(?!$)(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+S)?)?|(?:\d{2}):(?:\d{2})(?::(?:\d{2}))?)$/;

const intervalSchema = z
  .string()
  .regex(intervalPattern, "Interval must be ISO-8601 or HH:MM[:SS] format")
  .nullable()
  .optional();

const extrasSchema = z.record(z.string(), z.unknown()).optional();

const plannedAttributesSchema = z
  .object({
    sets: z.number().int().min(0).nullable().optional(),
    reps: z.number().int().min(0).nullable().optional(),
    load: z.number().min(0).nullable().optional(),
    distance: z.number().min(0).nullable().optional(),
    duration: intervalSchema,
    rpe: z.number().int().min(1).max(10).nullable().optional(),
    rest: intervalSchema,
    extras: extrasSchema,
  })
  .strict();

const actualAttributesSchema = plannedAttributesSchema.extend({
  recorded_at: z.string().datetime().nullable().optional(),
});

const setMetricFields = {
  reps: z.number().int().min(0).nullable().optional(),
  weight_kg: z.number().min(0).nullable().optional(),
  distance_m: z.number().min(0).nullable().optional(),
  duration_sec: z.number().int().min(0).nullable().optional(),
  rpe: z.number().int().min(1).max(10).nullable().optional(),
  rest_sec: z.number().int().min(0).nullable().optional(),
};

/** A set's prescription (ADR-042); the top-level set fields hold performed values. */
const plannedSetValuesSchema = z.object(setMetricFields).strict();

const sessionSetSchema = z
  .object({
    id: z.string().uuid().optional(),
    order: z.number().int().min(1),
    status: setStatusEnum.optional(),
    source: setSourceEnum.optional(),
    planned: plannedSetValuesSchema.nullable().optional(),
    reps: z.number().int().min(0).nullable().optional(),
    weight_kg: z.number().min(0).nullable().optional(),
    distance_m: z.number().min(0).nullable().optional(),
    duration_sec: z.number().int().min(0).nullable().optional(),
    rpe: z.number().int().min(1).max(10).nullable().optional(),
    rest_sec: z.number().int().min(0).nullable().optional(),
    extras: extrasSchema,
    recorded_at: z.string().datetime().nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
  })
  .strict();

const sessionExerciseSchema = z
  .object({
    id: z.string().uuid().optional(),
    exercise_id: z.string().uuid().nullable().optional(),
    order: z.number().int().min(1),
    status: z.enum(["planned", "skipped"]).optional(),
    source: setSourceEnum.optional(),
    notes: z.string().max(1000).nullable().optional(),
    planned: plannedAttributesSchema.nullable().optional(),
    actual: actualAttributesSchema.nullable().optional(),
    sets: z.array(sessionSetSchema).max(100).optional(),
  })
  .strict();

const plannedDurationSchema = z
  .number()
  .int()
  .min(SESSION_DURATION_LIMITS.min)
  .max(SESSION_DURATION_LIMITS.max);

const createSchema = z.object({
  /** "completed" logs a past workout in one request (ADR-042). */
  status: z.enum(["planned", "completed"]).optional(),
  completion_outcome: completionOutcomeEnum.optional(),
  plan_id: z.string().uuid().nullable().optional(),
  title: titleSchema.nullable().optional(),
  planned_at: z.string().datetime(),
  planned_duration_min: plannedDurationSchema.optional(),
  visibility: visibilityEnum.optional(),
  notes: z.string().max(1000).nullable().optional(),
  recurrence_rule: z.string().max(255).nullable().optional(),
  exercises: z.array(sessionExerciseSchema).max(50).optional(),
});

export const CreateSessionSchema = createSchema;
/** Request schemas checked against the OpenAPI spec (tests/backend/contract). */
export const SessionExerciseInputSchema = sessionExerciseSchema;
export const SessionSetInputSchema = sessionSetSchema;

const updateSchema = z
  .object({
    plan_id: z.string().uuid().nullable().optional(),
    title: titleSchema.nullable().optional(),
    planned_at: z.string().datetime().optional(),
    planned_duration_min: plannedDurationSchema.optional(),
    status: statusEnum.optional(),
    completion_outcome: completionOutcomeEnum.optional(),
    visibility: visibilityEnum.optional(),
    notes: z.string().max(1000).nullable().optional(),
    recurrence_rule: z.string().max(255).nullable().optional(),
    started_at: z.string().datetime().optional(),
    completed_at: z.string().datetime().optional(),
    calories: z.number().int().min(0).nullable().optional(),
    exercises: z.array(sessionExerciseSchema).max(50).optional(),
  })
  .strict();

export const UpdateSessionSchema = updateSchema;

const cloneSchema = z
  .object({
    planned_at: z.string().datetime().optional(),
    date_offset_days: z.number().int().min(-365).max(365).optional(),
    title: titleSchema.nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
    visibility: visibilityEnum.optional(),
    recurrence_rule: z.string().max(255).nullable().optional(),
    plan_id: z.string().uuid().nullable().optional(),
    include_actual: z.boolean().optional(),
  })
  .strict()
  .refine((value) => value.planned_at === undefined || value.date_offset_days === undefined, {
    message: "Provide either planned_at or date_offset_days, not both",
    path: ["planned_at"],
  });

const recurrenceSchema = z.object({
  occurrences: z.number().int().min(1).max(52),
  offset_days: z.number().int().min(1).max(180),
  start_from: z.string().datetime().optional(),
  include_actual: z.boolean().optional(),
  plan_id: z.string().uuid().nullable().optional(),
  visibility: visibilityEnum.optional(),
  title: titleSchema.nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  recurrence_rule: z.string().max(255).nullable().optional(),
});

const querySchema = z.object({
  status: statusEnum.optional(),
  plan_id: z.string().uuid().optional(),
  planned_from: z.string().datetime().optional(),
  planned_to: z.string().datetime().optional(),
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
});

function requireUser(req: Request, res: Response): string | null {
  const candidate = req.user;
  if (candidate && typeof candidate === "object" && "sub" in candidate) {
    const sub = (candidate as { sub?: unknown }).sub;
    if (typeof sub === "string") {
      return sub;
    }
  }
  res.status(401).json({ error: "Unauthorized" });
  return null;
}

export async function listSessionsHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) {
    return;
  }

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const result = await getAll(userId, parsed.data);
  res.json(result);
}

export async function getSessionHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) {
    return;
  }

  const id = readRouteParam(req.params.id, "id");
  const result = await getOne(userId, id);
  res.json(result);
}

export async function createSessionHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) {
    return;
  }

  getIdempotencyKey(req);
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const handled = await handleIdempotentRequest(req, res, userId, parsed.data, async () => {
    const body = await createOne(userId, parsed.data);
    return { status: 201, body };
  });

  if (!handled) {
    const body = await createOne(userId, parsed.data);
    res.status(201).json(body);
  }
}

export async function updateSessionHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) {
    return;
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const id = req.params.id;
  if (typeof id !== "string" || id.length === 0) {
    res.status(400).json({ error: "Session ID is required" });
    return;
  }

  const updated = await updateOne(userId, id, parsed.data);
  res.json(updated);
}

export async function cloneSessionHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) {
    return;
  }

  getIdempotencyKey(req);
  const parsed = cloneSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const handled = await handleIdempotentRequest(
    req,
    res,
    userId,
    { source_id: readRouteParam(req.params.id, "id"), ...parsed.data },
    async () => {
      const body = await cloneOne(userId, readRouteParam(req.params.id, "id"), parsed.data);
      return { status: 201, body };
    },
  );

  if (!handled) {
    const body = await cloneOne(userId, readRouteParam(req.params.id, "id"), parsed.data);
    res.status(201).json(body);
  }
}

export async function applyRecurrenceHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) {
    return;
  }

  getIdempotencyKey(req);
  const parsed = recurrenceSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const handled = await handleIdempotentRequest(
    req,
    res,
    userId,
    { source_id: readRouteParam(req.params.id, "id"), ...parsed.data },
    async () => {
      const sessions = await applyRecurrence(
        userId,
        readRouteParam(req.params.id, "id"),
        parsed.data,
      );
      return { status: 201, body: { sessions } };
    },
  );

  if (!handled) {
    const sessions = await applyRecurrence(
      userId,
      readRouteParam(req.params.id, "id"),
      parsed.data,
    );
    res.status(201).json({ sessions });
  }
}

export async function deleteSessionHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) {
    return;
  }

  const id = readRouteParam(req.params.id, "id");
  await cancelOne(userId, id);
  res.status(204).send();
}

export async function reopenSessionHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) {
    return;
  }

  const id = req.params.id;
  if (typeof id !== "string" || id.length === 0) {
    res.status(400).json({ error: "Session ID is required" });
    return;
  }

  const reopened = await reopenOne(userId, id);
  res.json(reopened);
}

export async function getSessionEstimateHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) {
    return;
  }

  const id = readRouteParam(req.params.id, "id");
  const estimate = await getSessionEstimate(userId, id);
  res.json(estimate);
}

export async function getSessionVibeChangesHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) {
    return;
  }

  const id = readRouteParam(req.params.id, "id");
  res.json(await getSessionVibeChanges(userId, id));
}

// --- Live workout execution (ADR-043) ---------------------------------------

const recordSetSchema = z
  .object({
    status: z.enum(["completed", "skipped"]),
    ...setMetricFields,
    notes: z.string().max(500).nullable().optional(),
  })
  .strict();

const addSetSchema = z.object({ planned: plannedSetValuesSchema.nullable().optional() }).strict();

const addExerciseSchema = z.object({ exercise_id: z.string().uuid() }).strict();

/** Request schemas checked against the OpenAPI spec (tests/backend/contract). */
export const RecordSetSchema = recordSetSchema;
export const AddSetSchema = addSetSchema;
export const AddExerciseSchema = addExerciseSchema;

async function executionCommand<T>(
  req: Request,
  res: Response,
  schema: z.ZodType<T> | null,
  command: (userId: string, sessionId: string, body: T) => Promise<unknown>,
  options: { idempotent?: boolean; status?: number } = {},
): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) {
    return;
  }
  const parsed = schema
    ? schema.safeParse(req.body ?? {})
    : { success: true as const, data: {} as T };
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const sessionId = readRouteParam(req.params.id, "id");
  const status = options.status ?? 200;
  if (options.idempotent) {
    getIdempotencyKey(req);
    const handled = await handleIdempotentRequest(req, res, userId, parsed.data, async () => ({
      status,
      body: await command(userId, sessionId, parsed.data),
    }));
    if (handled) {
      return;
    }
  }
  res.status(status).json(await command(userId, sessionId, parsed.data));
}

export const pauseSessionHandler = (req: Request, res: Response) =>
  executionCommand(req, res, null, (userId, sessionId) => pauseSession(userId, sessionId));

export const resumeSessionHandler = (req: Request, res: Response) =>
  executionCommand(req, res, null, (userId, sessionId) => resumeSession(userId, sessionId));

export const recordSetHandler = (req: Request, res: Response) =>
  executionCommand(req, res, recordSetSchema, (userId, sessionId, body) =>
    recordSet(userId, sessionId, readRouteParam(req.params.setId, "setId"), body),
  );

export const addSetHandler = (req: Request, res: Response) =>
  executionCommand(
    req,
    res,
    addSetSchema,
    (userId, sessionId, body) =>
      addSet(userId, sessionId, readRouteParam(req.params.exerciseId, "exerciseId"), body),
    { idempotent: true, status: 201 },
  );

export const addExerciseHandler = (req: Request, res: Response) =>
  executionCommand(
    req,
    res,
    addExerciseSchema,
    (userId, sessionId, body) => addExercise(userId, sessionId, body),
    { idempotent: true, status: 201 },
  );

export const skipExerciseHandler = (req: Request, res: Response) =>
  executionCommand(req, res, null, (userId, sessionId) =>
    skipExercise(userId, sessionId, readRouteParam(req.params.exerciseId, "exerciseId")),
  );
