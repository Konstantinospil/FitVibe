import type { Knex } from "knex";

const EXERCISE_SETS = [
  {
    id: "eeeeeee1-eeee-4eee-8eee-eeeeeeeeeeee",
    session_exercise_id: "bbbbbbb1-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
    order_index: 1,
    // Prescription of a planned session (ADR-042): targets live in planned_*.
    status: "planned",
    source: "prescribed",
    planned_reps: 3,
    planned_weight_kg: 150,
    planned_rpe: 9,
    notes: "Top set",
    created_at: new Date(),
  },
  {
    id: "fffffff1-ffff-4fff-8fff-ffffffffffff",
    session_exercise_id: "bbbbbbb1-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
    order_index: 2,
    status: "planned",
    source: "prescribed",
    planned_reps: 5,
    planned_weight_kg: 120,
    planned_rpe: 7,
    notes: "Back-off",
    created_at: new Date(),
  },
  {
    id: "11111111-aaaa-4bbb-8ccc-222222222222",
    session_exercise_id: "ddddddd1-dddd-4ddd-8ddd-dddddddddddd",
    order_index: 1,
    // Performed work of a completed session.
    status: "completed",
    source: "prescribed",
    reps: null,
    weight_kg: null,
    duration_sec: 1800,
    distance_m: 8000,
    rpe: 6,
    notes: "Steady tempo",
    created_at: new Date(),
  },
];

export async function seed(knex: Knex): Promise<void> {
  await knex("exercise_sets").insert(EXERCISE_SETS).onConflict("id").ignore();
}
