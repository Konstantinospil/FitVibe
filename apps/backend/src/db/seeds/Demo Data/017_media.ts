import type { Knex } from "knex";

const MEDIA = [
  {
    id: "bbbb2222-cccc-4333-8ddd-444444444444",
    owner_id: "22222222-2222-4222-8222-222222222222",
    target_type: "session",
    target_id: "aaaaaaa1-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
    storage_key: "sessions/aaaaaaa1-aaaa-4aaa-aaaa-aaaaaaaaaaaa/summary.jpg",
    file_url: "https://cdn.fitvibe.local/sessions/tempo-run-summary.jpg",
    mime_type: "image/jpeg",
    media_type: "photo",
    bytes: 245678,
    created_at: new Date(),
  },
];

export async function seed(knex: Knex): Promise<void> {
  await knex("media").insert(MEDIA).onConflict("id").ignore();
}
