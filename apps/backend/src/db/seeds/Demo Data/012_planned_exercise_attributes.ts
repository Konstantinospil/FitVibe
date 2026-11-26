import type { Knex } from "knex";

const now = new Date();

const PLANNED = [
  {
    id: "eeeeeee1-eeee-4eee-8eee-eeeeeeeeeeee",
    session_exercise_id: "bbbbbbb1-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
    sets: 5,
    reps: 3,
    load: 120,
    distance: null,
    duration: null,
    rpe: 8,
    rest: "00:03:00",
    extras: { tempo: "31X1" },
    created_at: now,
  },
  {
    id: "fffffff1-ffff-4fff-8fff-ffffffffffff",
    session_exercise_id: "ccccccc1-cccc-4ccc-8ccc-cccccccccccc",
    sets: 3,
    reps: 6,
    load: 90,
    distance: null,
    duration: null,
    rpe: 7,
    rest: "00:02:30",
    extras: {},
    created_at: now,
  },
  {
    id: "11111111-aaaa-4bbb-8ccc-222222222222",
    session_exercise_id: "ddddddd1-dddd-4ddd-8ddd-dddddddddddd",
    sets: null,
    reps: null,
    load: null,
    distance: 5,
    duration: "00:40:00",
    rpe: 7,
    rest: null,
    extras: { pace: "4:00/km" },
    created_at: now,
  },
];

export async function seed(knex: Knex): Promise<void> {
  await knex("planned_exercise_attributes")
    .insert(PLANNED)
    .onConflict("session_exercise_id")
    .merge();
}
