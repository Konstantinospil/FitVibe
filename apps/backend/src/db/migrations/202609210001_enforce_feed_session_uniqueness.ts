import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    DELETE FROM feed_items duplicate
    USING feed_items keeper
    WHERE duplicate.session_id IS NOT NULL
      AND keeper.session_id = duplicate.session_id
      AND (
        keeper.created_at < duplicate.created_at
        OR (keeper.created_at = duplicate.created_at AND keeper.id < duplicate.id)
      )
  `);

  await knex.schema.alterTable("feed_items", (table) => {
    table.unique(["session_id"], {
      indexName: "feed_items_session_id_unique",
    });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("feed_items", (table) => {
    table.dropUnique(["session_id"], "feed_items_session_id_unique");
  });
}
