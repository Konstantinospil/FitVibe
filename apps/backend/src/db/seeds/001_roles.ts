import type { Knex } from "knex";

const ROLES = [
  { code: "admin", description: "Keeps the map: platform steward for the six stories" },
  {
    code: "superadmin",
    description: "Privileged platform administrator with sudo-gated system authority",
  },
  {
    code: "coach",
    description: "Mentor for a chapter, with the athlete's consent — then you leave",
  },
  { code: "athlete", description: "The one who must live all six elemental stories" },
  { code: "support", description: "Mends the hero: nutrition, physio, and care between quests" },
];

export async function seed(knex: Knex): Promise<void> {
  await knex("roles").insert(ROLES).onConflict("code").merge(["description"]);
}
