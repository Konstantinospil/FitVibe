import type { Knex } from "knex";

/**
 * Issue 290, ADR-046: interval and circuit blocks.
 *
 * A block groups consecutive exercises of a session and says how they repeat:
 * - kind 'interval': timed work (work_sec, required) and rest (rest_sec) for
 *   each member, e.g. Tabata or EMOM;
 * - kind 'circuit': the members back to back, work optional (rep-based).
 * Both repeat `rounds` times, with `round_rest_sec` between rounds.
 *
 * A block has no order of its own: its position is that of its members in
 * `session_exercises.order_index`, so a session keeps one ordering. Each round
 * of a member is one of that member's ordinary sets (exercise_sets), so flat
 * sessions and scoring are unchanged.
 *
 * Limits mirror SESSION_BLOCK_LIMITS in modules/sessions/sessions.blocks.ts.
 * A block goes with its session; removing a block leaves its exercises flat.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("session_blocks", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("session_id")
      .notNullable()
      .references("id")
      .inTable("sessions")
      .onDelete("CASCADE")
      .onUpdate("CASCADE");
    table.text("kind").notNullable();
    table.string("name", 100).nullable();
    table.integer("rounds").notNullable();
    table.integer("work_sec").nullable();
    table.integer("rest_sec").nullable();
    table.integer("round_rest_sec").nullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["session_id"], "session_blocks_session_idx");
  });
  await knex.raw(
    `ALTER TABLE session_blocks ADD CONSTRAINT session_blocks_kind_check
       CHECK (kind IN ('interval', 'circuit'))`,
  );
  await knex.raw(
    `ALTER TABLE session_blocks ADD CONSTRAINT session_blocks_values_check
       CHECK (rounds BETWEEN 1 AND 50
          AND (work_sec IS NULL OR work_sec BETWEEN 1 AND 3600)
          AND (rest_sec IS NULL OR rest_sec BETWEEN 0 AND 3600)
          AND (round_rest_sec IS NULL OR round_rest_sec BETWEEN 0 AND 3600)
          AND (kind <> 'interval' OR work_sec IS NOT NULL))`,
  );

  await knex.schema.alterTable("session_exercises", (table) => {
    table
      .uuid("block_id")
      .nullable()
      .references("id")
      .inTable("session_blocks")
      .onDelete("SET NULL")
      .onUpdate("CASCADE");
    table.index(["block_id"], "session_exercises_block_idx");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("session_exercises", (table) => {
    table.dropIndex(["block_id"], "session_exercises_block_idx");
    table.dropColumn("block_id");
  });
  await knex.schema.dropTableIfExists("session_blocks");
}
