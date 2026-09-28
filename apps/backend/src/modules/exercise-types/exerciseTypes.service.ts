import {
  listExerciseTypes,
  getExerciseType,
  getTranslatedExerciseTypes,
  createExerciseType,
  updateExerciseType,
  deleteExerciseType,
} from "./exerciseTypes.repository.js";
import type { ExerciseType } from "./exerciseTypes.types.js";
import NodeCache from "node-cache";
import { insertAudit } from "../common/audit.util.js";

// Narrow implementation constant: cache behavior is not product/admin policy.
const EXERCISE_TYPES_CACHE_TTL_SECONDS = 60;
const cache = new NodeCache({ stdTTL: EXERCISE_TYPES_CACHE_TTL_SECONDS });

function invalidateTypesCache() {
  for (const k of cache.keys()) {
    if (k.startsWith("types_")) {
      cache.del(k);
    }
  }
}

export async function getAllTypes(locale?: string): Promise<ExerciseType[]> {
  const key = locale ? `types_${locale}` : "types_default";
  const cached = cache.get<ExerciseType[]>(key);
  if (cached) {
    return cached;
  }

  const types = locale ? await getTranslatedExerciseTypes(locale) : await listExerciseTypes();

  cache.set(key, types);
  return types;
}

export async function getOneType(code: string): Promise<ExerciseType | null> {
  const type = await getExerciseType(code);
  if (!type) {
    return null;
  }
  return type;
}

export async function addType(
  dto: ExerciseType,
  userId?: string,
): Promise<ExerciseType | undefined> {
  const exists = await getExerciseType(dto.code);
  if (exists) {
    throw Object.assign(new Error("EXERCISE_INVALID_TYPE"), { status: 409 });
  }
  await createExerciseType(dto);
  invalidateTypesCache();
  if (userId) {
    await insertAudit({
      actorUserId: userId,
      entityType: "exercise_types",
      action: "create",
      entityId: dto.code,
      metadata: { code: dto.code },
    });
  }
  return getExerciseType(dto.code);
}

export async function editType(
  code: string,
  updates: Partial<ExerciseType>,
  userId?: string,
): Promise<ExerciseType | undefined> {
  const existing = await getExerciseType(code);
  if (!existing) {
    throw Object.assign(new Error("EXERCISE_NOT_FOUND"), { status: 404 });
  }
  await updateExerciseType(code, updates);
  invalidateTypesCache();
  if (userId) {
    await insertAudit({
      actorUserId: userId,
      entityType: "exercise_types",
      action: "update",
      entityId: code,
      metadata: { code },
    });
  }
  return getExerciseType(code);
}

export async function removeType(code: string, userId?: string): Promise<void> {
  const existing = await getExerciseType(code);
  if (!existing) {
    throw Object.assign(new Error("EXERCISE_NOT_FOUND"), { status: 404 });
  }
  invalidateTypesCache();
  await deleteExerciseType(code);
  if (userId) {
    await insertAudit({
      actorUserId: userId,
      entityType: "exercise_types",
      action: "delete",
      entityId: code,
      metadata: { code },
    });
  }
}
