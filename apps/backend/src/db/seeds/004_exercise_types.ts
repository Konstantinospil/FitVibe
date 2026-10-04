import type { Knex } from "knex";

const EXERCISE_TYPES = [
  { code: "strength", name: "Strength", description: "Strength & resistance training" },
  { code: "cardio", name: "Cardio", description: "Cardiovascular / endurance work" },
  { code: "balance", name: "Balance", description: "Balance, coordination, and stability work" },
  { code: "mobility", name: "Mobility", description: "Mobility and flexibility drills" },
  { code: "skill", name: "Skill", description: "Skill technique or sport-specific drills" },
  { code: "recovery", name: "Recovery", description: "Recovery and regeneration sessions" },
  { code: "endurance", name: "Endurance", description: "Endurance training" },
  { code: "hiit", name: "HIIT", description: "High-intensity interval training" },
  { code: "plyometrics", name: "Plyometrics", description: "Plyometric exercises" },
  { code: "circuit", name: "Circuit", description: "Circuit training" },
  { code: "crossfit", name: "CrossFit", description: "CrossFit workouts" },
  { code: "yoga", name: "Yoga", description: "Yoga sessions" },
  { code: "pilates", name: "Pilates", description: "Pilates sessions" },
  { code: "functional", name: "Functional", description: "Functional training" },
  { code: "bodyweight", name: "Bodyweight", description: "Bodyweight exercises" },
  { code: "warmup", name: "Warm-up", description: "Warm-up activities" },
  { code: "cooldown", name: "Cool-down", description: "Cool-down activities" },
  { code: "rehab", name: "Rehab", description: "Rehabilitation exercises" },
  { code: "sports", name: "Sports", description: "Sports-specific training" },
  { code: "other", name: "Other", description: "Other types of exercise" },
  {
    code: "agility",
    name: "Agility",
    description: "Agility, coordination, and movement skill — yield, play, flight",
  },
  {
    code: "explosivity",
    name: "Explosivity",
    description: "Power, sprints, jumps, and throws — the spark that becomes a leap",
  },
  {
    code: "intelligence",
    name: "Intelligence",
    description: "Skill, precision, and the inner game — riddles at the edge of the map",
  },
  {
    code: "regeneration",
    name: "Regeneration",
    description: "Recovery, mobility, and restoration — the sleep that mends the hero",
  },
];

export async function seed(knex: Knex): Promise<void> {
  await knex("exercise_types")
    .insert(EXERCISE_TYPES)
    .onConflict("code")
    .merge(["name", "description"]);
}
