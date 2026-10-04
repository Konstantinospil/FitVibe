import type { Knex } from "knex";
import { jest } from "@jest/globals";
import { seed as seedRoles } from "../../../../apps/backend/src/db/seeds/001_roles.js";
import { seed as seedGenders } from "../../../../apps/backend/src/db/seeds/002_genders.js";
import { seed as seedFitnessLevels } from "../../../../apps/backend/src/db/seeds/003_fitness_levels.js";
import { seed as seedExerciseTypes } from "../../../../apps/backend/src/db/seeds/004_exercise_types.js";
import { seed as seedUsers } from "../../../../apps/backend/src/db/seeds/005_users.js";
import { seed as seedProfiles } from "../../../../apps/backend/src/db/seeds/Demo Data/006_profiles.js";
import { seed as seedUserContacts } from "../../../../apps/backend/src/db/seeds/Demo Data/007_user_contacts.js";
import { seed as seedGlobalExercises } from "../../../../apps/backend/src/db/seeds/008_global_exercises.js";
import { seed as seedBadgeCatalog } from "../../../../apps/backend/src/db/seeds/009_badge_catalog.js";
import { seed as seedExercises } from "../../../../apps/backend/src/db/seeds/Demo Data/009_exercises.js";
import { seed as seedSessions } from "../../../../apps/backend/src/db/seeds/Demo Data/010_sessions.js";
import { seed as seedSessionExercises } from "../../../../apps/backend/src/db/seeds/Demo Data/011_session_exercises.js";
import { seed as seedPlannedAttributes } from "../../../../apps/backend/src/db/seeds/Demo Data/012_planned_exercise_attributes.js";
import { seed as seedUserPoints } from "../../../../apps/backend/src/db/seeds/Demo Data/014_user_points.js";
import { seed as seedBadges } from "../../../../apps/backend/src/db/seeds/Demo Data/015_badges.js";
import { seed as seedFollowers } from "../../../../apps/backend/src/db/seeds/Demo Data/016_followers.js";
import { seed as seedMedia } from "../../../../apps/backend/src/db/seeds/Demo Data/017_media.js";
import { seed as seedExerciseSets } from "../../../../apps/backend/src/db/seeds/Demo Data/019_exercise_sets.js";
import { seed as seedPlans } from "../../../../apps/backend/src/db/seeds/Demo Data/020_plans.js";
import bcrypt from "bcryptjs";

jest.mock("bcryptjs", () => ({
  hash: jest.fn((value: string) => Promise.resolve(`hashed-${value}`)),
}));

type InsertChain = {
  insert: jest.Mock;
  onConflict: jest.Mock;
  ignore: jest.Mock;
  merge: jest.Mock;
  where: jest.Mock;
  orderBy: jest.Mock;
  first: jest.Mock;
};

const ADMIN_ID = "11111111-1111-1111-1111-111111111111";

function createInsertChain(): InsertChain {
  const chain: InsertChain = {
    insert: jest.fn(),
    onConflict: jest.fn(),
    ignore: jest.fn(),
    merge: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    first: jest.fn(),
  };
  chain.insert.mockReturnValue(chain);
  chain.onConflict.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.first.mockResolvedValue({ version: "2024-06-01" });
  chain.ignore.mockResolvedValue(undefined);
  chain.merge.mockResolvedValue(undefined);
  return chain;
}

function createKnexMock() {
  const chains = new Map<string, InsertChain>();
  const knexSpy = jest.fn((table: string) => {
    if (!chains.has(table)) {
      chains.set(table, createInsertChain());
    }
    return chains.get(table)!;
  });
  const rawMock = jest.fn().mockResolvedValue(undefined);
  const schemaMock = {
    hasTable: jest.fn().mockResolvedValue(false),
  };
  const knex = Object.assign(knexSpy, {
    raw: rawMock,
    schema: schemaMock,
  }) as unknown as Knex;

  return {
    knex,
    knexSpy,
    rawMock,
    schemaMock,
    getChain: (table: string): InsertChain => {
      const chain = chains.get(table);
      if (!chain) {
        throw new Error(`No insert chain recorded for table ${table}`);
      }
      return chain;
    },
  };
}

interface SeedTestCase {
  name: string;
  seedFn: (knex: Knex) => Promise<void>;
  table: string;
  conflict: string | string[];
  strategy: "ignore" | "merge";
  sampleMatcher?: Record<string, unknown>;
  rawCalls?: string[];
  assertInsert?: (rows: unknown[]) => void;
}

