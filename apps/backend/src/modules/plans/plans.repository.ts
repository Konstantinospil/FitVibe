import type { Knex } from "knex";
import { db } from "../../db/connection.js";

const PLANS_TABLE = "plans";

export interface PlanRow {
  id: string;
  user_id: string;
  name: string;
  status: "active" | "completed";
  progress_percent: string | number;
  session_count: number;
  completed_count: number;
  start_date: string | null;
  end_date: string | null;
  duration_weeks?: number | null;
  target_frequency?: number | null;
  time_zone?: string;
  activated_at?: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  revision: number;
}

export interface CreatePlanInput {
  id: string;
  user_id: string;
  name: string;
  status?: "active" | "completed";
  start_date?: string | null;
  end_date?: string | null;
  duration_weeks?: number | null;
  target_frequency?: number | null;
  time_zone?: string;
}

export interface UpdatePlanInput {
  name?: string;
  status?: "active" | "completed";
  progress_percent?: number;
  session_count?: number;
  completed_count?: number;
  start_date?: string | null;
  end_date?: string | null;
  duration_weeks?: number | null;
  target_frequency?: number | null;
  time_zone?: string;
}

export interface ListPlansFilters {
  userId?: string;
  status?: "active" | "completed";
  includeArchived?: boolean;
  search?: string;
}

function withDb(trx?: Knex.Transaction) {
  return trx ?? db;
}

/**
 * Find a plan by ID
 */
export async function findPlanById(
  planId: string,
  options?: { includeArchived?: boolean; trx?: Knex.Transaction },
): Promise<PlanRow | undefined> {
  const query = withDb(options?.trx)<PlanRow>(PLANS_TABLE).where({ id: planId });

  if (!options?.includeArchived) {
    query.whereNull("archived_at");
  }

  return query.first();
}

/**
 * List plans with optional filters
 */
export async function listPlans(
  filters?: ListPlansFilters,
  pagination?: { limit?: number; offset?: number },
  trx?: Knex.Transaction,
): Promise<PlanRow[]> {
  const query = withDb(trx)<PlanRow>(PLANS_TABLE);

  if (filters?.userId) {
    query.where({ user_id: filters.userId });
  }

  if (filters?.status) {
    query.where({ status: filters.status });
  }

  if (!filters?.includeArchived) {
    query.whereNull("archived_at");
  }

  if (filters?.search !== undefined && filters?.search !== null) {
    query.whereRaw("LOWER(name) LIKE ?", [`%${filters.search.toLowerCase()}%`]);
  }

  query.orderBy("created_at", "desc");

  if (pagination?.limit !== undefined) {
    query.limit(pagination.limit);
  }

  if (pagination?.offset !== undefined) {
    query.offset(pagination.offset);
  }

  return query;
}

/**
 * Create a new plan
 */
export async function createPlan(input: CreatePlanInput, trx?: Knex.Transaction): Promise<PlanRow> {
  const now = new Date().toISOString();

  const planData = {
    id: input.id,
    user_id: input.user_id,
    name: input.name,
    status: input.status ?? "active",
    progress_percent: 0,
    session_count: 0,
    completed_count: 0,
    start_date: input.start_date ?? null,
    end_date: input.end_date ?? null,
    duration_weeks: input.duration_weeks ?? null,
    target_frequency: input.target_frequency ?? null,
    time_zone: input.time_zone ?? "UTC",
    created_at: now,
    updated_at: now,
    archived_at: null,
    revision: 1,
  };

  const [created] = await withDb(trx)<PlanRow>(PLANS_TABLE).insert(planData).returning("*");

  return created;
}

/**
 * Update an existing plan
 */
export async function updatePlan(
  planId: string,
  updates: UpdatePlanInput,
  trx?: Knex.Transaction,
  expectedRevision?: number,
): Promise<number> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    revision: db.raw("revision + 1"),
  };

  if (updates.name !== undefined) {
    patch.name = updates.name;
  }

  if (updates.status !== undefined) {
    patch.status = updates.status;
  }

  if (updates.progress_percent !== undefined) {
    patch.progress_percent = updates.progress_percent;
  }

  if (updates.session_count !== undefined) {
    patch.session_count = updates.session_count;
  }

  if (updates.completed_count !== undefined) {
    patch.completed_count = updates.completed_count;
  }

  if (updates.start_date !== undefined) {
    patch.start_date = updates.start_date;
  }

  if (updates.end_date !== undefined) {
    patch.end_date = updates.end_date;
  }

  const query = withDb(trx)<PlanRow>(PLANS_TABLE).where({ id: planId }).whereNull("archived_at");

  // Compare-and-swap in SQL: two simultaneous editors cannot both win.
  if (expectedRevision !== undefined) {
    query.where({ revision: expectedRevision });
  }

  return query.update(patch);
}

/**
 * Archive a plan (soft delete)
 */
export async function archivePlan(planId: string, trx?: Knex.Transaction): Promise<number> {
  return withDb(trx)<PlanRow>(PLANS_TABLE)
    .where({ id: planId })
    .whereNull("archived_at")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revision: db.raw("revision + 1"),
    });
}

/**
 * Soft delete a plan
 */
export async function deletePlan(planId: string, trx?: Knex.Transaction): Promise<number> {
  return archivePlan(planId, trx);
}

/**
 * Count plans for a user
 */
export async function countUserPlans(
  userId: string,
  filters?: { status?: "active" | "completed"; includeArchived?: boolean },
  trx?: Knex.Transaction,
): Promise<number> {
  const query = withDb(trx)<PlanRow>(PLANS_TABLE).where({ user_id: userId });

  if (filters?.status) {
    query.where({ status: filters.status });
  }

  if (!filters?.includeArchived) {
    query.whereNull("archived_at");
  }

  const result = await query.count<{ count: string }>("* as count").first();
  return parseInt(result?.count ?? "0", 10);
}

/**
 * Update plan progress metrics
 */
export async function updatePlanProgress(
  planId: string,
  sessionCount: number,
  completedCount: number,
  trx?: Knex.Transaction,
): Promise<number> {
  const progressPercent = sessionCount > 0 ? (completedCount / sessionCount) * 100 : 0;

  return withDb(trx)<PlanRow>(PLANS_TABLE)
    .where({ id: planId })
    .whereNull("archived_at")
    .update({
      session_count: sessionCount,
      completed_count: completedCount,
      progress_percent: Math.round(progressPercent * 100) / 100, // Round to 2 decimal places
      updated_at: new Date().toISOString(),
      revision: db.raw("revision + 1"),
    });
}
