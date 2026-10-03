import { v4 as uuidv4 } from "uuid";
import { db } from "../../db/connection.js";
import { HttpError } from "../../utils/http.js";
import {
  listExercises,
  getExercise,
  createExercise,
  updateExercise,
  archiveExercise,
  getExerciseRaw,
} from "./exercise.repository.js";
import type {
  CreateExerciseDTO,
  UpdateExerciseDTO,
  ExerciseQuery,
  PaginatedResult,
  Exercise,
} from "./exercise.types.js";

const ERROR_NOT_FOUND = "EXERCISE_NOT_FOUND";
const ERROR_FORBIDDEN = "EXERCISE_FORBIDDEN";
const ERROR_DUPLICATE = "EXERCISE_DUPLICATE";
const ERROR_INVALID_TYPE = "EXERCISE_INVALID_TYPE";

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function sanitizeNullable(value?: string | null): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function sanitizeTags(tags?: string[]): string[] {
  if (!tags) {
    return [];
  }
  const unique = new Set<string>();
  for (const tag of tags) {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed) {
      unique.add(trimmed);
    }
  }
  return Array.from(unique).slice(0, 25);
}

type ExerciseTypeRow = {
  code: string;
};

async function ensureTypeExists(typeCode: string) {
  const trimmed = typeCode.trim();
  const type = await db<ExerciseTypeRow>("exercise_types").where({ code: trimmed }).first();
  if (!type) {
    throw new HttpError(400, ERROR_INVALID_TYPE, "EXERCISE_INVALID_TYPE");
  }
}

async function ensureNameUnique(ownerId: string | null, name: string, excludeId?: string) {
  const normalized = normalizeName(name);
  const query = db<Exercise>("exercises")
    .whereRaw("LOWER(name) = ?", [normalized])
    .andWhere((builder) => {
      if (ownerId === null) {
        builder.whereNull("owner_id");
      } else {
        builder.where("owner_id", ownerId);
      }
    })
    .whereNull("archived_at");

  if (excludeId) {
    query.andWhereNot({ id: excludeId });
  }

  const existing = await query.first<Exercise>();
  if (existing) {
    throw new HttpError(409, ERROR_DUPLICATE, "EXERCISE_DUPLICATE");
  }
}

export async function getAll(
  userId: string,
  query: ExerciseQuery,
  isAdmin = false,
): Promise<PaginatedResult<Exercise>> {
  return listExercises(userId, query, isAdmin);
}

export async function getOne(id: string, userId: string, isAdmin = false): Promise<Exercise> {
  const exercise = isAdmin ? await getExerciseRaw(id) : await getExercise(id, userId);
  const canRead =
    exercise && (exercise.owner_id === null || exercise.owner_id === userId || exercise.is_public);

  if (!exercise || (!isAdmin && (!canRead || exercise.archived_at))) {
    throw new HttpError(404, ERROR_NOT_FOUND, "EXERCISE_NOT_FOUND");
  }
  return exercise;
}

export async function createOne(
  userId: string,
  dto: CreateExerciseDTO,
  isAdmin = false,
): Promise<Exercise> {
  if (!isAdmin) {
    if (dto.owner_id && dto.owner_id !== userId) {
      throw new HttpError(403, ERROR_FORBIDDEN, "EXERCISE_FORBIDDEN");
    }
    if (dto.owner_id === null) {
      throw new HttpError(403, ERROR_FORBIDDEN, "EXERCISE_FORBIDDEN");
    }
  }

  await ensureTypeExists(dto.type_code);

  const resolvedOwnerId = isAdmin ? (dto.owner_id === undefined ? null : dto.owner_id) : userId;

  await ensureNameUnique(resolvedOwnerId, dto.name);

  const exercise: Exercise = {
    id: uuidv4(),
    name: dto.name.trim(),
    type_code: dto.type_code.trim(),
    owner_id: resolvedOwnerId,
    muscle_group: sanitizeNullable(dto.muscle_group),
    equipment: sanitizeNullable(dto.equipment),
    tags: sanitizeTags(dto.tags),
    is_public: dto.is_public ?? (resolvedOwnerId === null ? true : false),
    description_en: sanitizeNullable(dto.description_en),
    description_de: sanitizeNullable(dto.description_de),
    archived_at: null,
  };

  await createExercise(exercise);

  let created: Exercise | undefined;
  if (isAdmin && resolvedOwnerId !== null && resolvedOwnerId !== userId) {
    created = await getExerciseRaw(exercise.id);
  } else {
    const scopeId = resolvedOwnerId ?? userId;
    created = await getExercise(exercise.id, scopeId);
  }

  if (!created) {
    throw new HttpError(500, "EXERCISE_CREATE_FAILED", "EXERCISE_CREATE_FAILED");
  }

  return created;
}

