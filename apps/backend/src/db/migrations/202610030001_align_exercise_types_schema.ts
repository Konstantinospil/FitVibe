import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("exercise_types", (table) => {
    table.string("name");
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`
    UPDATE exercise_types
    SET name = CASE code
      WHEN 'hiit' THEN 'HIIT'
      WHEN 'crossfit' THEN 'CrossFit'
      WHEN 'warmup' THEN 'Warm-up'
      WHEN 'cooldown' THEN 'Cool-down'
      ELSE initcap(replace(code, '_', ' '))
    END
    WHERE name IS NULL OR btrim(name) = ''
  `);

  await knex.schema.alterTable("exercise_types", (table) => {
    table.string("name").notNullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("exercise_types", (table) => {
    table.dropColumn("updated_at");
    table.dropColumn("is_active");
    table.dropColumn("name");
  });
}
