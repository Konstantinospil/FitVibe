import type { Knex } from "knex";

/**
 * Replace seeded placeholder IDs that are not valid RFC 9562 UUIDs.
 *
 * Postgres stores any 8-4-4-4-12 hex value in a `uuid` column, but the API
 * validates IDs with zod's strict `.uuid()`. Rows created from the old seeds
 * (for example the Barbell Back Squat global exercise, ID 7777…7777) could be
 * read but never sent back: saving a session that used one failed with
 * `400 "exercises": ["Invalid UUID"]`.
 *
 * Each placeholder keeps its digits; only the version nibble becomes 4 and the
 * variant nibble becomes 8 where it was not already 8, 9, a or b. The mapping
 * is kept here, not imported from the seeds, so this migration never changes.
 *
 * What is rewritten, in one transaction:
 * - every `uuid` and `uuid[]` column in the public schema (primary keys,
 *   foreign keys and loose references such as audit_log.entity_id), with
 *   foreign keys dropped first and recreated afterwards, because only some of
 *   them cascade updates;
 * - every `jsonb` column (audit metadata, payloads) by text replacement.
 *
 * Plain text columns are left alone on purpose: media.storage_key names a
 * file on disk, and renaming the value would break the link to that file.
 *
 * Databases that never ran the old seeds contain none of these IDs, and the
 * migration then changes no rows.
 */
const ID_MAP: Readonly<Record<string, string>> = {
  "77777777-7777-7777-7777-777777777777": "77777777-7777-4777-8777-777777777777",
  "77777777-7777-7777-7777-777777777778": "77777777-7777-4777-8777-777777777778",
  "77777777-7777-7777-7777-777777777779": "77777777-7777-4777-8777-777777777779",
  "77777777-7777-7777-7777-777777777780": "77777777-7777-4777-8777-777777777780",
  "77777777-7777-7777-7777-777777777781": "77777777-7777-4777-8777-777777777781",
  "11111111-1111-1111-1111-111111111111": "11111111-1111-4111-8111-111111111111",
  "22222222-2222-2222-2222-222222222222": "22222222-2222-4222-8222-222222222222",
  "33333333-3333-3333-3333-333333333333": "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-4444-444444444444": "44444444-4444-4444-8444-444444444444",
  "55555555-5555-5555-5555-555555555555": "55555555-5555-4555-8555-555555555555",
  "99999999-9999-9999-9999-999999999999": "99999999-9999-4999-9999-999999999999",
  "aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa": "aaaaaaa1-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
  "bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb": "bbbbbbb1-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
  "ccccccc1-cccc-cccc-cccc-cccccccccccc": "ccccccc1-cccc-4ccc-8ccc-cccccccccccc",
  "ddddddd1-dddd-dddd-dddd-dddddddddddd": "ddddddd1-dddd-4ddd-8ddd-dddddddddddd",
  "eeeeeee1-eeee-eeee-eeee-eeeeeeeeeeee": "eeeeeee1-eeee-4eee-8eee-eeeeeeeeeeee",
  "fffffff1-ffff-ffff-ffff-ffffffffffff": "fffffff1-ffff-4fff-8fff-ffffffffffff",
  "11111111-aaaa-bbbb-cccc-222222222222": "11111111-aaaa-4bbb-8ccc-222222222222",
  "44444444-5555-6666-7777-888888888888": "44444444-5555-4666-8777-888888888888",
  "99999999-aaaa-bbbb-cccc-dddddddddddd": "99999999-aaaa-4bbb-8ccc-dddddddddddd",
  "bbbb2222-cccc-3333-dddd-444444444444": "bbbb2222-cccc-4333-8ddd-444444444444",
};

interface ColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
}

interface ForeignKeyRow {
  table_name: string;
  conname: string;
  definition: string;
}

const quoteIdent = (name: string): string => `"${name.replace(/"/g, '""')}"`;

async function listColumns(knex: Knex, types: string[]): Promise<ColumnRow[]> {
  const result = await knex.raw<{ rows: ColumnRow[] }>(
    `
    SELECT c.relname AS table_name,
           a.attname AS column_name,
           format_type(a.atttypid, a.atttypmod) AS data_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND NOT c.relispartition
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND a.attgenerated = ''
      AND format_type(a.atttypid, a.atttypmod) = ANY(?)
    ORDER BY c.relname, a.attnum
    `,
    [types],
  );
  return result.rows;
}