export async function updateOne(
  id: string,
  userId: string,
  dto: UpdateExerciseDTO,
  isAdmin = false,
) {
  const existing = await getExerciseRaw(id);
  if (!existing) {
    throw new HttpError(404, ERROR_NOT_FOUND, "EXERCISE_NOT_FOUND");
  }

  const ownerId = existing.owner_id ?? null;
  if (!isAdmin) {
    if (ownerId === null || ownerId !== userId) {
      throw new HttpError(403, ERROR_FORBIDDEN, "EXERCISE_FORBIDDEN");
    }
  }

  if (dto.type_code) {
    await ensureTypeExists(dto.type_code);
  }

  if (dto.name) {
    await ensureNameUnique(ownerId, dto.name, id);
  }

  const updates: Partial<Exercise> = {};
  if (dto.name !== undefined) {
    updates.name = dto.name.trim();
  }
  if (dto.type_code !== undefined) {
    updates.type_code = dto.type_code.trim();
  }
  if (dto.muscle_group !== undefined) {
    updates.muscle_group = sanitizeNullable(dto.muscle_group);
  }
  if (dto.equipment !== undefined) {
    updates.equipment = sanitizeNullable(dto.equipment);
  }
  if (dto.tags !== undefined) {
    updates.tags = sanitizeTags(dto.tags);
  }
  if (dto.is_public !== undefined) {
    updates.is_public = dto.is_public;
  }
  if (dto.description_en !== undefined) {
    updates.description_en = sanitizeNullable(dto.description_en);
  }
  if (dto.description_de !== undefined) {
    updates.description_de = sanitizeNullable(dto.description_de);
  }

  const affected = await updateExercise(id, updates);
  if (affected === 0) {
    throw new HttpError(404, ERROR_NOT_FOUND, "EXERCISE_NOT_FOUND");
  }

  if (isAdmin) {
    const refreshed = await getExerciseRaw(id);
    if (!refreshed) {
      throw new HttpError(500, "EXERCISE_REFRESH_FAILED", "EXERCISE_REFRESH_FAILED");
    }
    return refreshed;
  }

  const refreshed = await getExercise(id, userId);
  if (!refreshed) {
    throw new HttpError(500, "EXERCISE_REFRESH_FAILED", "EXERCISE_REFRESH_FAILED");
  }
  return refreshed;
}

export async function archiveOne(id: string, userId: string, isAdmin = false): Promise<void> {
  const existing = await getExerciseRaw(id);
  if (!existing) {
    throw new HttpError(404, ERROR_NOT_FOUND, "EXERCISE_NOT_FOUND");
  }

  const ownerId = existing.owner_id ?? null;
  if (!isAdmin) {
    if (ownerId === null || ownerId !== userId) {
      throw new HttpError(403, ERROR_FORBIDDEN, "Cannot archive this exercise");
    }
  }

  const affected = await archiveExercise(id);
  if (affected === 0) {
    throw new HttpError(404, ERROR_NOT_FOUND, "EXERCISE_NOT_FOUND");
  }
}
