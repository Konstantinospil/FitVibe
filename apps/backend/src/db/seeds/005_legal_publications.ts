import type { Knex } from "knex";

const LEGAL_DOCUMENTS = ["terms", "privacy", "cookie"] as const;

export async function seed(knex: Knex): Promise<void> {
  const now = new Date();
  const baselineEffectiveAt = new Date("2024-06-01T00:00:00.000Z");
  const baselineActions: Record<(typeof LEGAL_DOCUMENTS)[number], string> = {
    terms: "accept",
    privacy: "acknowledge",
    cookie: "renew_consent",
  };

  for (const documentType of LEGAL_DOCUMENTS) {
    await knex("legal_document_versions")
      .insert({
        document_type: documentType,
        version: "2024-06-01",
        change_class: "legacy",
        user_action: baselineActions[documentType],
        effective_at: baselineEffectiveAt,
        published_at: baselineEffectiveAt,
        source: "legacy_seed",
        created_at: now,
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
      'legacy_seed'
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
      'legacy_seed'
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
      'legacy_seed'
    FROM cookie_consents c
    WHERE c.consent_version IS NOT NULL
    GROUP BY c.consent_version
    ON CONFLICT (document_type, version) DO NOTHING
  `);

  await knex.raw(`
    INSERT INTO legal_document_acceptances (user_id, version_id, action, source, accepted_at)
    SELECT u.id, v.id, 'accept', 'legacy_seed', u.terms_accepted_at
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
    INSERT INTO legal_document_acceptances (user_id, version_id, action, source, accepted_at)
    SELECT u.id, v.id, 'acknowledge', 'legacy_seed', u.privacy_policy_accepted_at
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
