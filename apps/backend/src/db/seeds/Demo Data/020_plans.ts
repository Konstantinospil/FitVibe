import type { Knex } from "knex";

const PLANS = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    user_id: "22222222-2222-4222-8222-222222222222",
    name: "Autumn Marathon Build",
    status: "active",
    progress_percent: 42.5,
    session_count: 24,
    completed_count: 10,
    start_date: new Date(),
    end_date: null,
    created_at: new Date(),
    updated_at: new Date(),
    archived_at: null,
  },
];

export async function seed(knex: Knex): Promise<void> {
  await knex("plans").insert(PLANS).onConflict("id").ignore();
}