async function listForeignKeys(knex: Knex): Promise<ForeignKeyRow[]> {
  const result = await knex.raw<{ rows: ForeignKeyRow[] }>(`
    SELECT c.relname AS table_name,
           con.conname,
           pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.contype = 'f'
      AND con.conparentid = 0
      AND n.nspname = 'public'
    ORDER BY c.relname, con.conname
  `);
  return result.rows;
}

async function assertNoCollisions(
  knex: Knex,
  columns: ColumnRow[],
  map: Readonly<Record<string, string>>,
): Promise<void> {
  const primaryKeys = await knex.raw<{ rows: { table_name: string; column_name: string }[] }>(`
    SELECT c.relname AS table_name, a.attname AS column_name
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = i.indkey[0]
    WHERE i.indisprimary
      AND i.indnatts = 1
      AND n.nspname = 'public'
      AND NOT c.relispartition
  `);
  const uuidColumns = new Set(columns.map((col) => `${col.table_name}.${col.column_name}`));
  const targets = Object.values(map);

  for (const pk of primaryKeys.rows) {
    if (!uuidColumns.has(`${pk.table_name}.${pk.column_name}`)) {
      continue;
    }
    const clash: Record<string, unknown> | undefined = await knex(pk.table_name)
      .whereIn(pk.column_name, targets)
      .first<Record<string, unknown> | undefined>(pk.column_name);
    if (clash) {
      throw new Error(
        `Cannot remap placeholder IDs: ${pk.table_name}.${pk.column_name} already holds ${String(
          clash[pk.column_name],
        )}`,
      );
    }
  }
}

async function remap(knex: Knex, map: Readonly<Record<string, string>>): Promise<void> {
  const entries = Object.entries(map);
  const uuidColumns = await listColumns(knex, ["uuid", "uuid[]"]);
  const jsonbColumns = await listColumns(knex, ["jsonb"]);

  await assertNoCollisions(knex, uuidColumns, map);

  const foreignKeys = await listForeignKeys(knex);
  for (const fk of foreignKeys) {
    await knex.raw(
      `ALTER TABLE ${quoteIdent(fk.table_name)} DROP CONSTRAINT ${quoteIdent(fk.conname)}`,
    );
  }

  const caseSql = entries.map(() => "WHEN ?::uuid THEN ?::uuid").join(" ");
  const caseBindings = entries.flatMap(([from, to]) => [from, to]);
  const fromIds = entries.map(([from]) => from);

  for (const col of uuidColumns) {
    const table = quoteIdent(col.table_name);
    const column = quoteIdent(col.column_name);
    if (col.data_type === "uuid[]") {
      let expr = column;
      const bindings: string[] = [];
      for (const [from, to] of entries) {
        expr = `array_replace(${expr}, ?::uuid, ?::uuid)`;
        bindings.push(from, to);
      }
      await knex.raw(`UPDATE ${table} SET ${column} = ${expr} WHERE ${column} && ?::uuid[]`, [
        ...bindings,
        fromIds,
      ]);
      continue;
    }
    await knex.raw(
      `UPDATE ${table} SET ${column} = CASE ${column} ${caseSql} END WHERE ${column} = ANY(?::uuid[])`,
      [...caseBindings, fromIds],
    );
  }

  for (const col of jsonbColumns) {
    const table = quoteIdent(col.table_name);
    const column = quoteIdent(col.column_name);
    let expr = `${column}::text`;
    const bindings: string[] = [];
    for (const [from, to] of entries) {
      expr = `replace(${expr}, ?, ?)`;
      bindings.push(from, to);
    }
    const likeClauses = fromIds.map(() => `${column}::text LIKE ?`).join(" OR ");
    await knex.raw(`UPDATE ${table} SET ${column} = (${expr})::jsonb WHERE ${likeClauses}`, [
      ...bindings,
      ...fromIds.map((id) => `%${id}%`),
    ]);
  }

  for (const fk of foreignKeys) {
    await knex.raw(
      `ALTER TABLE ${quoteIdent(fk.table_name)} ADD CONSTRAINT ${quoteIdent(fk.conname)} ${fk.definition}`,
    );
  }

  const views = await knex.raw<{ rows: { matviewname: string }[] }>(
    "SELECT matviewname FROM pg_matviews WHERE schemaname = 'public' AND ispopulated",
  );
  for (const view of views.rows) {
    await knex.raw(`REFRESH MATERIALIZED VIEW ${quoteIdent(view.matviewname)}`);
  }
}

export async function up(knex: Knex): Promise<void> {
  await remap(knex, ID_MAP);
}

export async function down(knex: Knex): Promise<void> {
  const reverse = Object.fromEntries(Object.entries(ID_MAP).map(([from, to]) => [to, from]));
  await remap(knex, reverse);
}
