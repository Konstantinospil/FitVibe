import crypto from "crypto";
import type { Knex } from "knex";
import { db } from "../../db/connection.js";
import type { UserStatus } from "../users/users.types.js";

const USERS_TABLE = "users";
const CONTACTS_TABLE = "user_contacts";
const PROFILES_TABLE = "profiles";
const DOMAIN_VIBE_TABLE = "user_domain_vibe_levels";
const BIO_ATTRIBUTES_TABLE = "bio_attributes";
const BIO_ATTRIBUTE_VALUES_TABLE = "bio_attribute_values";

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

export interface AuthUserRecord {
  id: string;
  username: string;
  display_name: string;
  locale: string;
  preferred_lang: string;
  status: UserStatus;
  role_code: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
  primary_email: string | null;
  email_verified: boolean;
  terms_accepted: boolean;
  terms_accepted_at: string | null;
  terms_version: string | null;
}

function userQuery() {
  return db<AuthUserRecord>(`${USERS_TABLE} as u`)
    .leftJoin(`${CONTACTS_TABLE} as c`, function () {
      this.on("c.user_id", "=", "u.id")
        .andOn("c.type", "=", db.raw("?", ["email"]))
        .andOn("c.is_primary", "=", db.raw("true"));
    })
    .leftJoin(`${PROFILES_TABLE} as p`, "p.user_id", "u.id")
    .select(
      "u.id",
      "p.alias as username",
      "u.display_name",
      "u.locale",
      "u.preferred_lang",
      "u.status",
      "u.role_code",
      "u.password_hash",
      "u.created_at",
      "u.updated_at",
      "u.terms_accepted",
      "u.terms_accepted_at",
      "u.terms_version",
      db.raw("c.value as primary_email"),
      db.raw("COALESCE(c.is_verified, false) as email_verified"),
    ) satisfies Knex.QueryBuilder<AuthUserRecord, AuthUserRecord[]>;
}

export async function findUserByEmail(email: string): Promise<AuthUserRecord | undefined> {
  const normalized = email.toLowerCase();
  return userQuery().whereRaw("LOWER(c.value) = ?", [normalized]).first<AuthUserRecord>();
}

export async function findUserByUsername(username: string): Promise<AuthUserRecord | undefined> {
  return userQuery()
    .whereRaw("LOWER(p.alias) = ?", [username.toLowerCase()])
    .first<AuthUserRecord>();
}

export async function findUserById(id: string): Promise<AuthUserRecord | undefined> {
  return userQuery().where("u.id", id).first<AuthUserRecord>();
}

export async function createUser(
  input: {
    id: string;
    alias?: string;
    /** Accepted as an alias of `alias` so existing callers keep working. */
    username?: string;
    display_name: string;
    locale?: string;
    preferred_lang?: string;
    status: UserStatus;
    role_code: string;
    password_hash: string;
    primaryEmail: string;
    emailVerified?: boolean;
    terms_accepted?: boolean;
    terms_accepted_at?: string;
    terms_version?: string;
    gender_code?: "man" | "woman" | "diverse" | "prefer_not_to_say";
    fitness_level_code?: "beginner" | "intermediate" | "advanced" | "elite" | "rehab";
    date_of_birth?: string;
    weight_kg?: number;
  },
  trx?: Knex.Transaction,
): Promise<AuthUserRecord | undefined> {
  const alias = (input.alias ?? input.username ?? "").trim();
  if (!alias) {
    throw new Error("createUser requires a non-empty alias");
  }

  const now = new Date().toISOString();
  const work = async (transaction: Knex.Transaction): Promise<AuthUserRecord | undefined> => {
    await transaction(USERS_TABLE).insert({
      id: input.id,
      display_name: input.display_name,
      locale: input.locale ?? "en-US",
      preferred_lang: input.preferred_lang ?? "en",
      status: input.status,
      role_code: input.role_code,
      password_hash: input.password_hash,
      terms_accepted: input.terms_accepted ?? false,
      terms_accepted_at: input.terms_accepted_at ?? null,
      terms_version: input.terms_version ?? null,
      created_at: now,
      updated_at: now,
    });

    await transaction(CONTACTS_TABLE).insert({
      id: crypto.randomUUID(),
      user_id: input.id,
      type: "email",
      value: input.primaryEmail.toLowerCase(),
      is_primary: true,
      is_recovery: true,
      is_verified: input.emailVerified ?? false,
      verified_at: input.emailVerified ? now : null,
      created_at: now,
    });

    await transaction(PROFILES_TABLE).insert({
      user_id: input.id,
      alias,
      // Signup assigns the initial alias; the 30-day change window starts on first edit
      alias_changed_at: null,
      visibility: "private",
      gender_code: input.gender_code ?? null,
      fitness_level_code: input.fitness_level_code ?? null,
      date_of_birth: input.date_of_birth ?? null,
      created_at: now,
      updated_at: now,
    });

    if (input.weight_kg !== undefined) {
      const attribute = await transaction(BIO_ATTRIBUTES_TABLE)
        .where({ key: "weight_kg" })
        .first<{ id: string }>();
      if (!attribute) {
        throw new Error("Required bio attribute weight_kg is not configured");
      }

      await transaction(BIO_ATTRIBUTE_VALUES_TABLE).insert({
        id: crypto.randomUUID(),
        user_id: input.id,
        attribute_id: attribute.id,
        value_number: input.weight_kg,
        measured_at: now,
        created_at: now,
      });
    }

    await transaction(DOMAIN_VIBE_TABLE).insert(
      DOMAIN_CODES.map((domainCode) => ({
        user_id: input.id,
        domain_code: domainCode,
        vibe_level: INITIAL_VIBE_LEVEL,
        rating_deviation: INITIAL_RD,
        volatility: INITIAL_VOLATILITY,
        last_updated_at: now,
        created_at: now,
        updated_at: now,
      })),
    );

    return userQuery().transacting(transaction).where("u.id", input.id).first<AuthUserRecord>();
  };

  return trx ? work(trx) : db.transaction(work);
}

export async function updateUserStatus(userId: string, status: UserStatus) {
  return db("users").where({ id: userId }).update({ status, updated_at: new Date().toISOString() });
}

export async function updateUserPassword(userId: string, passwordHash: string) {
  return db("users").where({ id: userId }).update({
    password_hash: passwordHash,
    updated_at: new Date().toISOString(),
  });
}

export async function markEmailVerified(userId: string, email: string) {
  const now = new Date().toISOString();
  return db(CONTACTS_TABLE)
    .where({ user_id: userId, type: "email" })
    .whereRaw("LOWER(value) = ?", [email.toLowerCase()])
    .update({
      is_verified: true,
      verified_at: now,
    });
}
