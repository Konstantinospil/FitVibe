import type { Knex } from "knex";

const CONTACTS = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    user_id: "11111111-1111-4111-8111-111111111111",
    type: "email",
    value: "admin@fitvibe.local",
    is_primary: true,
    is_recovery: true,
    is_verified: true,
    verified_at: new Date(),
    created_at: new Date(),
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    user_id: "22222222-2222-4222-8222-222222222222",
    type: "email",
    value: "jane.doe@example.com",
    is_primary: true,
    is_recovery: false,
    is_verified: true,
    verified_at: new Date(),
    created_at: new Date(),
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    user_id: "22222222-2222-4222-8222-222222222222",
    type: "phone",
    value: "+12025550123",
    is_primary: false,
    is_recovery: true,
    is_verified: false,
    verified_at: null,
    created_at: new Date(),
  },
];

export async function seed(knex: Knex): Promise<void> {
  await knex("user_contacts").insert(CONTACTS).onConflict("id").ignore();
}
