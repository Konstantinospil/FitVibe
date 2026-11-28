/**
 * Every UUID a seed writes must be one the API will accept back.
 *
 * Postgres stores any 8-4-4-4-12 hex value in a `uuid` column, but the API
 * validates IDs with zod's strict `.uuid()`. A seeded row with a placeholder
 * ID such as 7777…7777 can be read, but every request that sends that ID back
 * fails with 400 "Invalid UUID". That is how saving a session with the seeded
 * Barbell Back Squat broke. These tests run each seed against a recording
 * knex mock and check every value before anything reaches the database.
 */
import fs from "node:fs";
import path from "node:path";
import type { Knex } from "knex";
import { jest } from "@jest/globals";
import { z } from "zod";

import { CreateSessionSchema } from "../../../../apps/backend/src/modules/sessions/sessions.controller.js";

jest.mock("../../../../apps/backend/src/modules/auth/password-hashing.service.js", () => ({
  hashPassword: jest.fn((value: string) => Promise.resolve(`hashed-${value}`)),
}));

const SEEDS_DIR = path.resolve(__dirname, "../../../../apps/backend/src/db/seeds");
const FIXTURES_DIR = path.resolve(__dirname, "../../../../apps/backend/src/db/fixtures");
const GENERATOR = path.resolve(
  __dirname,
  "../../../../apps/backend/scripts/generate-global-exercises.mjs",
);

/** Anything shaped like a UUID, valid or not. */
const UUID_SHAPE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
/** A value in an id column that looks like an attempt at a UUID. */
const UUID_LIKE = /^[0-9a-f-]{20,}$/i;
const ID_KEY = /^(id|.+_id)$/;

const apiUuid = z.string().uuid();
const isApiValid = (value: string): boolean => apiUuid.safeParse(value).success;

interface Written {
  source: string;
  table: string;
  payload: unknown;
}

function listSeedFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return listSeedFiles(full);
      }
      return /\.ts$/.test(entry.name) && !entry.name.endsWith(".d.ts") ? [full] : [];
    })
    .sort();
}

/**
 * A knex stand-in that accepts any query chain, records what would be
 * written, and resolves every query as "nothing there yet" — except the one
 * lookup the admin seed needs: a published Terms version.
 */
function createRecordingKnex(source: string, written: Written[]): Knex {
  const builder = (table: string): unknown => {
    let lastMethod = "";
    const proxy: unknown = new Proxy(function () {}, {
      get(_target, prop) {
        if (prop === "then") {
          const value =
            lastMethod === "first"
              ? table.startsWith("legal")
                ? { id: "0b6a8f2e-4c1d-4e5f-9a7b-3c2d1e0f9a8b", version: "2024-06-01" }
                : undefined
              : [];
          return (resolve: (v: unknown) => void) => resolve(value);
        }
        return (...args: unknown[]) => {
          lastMethod = String(prop);
          if (prop === "insert" || prop === "update" || prop === "merge") {
            written.push({ source, table, payload: args[0] });
          }
          return proxy;
        };
      },
      apply() {
        return proxy;
      },
    });
    return proxy;
  };

  const knex: unknown = new Proxy(function () {}, {
    apply(_target, _this, args: unknown[]) {
      return builder(String(args[0]));
    },
    get(_target, prop) {
      switch (prop) {
        case "raw":
          return (sql: unknown, bindings?: unknown) => {
            written.push({ source, table: "raw", payload: { sql, bindings } });
            return Promise.resolve({ rows: [] });
          };
        case "schema":
          return { hasTable: () => Promise.resolve(true), hasColumn: () => Promise.resolve(true) };
        case "fn":
          return { now: () => "now()" };
        case "transaction":
          return (callback: (trx: unknown) => unknown) => Promise.resolve(callback(knex));
        case "batchInsert":
          return (table: string, rows: unknown) => {
            written.push({ source, table, payload: rows });
            return Promise.resolve();
          };
        default:
          return undefined;
      }
    },
  });
  return knex as Knex;
}

function collectProblems(source: string, payload: unknown): string[] {
  const problems: string[] = [];
  const text = JSON.stringify(payload) ?? "";
  for (const match of text.matchAll(UUID_SHAPE)) {
    if (!isApiValid(match[0])) {
      problems.push(`${source}: ${match[0]}`);
    }
  }

  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        if (ID_KEY.test(key) && typeof child === "string" && UUID_LIKE.test(child)) {
          if (!isApiValid(child)) {
            problems.push(`${source}: ${key}=${child}`);
          }
        }
        visit(child);
      }
    }
  };
  visit(payload);
  return [...new Set(problems)];
}

describe("seeded UUIDs are accepted by the API", () => {
  const originalPassword = process.env.ADMIN_PASSWORD;

  beforeAll(() => {
    process.env.ADMIN_PASSWORD ??= "Seed-uuid-test-password-2026!";
  });

  afterAll(() => {
    if (originalPassword === undefined) {
      delete process.env.ADMIN_PASSWORD;
    } else {
      process.env.ADMIN_PASSWORD = originalPassword;
    }
  });

  const seedFiles = listSeedFiles(SEEDS_DIR);

  it("finds the seed files", () => {
    expect(seedFiles.length).toBeGreaterThan(10);
  });

  it.each(seedFiles.map((file) => [path.relative(SEEDS_DIR, file), file]))(
    "%s writes only valid UUIDs",
    async (name, file) => {
      const mod = (await import(file)) as { seed?: (knex: Knex) => Promise<void> };
      expect(typeof mod.seed).toBe("function");

      const written: Written[] = [];
      await mod.seed!(createRecordingKnex(name, written));

      const problems = written.flatMap((entry) =>
        collectProblems(`${entry.source} → ${entry.table}`, entry.payload),
      );
      expect(problems).toEqual([]);
    },
  );

  it("fixture files contain only valid UUIDs", () => {
    const problems = fs
      .readdirSync(FIXTURES_DIR)
      .filter((name) => name.endsWith(".json"))
      .flatMap((name) => {
        const data = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8")) as unknown;
        return collectProblems(name, data);
      });
    expect(problems).toEqual([]);
  });

  it("the global exercise generator emits only valid UUIDs", () => {
    const source = fs.readFileSync(GENERATOR, "utf8");
    const invalid = [...source.matchAll(UUID_SHAPE)]
      .map((m) => m[0])
      .filter((id) => !isApiValid(id));
    expect(invalid).toEqual([]);
  });

  it("a session using any global exercise passes create validation", () => {
    const exercises = JSON.parse(
      fs.readFileSync(path.join(FIXTURES_DIR, "global-exercises.json"), "utf8"),
    ) as { id: string; name: string }[];

    const rejected = exercises.filter(
      (exercise) =>
        !CreateSessionSchema.safeParse({
          title: "Seed check",
          planned_at: "2026-11-26T12:00:00.000Z",
          visibility: "private",
          exercises: [
            {
              exercise_id: exercise.id,
              order: 1,
              planned: { sets: 3, reps: 10, load: 50 },
              sets: [{ order: 1, reps: 10, weight_kg: 50 }],
            },
          ],
        }).success,
    );

    expect(rejected.map((exercise) => `${exercise.name} (${exercise.id})`)).toEqual([]);
  });

  it("rejects a placeholder ID like the ones that broke saving", () => {
    expect(isApiValid("77777777-7777-7777-7777-777777777777")).toBe(false);
    expect(
      collectProblems("sample", { id: "77777777-7777-7777-7777-777777777777" }).length,
    ).toBeGreaterThan(0);
  });
});
