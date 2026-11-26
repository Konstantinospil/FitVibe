import type { Knex } from "knex";

const now = new Date();

const EXERCISES = [
  {
    id: "77777777-7777-4777-8777-777777777777",
    owner_id: null,
    name: "Barbell Back Squat",
    type_code: "strength",
    muscle_group: "legs",
    equipment: "barbell",
    tags: ["compound", "lower-body", "strength"],
    is_public: true,
    description: "Classic compound lift driving posterior chain strength and power.",
    created_at: now,
    updated_at: now,
    archived_at: null,
  },
  {
    id: "77777777-7777-4777-8777-777777777778",
    owner_id: null,
    name: "Barbell Bench Press",
    type_code: "strength",
    muscle_group: "chest",
    equipment: "barbell",
    tags: ["compound", "upper-body", "push"],
    is_public: true,
    description: "Horizontal press developing chest, shoulders, and triceps strength.",
    created_at: now,
    updated_at: now,
    archived_at: null,
  },
  {
    id: "77777777-7777-4777-8777-777777777779",
    owner_id: null,
    name: "Conventional Deadlift",
    type_code: "strength",
    muscle_group: "full_body",
    equipment: "barbell",
    tags: ["compound", "pull", "posterior-chain"],
    is_public: true,
    description: "Foundational pull from the floor engaging glutes, hamstrings, and back.",
    created_at: now,
    updated_at: now,
    archived_at: null,
  },
  {
    id: "77777777-7777-4777-8777-777777777780",
    owner_id: null,
    name: "Tempo Run 5K",
    type_code: "cardio",
    muscle_group: "legs",
    equipment: "other",
    tags: ["tempo", "endurance", "run"],
    is_public: true,
    description: "Sustained 5K run at threshold pace to build running endurance.",
    created_at: now,
    updated_at: now,
    archived_at: null,
  },
  {
    id: "77777777-7777-4777-8777-777777777781",
    owner_id: null,
    name: "Endurance Ride 60k",
    type_code: "cardio",
    muscle_group: "legs",
    equipment: "other",
    tags: ["endurance", "ride", "aerobic"],
    is_public: true,
    description: "Steady-state 60 km ride focused on aerobic capacity and cadence control.",
    created_at: now,
    updated_at: now,
    archived_at: null,
  },
  {
    id: "88888888-8888-8888-8888-888888888888",
    owner_id: "22222222-2222-4222-8222-222222222222",
    name: "Tempo Run 5K",
    type_code: "cardio",
    muscle_group: "legs",
    equipment: "other",
    tags: ["tempo", "endurance"],
    is_public: false,
    description: "5K tempo run targeting threshold pace.",
    created_at: now,
    updated_at: now,
    archived_at: null,
  },
];

export async function seed(knex: Knex): Promise<void> {
  await knex("exercises")
    .insert(
      EXERCISES.map((exercise) => ({
        ...exercise,
        tags: JSON.stringify(exercise.tags),
      })),
    )
    .onConflict("id")
    .ignore();
}
