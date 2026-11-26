import type { Knex } from "knex";

const now = new Date();

const BADGES = [
  {
    id: "55555555-6666-7777-8888-999999999999",
    user_id: "22222222-2222-4222-8222-222222222222",
    badge_type: "first_session",
    awarded_at: now,
    metadata: {
      session_id: "aaaaaaa1-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
    },
  },
];

export async function seed(knex: Knex): Promise<void> {
  await knex("badges").insert(BADGES).onConflict("id").ignore();
}
