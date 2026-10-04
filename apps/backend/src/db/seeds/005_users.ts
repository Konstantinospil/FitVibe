import type { Knex } from "knex";
import bcrypt from "bcryptjs";

const ADMIN_ID = "11111111-1111-1111-1111-111111111111";
const ADMIN_CONTACT_ID = "33333333-3333-3333-3333-333333333333";

const DOMAIN_CODES = [
  "strength",
  "agility",
  "endurance",
  "explosivity",
  "intelligence",
  "regeneration",
] as const;

const INITIAL_VIBE_LEVEL = 1000.0;
const INITIAL_RD = 350.0;
const INITIAL_VOLATILITY = 0.06;

/**
 * Production-safe bootstrap seed.
 *
 * Creates only the single built-in administrator. Required lookup/catalog data
 * is provided by the other top-level seed files. The fixed ID plus
 * onConflict(...).ignore() means later deployments never reset a password that
 * the administrator has changed after first login.
 */
export async function seed(knex: Knex): Promise<void> {
  const adminPassword = await bcrypt.hash("admin", 12);
  const now = new Date();
  const currentTerms = await knex("legal_document_versions")
    .where({ document_type: "terms" })
    .where("effective_at", "<=", now)
    .orderBy("effective_at", "desc")
    .orderBy("published_at", "desc")
    .first<{ id: string; version: string }>("id", "version");
  if (!currentTerms) {
    throw new Error("Cannot seed administrator without a published Terms version");
  }
  const termsVersion = currentTerms.version;

  await knex("users")
    .insert([
      {
        id: ADMIN_ID,
        display_name: "FitVibe Admin",
        locale: "en-US",
        preferred_lang: "en",
        status: "active",
        role_code: "admin",
        password_hash: adminPassword,
        terms_accepted: true,
        terms_accepted_at: now,
        terms_version: termsVersion,
        created_at: now,
        updated_at: now,
      },
    ])
    .onConflict("id")
    .ignore();

  await knex("legal_document_acceptances")
    .insert({
      user_id: ADMIN_ID,
      version_id: currentTerms.id,
      action: "accept",
      source: "bootstrap_seed",
      accepted_at: now,
      revoked_at: null,
      created_at: now,
    })
    .onConflict(["user_id", "version_id"])
    .ignore();

  await knex("user_contacts")
    .insert([
      {
        id: ADMIN_CONTACT_ID,
        user_id: ADMIN_ID,
        type: "email",
        value: "admin@fitvibe.local",
        is_primary: true,
        is_recovery: true,
        is_verified: true,
        verified_at: now,
        created_at: now,
      },
    ])
    .onConflict("id")
    .ignore();

  await knex("profiles")
    .insert([
      {
        user_id: ADMIN_ID,
        alias: "admin",
        alias_changed_at: null,
        visibility: "private",
        created_at: now,
        updated_at: now,
      },
    ])
    .onConflict("user_id")
    .ignore();

  await knex("user_domain_vibe_levels")
    .insert(
      DOMAIN_CODES.map((domainCode) => ({
        user_id: ADMIN_ID,
        domain_code: domainCode,
        vibe_level: INITIAL_VIBE_LEVEL,
        rating_deviation: INITIAL_RD,
        volatility: INITIAL_VOLATILITY,
        last_updated_at: now,
        created_at: now,
        updated_at: now,
      })),
    )
    .onConflict(["user_id", "domain_code"])
    .ignore();
}
