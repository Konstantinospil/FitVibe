import type { Knex } from "knex";
import { db } from "../../db/connection.js";
import type { Exercise, ExerciseQuery, PaginatedResult } from "./exercise.types.js";

function applyOwnershipFilter(
  query: Knex.QueryBuilder<Exercise, Exercise[]>,
  userId: string,
  isAdmin: boolean,
  ownerFilter?: string | null,
) {
  if (isAdmin) {
    if (ownerFilter === null) {
      query.whereNull("owner_id");
    } else if (ownerFilter) {
      query.where({ owner_id: ownerFilter });
    }
    return;
  }

  query.where((builder) => {
    builder.whereNull("owner_id").orWhere("owner_id", userId).orWhere("is_public", true);
  });
}

export async function listExercises(
  userId: string,
  queryParams: ExerciseQuery,
  isAdmin: boolean,
): Promise<PaginatedResult<Exercise>> {
  const {
    q,
    type_code,
    include_archived,
    limit = 20,
    offset = 0,
    owner_id,
    muscle_group,
    equipment,
    tags,
    is_public,
  } = queryParams;

  const baseQuery = db<Exercise>("exercises");
  applyOwnershipFilter(baseQuery, userId, isAdmin, owner_id);

  if (!include_archived) {
    baseQuery.whereNull("archived_at");
  }
  if (type_code) {
    baseQuery.andWhere("type_code", type_code);
  }
  if (muscle_group) {
    baseQuery.andWhereILike("muscle_group", `%${muscle_group}%`);
  }
  if (equipment) {
    baseQuery.andWhereILike("equipment", `%${equipment}%`);
  }
  if (typeof is_public === "boolean") {
    baseQuery.andWhere("is_public", is_public);
  }
  if (tags && tags.length) {
    baseQuery.andWhereRaw("tags @> ?", [JSON.stringify(tags)]);
  }
  if (q) {
    baseQuery.andWhere(function () {
      this.whereILike("name", `%${q}%`).orWhereILike("description", `%${q}%`);
    });
  }

  const totalRow = await baseQuery.clone().count<{ count: string }[]>("* as count");
  const total = totalRow.length ? parseInt(totalRow[0].count, 10) : 0;

  const data = await baseQuery
    .clone()
    .select(
      "id",
      "owner_id",
      "name",
      "type_code",
      "muscle_group",
      "equipment",
      "tags",
      "is_public",
      db.raw("description as description_en"),
      db.raw("NULL as description_de"),
      "created_at",
      "updated_at",
      "archived_at",
    )
    .orderBy("name")
    .limit(limit)
    .offset(offset);

  return { data: data as unknown as Exercise[], total, limit, offset };
}

export async function getExercise(id: string, scopeUserId: string) {
  return db<Exercise>("exercises")
    .where({ id })
    .whereNull("archived_at")
    .andWhere((builder) => {
      builder.whereNull("owner_id").orWhere("owner_id", scopeUserId).orWhere("is_public", true);
    })
    .first();
}

export async function getExerciseRaw(id: string) {
  return db<Exercise>("exercises").where({ id }).first();
}

export async function createExercise(row: Exercise) {
  const { description_en, description_de, ...rest } = row;
  void description_de;
  return db("exercises").insert({
    ...rest,
    description: description_en,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: null,
  });
}

export async function updateExercise(id: string, updates: Partial<Exercise>) {
  const { description_en, description_de, ...rest } = updates;
  void description_de;
  const patch: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() };
  if (description_en !== undefined) {
    patch.description = description_en;
  }
  return db("exercises").where({ id }).update(patch);
}

export async function archiveExercise(id: string) {
  return db("exercises").where({ id }).update({
    archived_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}
