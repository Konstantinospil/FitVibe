import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("legal_document_versions", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("document_type", 20).notNullable();
    table.string("version", 50).notNullable();
    table.string("change_class", 20).notNullable();
    table.string("user_action", 20).notNullable();
    table.timestamp("effective_at", { useTz: true }).notNullable();
    table.timestamp("published_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.uuid("published_by").nullable().references("id").inTable("users").onDelete("SET NULL");
    table.string("source", 30).notNullable().defaultTo("backoffice");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["document_type", "version"], "legal_document_versions_type_version_unique");
    table.check("document_type IN ('terms','privacy','cookie')");
    table.check("change_class IN ('legacy','editorial','material')");
    table.check("user_action IN ('none','acknowledge','accept','renew_consent')");
  });

  await knex.schema.createTable("legal_document_snapshots", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("version_id")
      .notNullable()
      .references("id")
      .inTable("legal_document_versions")
      .onDelete("CASCADE");
    table.string("language", 10).notNullable();
    table.jsonb("content").notNullable();
    table.string("content_hash", 64).notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["version_id", "language"], "legal_document_snapshots_version_language_unique");
  });

  await knex.schema.createTable("legal_document_acceptances", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table
      .uuid("version_id")
      .notNullable()
      .references("id")
      .inTable("legal_document_versions")
      .onDelete("RESTRICT");
    table.string("action", 20).notNullable();
    table.string("source", 30).notNullable().defaultTo("application");
    table.timestamp("accepted_at", { useTz: true }).notNullable();
    table.timestamp("revoked_at", { useTz: true }).nullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["user_id", "version_id"], "legal_document_acceptances_user_version_unique");
    table.check("action IN ('acknowledge','accept','renew_consent')");
  });

  await knex.schema.alterTable("cookie_consents", (table) => {
    table
      .uuid("legal_version_id")
      .nullable()
      .references("id")
      .inTable("legal_document_versions")
      .onDelete("SET NULL");
  });

  await knex.raw(`
    CREATE INDEX legal_document_versions_current_idx
    ON legal_document_versions (document_type, effective_at DESC, published_at DESC)
  `);
  await knex.raw(`
    CREATE INDEX legal_document_acceptances_user_idx
    ON legal_document_acceptances (user_id, accepted_at DESC)
  `);

  const baselineEffectiveAt = new Date("2024-06-01T00:00:00.000Z");
  const baselineActions = {
    terms: "accept",
    privacy: "acknowledge",
    cookie: "renew_consent",
  } as const;

  for (const documentType of ["terms", "privacy", "cookie"] as const) {
    await knex("legal_document_versions")
      .insert({
        document_type: documentType,
        version: "2024-06-01",
        change_class: "legacy",
        user_action: baselineActions[documentType],
        effective_at: baselineEffectiveAt,
        published_at: baselineEffectiveAt,
        source: "legacy_migration",
      })
      .onConflict(["document_type", "version"])
      .ignore();
  }

  await knex.raw(`
    INSERT INTO legal_document_versions (
      document_type, version, change_class, user_action, effective_at, published_at, source
    )
    SELECT
      'terms',
      u.terms_version,
      'legacy',
      'accept',
      COALESCE(MIN(u.terms_accepted_at), NOW()),
      COALESCE(MIN(u.terms_accepted_at), NOW()),
      'legacy_migration'
    FROM users u
    WHERE u.terms_version IS NOT NULL
    GROUP BY u.terms_version
    ON CONFLICT (document_type, version) DO NOTHING
  `);

  await knex.raw(`
    INSERT INTO legal_document_versions (
      document_type, version, change_class, user_action, effective_at, published_at, source
    )
    SELECT
      'privacy',
      u.privacy_policy_version,
      'legacy',
      'acknowledge',
      COALESCE(MIN(u.privacy_policy_accepted_at), NOW()),
      COALESCE(MIN(u.privacy_policy_accepted_at), NOW()),
      'legacy_migration'
    FROM users u
    WHERE u.privacy_policy_version IS NOT NULL
    GROUP BY u.privacy_policy_version
    ON CONFLICT (document_type, version) DO NOTHING
  `);

  await knex.raw(`
    INSERT INTO legal_document_versions (
      document_type, version, change_class, user_action, effective_at, published_at, source
    )
    SELECT
      'cookie',
      c.consent_version,
      'legacy',
      'renew_consent',
      MIN(c.consent_given_at),
      MIN(c.consent_given_at),
      'legacy_migration'
    FROM cookie_consents c
    WHERE c.consent_version IS NOT NULL
    GROUP BY c.consent_version
    ON CONFLICT (document_type, version) DO NOTHING
  `);

  await knex.raw(`
    INSERT INTO legal_document_acceptances (
      user_id, version_id, action, source, accepted_at
    )
    SELECT u.id, v.id, 'accept', 'legacy_migration', u.terms_accepted_at
    FROM users u
    JOIN legal_document_versions v
      ON v.document_type = 'terms'
     AND v.version = u.terms_version
    WHERE u.terms_accepted = TRUE
      AND u.terms_accepted_at IS NOT NULL
      AND u.terms_version IS NOT NULL
    ON CONFLICT (user_id, version_id) DO NOTHING
  `);

  await knex.raw(`
    INSERT INTO legal_document_acceptances (
      user_id, version_id, action, source, accepted_at
    )
    SELECT u.id, v.id, 'acknowledge', 'legacy_migration', u.privacy_policy_accepted_at
    FROM users u
    JOIN legal_document_versions v
      ON v.document_type = 'privacy'
     AND v.version = u.privacy_policy_version
    WHERE u.privacy_policy_accepted = TRUE
      AND u.privacy_policy_accepted_at IS NOT NULL
      AND u.privacy_policy_version IS NOT NULL
    ON CONFLICT (user_id, version_id) DO NOTHING
  `);

  await knex.raw(`
    UPDATE cookie_consents c
    SET legal_version_id = v.id
    FROM legal_document_versions v
    WHERE v.document_type = 'cookie'
      AND v.version = c.consent_version
      AND c.legal_version_id IS NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("cookie_consents", (table) => {
    table.dropColumn("legal_version_id");
  });
  await knex.schema.dropTableIfExists("legal_document_acceptances");
  await knex.schema.dropTableIfExists("legal_document_snapshots");
  await knex.schema.dropTableIfExists("legal_document_versions");
}
