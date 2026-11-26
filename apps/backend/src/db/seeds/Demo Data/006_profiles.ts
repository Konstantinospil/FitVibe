import type { Knex } from "knex";

export async function seed(knex: Knex): Promise<void> {
  const now = new Date();
  const rows = [
    {
      user_id: "11111111-1111-4111-8111-111111111111",
      date_of_birth: null,
      gender_code: "prefer_not_to_say",
      alias: "admin",
      alias_changed_at: now,
      visibility: "private",
      created_at: now,
      updated_at: now,
    },
    {
      user_id: "22222222-2222-4222-8222-222222222222",
      date_of_birth: "1994-05-12",
      gender_code: "woman",
      alias: "jane.doe",
      alias_changed_at: now,
      visibility: "private",
      fitness_level_code: "intermediate",
      training_frequency: "3_4_per_week",
      created_at: now,
      updated_at: now,
    },
  ];

  await knex("profiles").insert(rows).onConflict("user_id").merge();
}
