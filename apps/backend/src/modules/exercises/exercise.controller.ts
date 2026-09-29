import type { Request, Response } from "express";
import { readRouteParam } from "../../utils/http.js";
import { z } from "zod";
import { getAll, getOne, createOne, updateOne, archiveOne } from "./exercise.service.js";
import type { ExerciseQuery } from "./exercise.types.js";
import type { JwtPayload } from "../auth/auth.types.js";
import { handleIdempotentRequest } from "../common/idempotency.helpers.js";

const tagInputSchema = z.union([z.string(), z.array(z.string())]);

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type_code: z.string().trim().min(1).max(50),
  muscle_group: z.string().trim().max(120).optional(),
  equipment: z.string().trim().max(120).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(25).optional(),
  is_public: z.boolean().optional(),
  description_en: z.string().trim().max(2000).optional(),
  description_de: z.string().trim().max(2000).optional(),
  owner_id: z.string().uuid().nullable().optional(),
});

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    type_code: z.string().trim().min(1).max(50).optional(),
    muscle_group: z.string().trim().max(120).optional(),
    equipment: z.string().trim().max(120).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(25).optional(),
    is_public: z.boolean().optional(),
    description_en: z.string().trim().max(2000).optional(),
    description_de: z.string().trim().max(2000).optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field must be provided",
  });

const querySchema = z.object({
  q: z.string().trim().max(120).optional(),
  type_code: z.string().trim().max(50).optional(),
  muscle_group: z.string().trim().max(120).optional(),
  equipment: z.string().trim().max(120).optional(),
  tags: tagInputSchema.optional(),
  include_archived: z.union([z.literal("true"), z.literal("false")]).optional(),
  is_public: z.union([z.literal("true"), z.literal("false")]).optional(),
  owner_id: z.union([z.string().uuid(), z.literal("null"), z.literal("global")]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

type AuthenticatedUser = JwtPayload;

function ensureAuthUser(req: Request, res: Response): AuthenticatedUser | null {
  const authUser = req.user;
  if (!authUser) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return authUser;
}

function normalizeTagsInput(tags?: unknown): string[] | undefined {
  if (tags === undefined) {
    return undefined;
  }
  const rawList = Array.isArray(tags) ? tags : [tags];
  const flattened = rawList
    .flatMap((entry) => String(entry).split(","))
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
  if (!flattened.length) {
    return undefined;
  }
  return Array.from(new Set(flattened));
}

export async function listExercisesHandler(req: Request, res: Response): Promise<void> {
  const authUser = ensureAuthUser(req, res);
  if (!authUser) {
    return;
  }
  const userId = authUser.sub;
  const isAdmin = authUser.role === "admin";
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { q, type_code, muscle_group, equipment, limit, offset } = parsed.data;
  const tags = normalizeTagsInput(parsed.data.tags);
  const include_archived = parsed.data.include_archived === "true";
  const is_public =
    parsed.data.is_public === undefined ? undefined : parsed.data.is_public === "true";

  const ownerFilterRaw = parsed.data.owner_id;
  const owner_id =
    ownerFilterRaw === undefined
      ? undefined
      : ownerFilterRaw === "null" || ownerFilterRaw === "global"
        ? null
        : ownerFilterRaw;

  const query: ExerciseQuery = {
    q,
    type_code,
    muscle_group,
    equipment,
    tags,
    include_archived,
    is_public,
    limit,
    offset,
  };

  if (isAdmin && owner_id !== undefined) {
    query.owner_id = owner_id;
  }

  const data = await getAll(userId, query, isAdmin);
  res.json(data);
}

export async function getExerciseHandler(req: Request, res: Response): Promise<void> {
  const authUser = ensureAuthUser(req, res);
  if (!authUser) {
    return;
  }
  const userId = authUser.sub;
  const isAdmin = authUser.role === "admin";
  const id = readRouteParam(req.params.id, "id");
  const data = await getOne(id, userId, isAdmin);
  res.json(data);
}

export async function createExerciseHandler(req: Request, res: Response): Promise<void> {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const authUser = ensureAuthUser(req, res);
  if (!authUser) {
    return;
  }
  const userId = authUser.sub;
  const isAdmin = authUser.role === "admin";

  const handled = await handleIdempotentRequest(req, res, userId, parsed.data, async () => {
    const body = await createOne(userId, parsed.data, isAdmin);
    return { status: 201, body };
  });

  if (!handled) {
    const body = await createOne(userId, parsed.data, isAdmin);
    res.status(201).json(body);
  }
}

export async function updateExerciseHandler(req: Request, res: Response): Promise<void> {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const authUser = ensureAuthUser(req, res);
  if (!authUser) {
    return;
  }
  const userId = authUser.sub;
  const isAdmin = authUser.role === "admin";
  const id = readRouteParam(req.params.id, "id");

  const handled = await handleIdempotentRequest(req, res, userId, parsed.data, async () => {
    const body = await updateOne(id, userId, parsed.data, isAdmin);
    return { status: 200, body };
  });

  if (!handled) {
    const body = await updateOne(id, userId, parsed.data, isAdmin);
    res.json(body);
  }
}

export async function deleteExerciseHandler(req: Request, res: Response): Promise<void> {
  const authUser = ensureAuthUser(req, res);
  if (!authUser) {
    return;
  }
  const userId = authUser.sub;
  const isAdmin = authUser.role === "admin";
  const id = readRouteParam(req.params.id, "id");

  const handled = await handleIdempotentRequest(req, res, userId, { id }, async () => {
    await archiveOne(id, userId, isAdmin);
    return { status: 204, body: null };
  });

  if (!handled) {
    await archiveOne(id, userId, isAdmin);
    res.status(204).send();
  }
}