describe("database seed modules", () => {
  const seedCases: SeedTestCase[] = [
    {
      name: "roles",
      seedFn: seedRoles,
      table: "roles",
      conflict: "code",
      strategy: "merge",
      sampleMatcher: { code: "admin" },
    },
    {
      name: "genders",
      seedFn: seedGenders,
      table: "genders",
      conflict: "code",
      strategy: "ignore",
      sampleMatcher: { code: "woman" },
    },
    {
      name: "fitness levels",
      seedFn: seedFitnessLevels,
      table: "fitness_levels",
      conflict: "code",
      strategy: "merge",
      sampleMatcher: { code: "intermediate" },
    },
    {
      name: "exercise types",
      seedFn: seedExerciseTypes,
      table: "exercise_types",
      conflict: "code",
      strategy: "merge",
      sampleMatcher: { code: "strength" },
    },
    {
      name: "users",
      seedFn: seedUsers,
      table: "users",
      conflict: "id",
      strategy: "ignore",
      sampleMatcher: { id: ADMIN_ID },
      assertInsert: (rows) => {
        const hashMock = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;
        expect(hashMock).toHaveBeenCalledTimes(1);
        expect(hashMock).toHaveBeenCalledWith("admin", 12);
        expect(rows).toHaveLength(1);
        const row = (rows as Array<{ id?: string; password_hash?: string }>).find(
          (entry) => entry.id === ADMIN_ID,
        ) as {
          password_hash: string;
        };
        expect(row.password_hash).toBe("hashed-admin");
      },
    },
    {
      name: "profiles",
      seedFn: seedProfiles,
      table: "profiles",
      conflict: "user_id",
      strategy: "merge",
      sampleMatcher: { gender_code: "woman" },
    },
    {
      name: "user_contacts",
      seedFn: seedUserContacts,
      table: "user_contacts",
      conflict: "id",
      strategy: "ignore",
      sampleMatcher: { type: "email" },
    },
    {
      name: "global exercises",
      seedFn: seedGlobalExercises,
      table: "exercises",
      conflict: "id",
      strategy: "ignore",
      assertInsert: (rows) => {
        expect(rows).toHaveLength(300);
        const byType = new Map<string, number>();
        for (const row of rows as Array<{ type_code: string }>) {
          byType.set(row.type_code, (byType.get(row.type_code) ?? 0) + 1);
        }
        for (const code of [
          "strength",
          "agility",
          "endurance",
          "explosivity",
          "intelligence",
          "regeneration",
        ]) {
          expect(byType.get(code)).toBe(50);
        }
      },
    },
    {
      name: "badge catalog",
      seedFn: seedBadgeCatalog,
      table: "badge_catalog",
      conflict: "code",
      strategy: "merge",
      sampleMatcher: { code: "first_session" },
      assertInsert: (rows) => {
        expect((rows as unknown[]).length).toBeGreaterThanOrEqual(36);
        const roleOnly = (rows as Array<{ code: string; criteria: Record<string, unknown> }>).find(
          (entry) => entry.code === "onboard_pro",
        );
        expect(roleOnly?.criteria).toEqual({ requires: "coaching" });
      },
    },
    {
      name: "exercises",
      seedFn: seedExercises,
      table: "exercises",
      conflict: "id",
      strategy: "ignore",
      assertInsert: (rows) => {
        const compound = (rows as Array<{ id: string; tags?: string }>).find(
          (entry) => entry.id === "77777777-7777-7777-7777-777777777777",
        ) as { tags: string };
        expect(typeof compound.tags).toBe("string");
        expect(JSON.parse(compound.tags)).toContain("compound");
      },
    },
    {
      name: "sessions",
      seedFn: seedSessions,
      table: "sessions",
      conflict: "id",
      strategy: "ignore",
    },
    {
      name: "session_exercises",
      seedFn: seedSessionExercises,
      table: "session_exercises",
      conflict: "id",
      strategy: "ignore",
      sampleMatcher: { order_index: 1 },
    },
    {
      name: "planned attribute rows",
      seedFn: seedPlannedAttributes,
      table: "planned_exercise_attributes",
      conflict: "session_exercise_id",
      strategy: "merge",
      sampleMatcher: { rest: "00:03:00" },
    },
    {
      name: "user_points",
      seedFn: seedUserPoints,
      table: "user_points",
      conflict: "id",
      strategy: "ignore",
      sampleMatcher: { source_type: "session_completed" },
    },
    {
      name: "followers",
      seedFn: seedFollowers,
      table: "followers",
      conflict: ["follower_id", "following_id"],
      strategy: "ignore",
      sampleMatcher: { follower_id: ADMIN_ID },
    },
    {
      name: "media",
      seedFn: seedMedia,
      table: "media",
      conflict: "id",
      strategy: "ignore",
      sampleMatcher: { media_type: "photo" },
    },
    {
      name: "exercise sets",
      seedFn: seedExerciseSets,
      table: "exercise_sets",
      conflict: "id",
      strategy: "ignore",
      sampleMatcher: { order_index: 1 },
    },
    {
      name: "plans",
      seedFn: seedPlans,
      table: "plans",
      conflict: "id",
      strategy: "ignore",
      sampleMatcher: { name: "Autumn Marathon Build" },
    },
  ];

  it.each(seedCases)(
    "inserts data for %s",
    async ({ seedFn, table, conflict, strategy, sampleMatcher, rawCalls, assertInsert }) => {
      const { knex, knexSpy, rawMock, schemaMock, getChain } = createKnexMock();

      // For the profiles seed, mock hasTable to return true for "profiles"
      if (table === "profiles") {
        schemaMock.hasTable.mockResolvedValue(true);
      }

      await seedFn(knex);

      expect(knexSpy).toHaveBeenCalledWith(table);
      const chain = getChain(table);
      expect(chain.insert).toHaveBeenCalled();
      expect(chain.onConflict).toHaveBeenCalledWith(conflict);
      if (strategy === "ignore") {
        expect(chain.ignore).toHaveBeenCalled();
        expect(chain.merge).not.toHaveBeenCalled();
      } else {
        expect(chain.merge).toHaveBeenCalled();
        expect(chain.ignore).not.toHaveBeenCalled();
      }

      const insertedRows = chain.insert.mock.calls[0][0] as unknown[];
      expect(Array.isArray(insertedRows)).toBe(true);
      if (sampleMatcher) {
        expect(insertedRows).toEqual(
          expect.arrayContaining([expect.objectContaining(sampleMatcher)]),
        );
      }
      assertInsert?.(insertedRows);

      rawCalls?.forEach((sql) => {
        expect(rawMock).toHaveBeenCalledWith(sql);
      });
    },
  );

  it("seeds only the bootstrap admin identity from 005_users", async () => {
    const { knex, getChain } = createKnexMock();

    await seedUsers(knex);

    const contacts = getChain("user_contacts");
    expect(contacts.onConflict).toHaveBeenCalledWith("id");
    expect(contacts.ignore).toHaveBeenCalled();
    expect(contacts.insert.mock.calls[0][0]).toEqual([
      expect.objectContaining({ value: "admin@fitvibe.local" }),
    ]);

    const profiles = getChain("profiles");
    expect(profiles.onConflict).toHaveBeenCalledWith("user_id");
    expect(profiles.ignore).toHaveBeenCalled();
    expect(profiles.insert.mock.calls[0][0]).toEqual([
      expect.objectContaining({ alias: "admin", visibility: "private" }),
    ]);

    const vibes = getChain("user_domain_vibe_levels");
    expect(vibes.onConflict).toHaveBeenCalledWith(["user_id", "domain_code"]);
    expect(vibes.ignore).toHaveBeenCalled();
    expect(vibes.insert.mock.calls[0][0]).toHaveLength(6);
  });

  it("seeds Jane's first_session award without overwriting the catalog", async () => {
    const { knex, knexSpy, getChain } = createKnexMock();

    await seedBadges(knex);

    expect(knexSpy).not.toHaveBeenCalledWith("badge_catalog");

    const badgesChain = getChain("badges");
    expect(badgesChain.insert).toHaveBeenCalled();
    expect(badgesChain.onConflict).toHaveBeenCalledWith("id");
    expect(badgesChain.ignore).toHaveBeenCalled();
    const insertedBadges = badgesChain.insert.mock.calls[0][0];
    expect(insertedBadges[0]).toHaveProperty("metadata");
    expect(insertedBadges[0].badge_type).toBe("first_session");
  });
});
