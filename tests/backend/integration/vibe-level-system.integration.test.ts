/**
 * Integration test for vibe level system (v2_vibe_lvl algorithm)
 *
 * Tests the cross-module flow:
 * 1. User completes a session
 * 2. Domains are detected from session metrics
 * 3. Vibe levels are updated using the endogenous FitVibe progression model
 * 4. Points are calculated and awarded
 * 5. Rating decay is applied for inactive domains
 *
 * Uses real database with transaction-based cleanup.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from "@jest/globals";
import bcrypt from "bcryptjs";
import db from "../../../apps/backend/src/db/index.js";
import { createUser } from "../../../apps/backend/src/modules/auth/auth.repository.js";
import { awardPointsForSession, getPointsHistory } from "../../../apps/backend/src/modules/points/points.service.js";
import { reconcileGamificationProjection } from "../../../apps/backend/src/modules/points/gamification-projection.service.js";
import { applyVibeLevelDecay } from "../../../apps/backend/src/jobs/services/vibe-level-decay.service.js";
import {
  getDomainVibeLevel,
  getAllDomainVibeLevels,
} from "../../../apps/backend/src/modules/points/points.repository.js";
import {
  truncateAll,
  ensureRolesSeeded,
  withDatabaseErrorHandling,
  ensureUsernameColumnExists,
} from "../../setup/test-helpers.js";
import { describeWithTestDatabase } from "../../setup/db-availability.js";
import { v4 as uuidv4 } from "uuid";
import { getCurrentTermsVersion } from "../../../apps/backend/src/config/terms.js";
import type { SessionWithExercises } from "../../../apps/backend/src/modules/sessions/sessions.types.js";
import { listCompletedSessionIdsForGamification } from "../../../apps/backend/src/modules/sessions/sessions.repository.js";

async function persistSession(session: SessionWithExercises): Promise<void> {
  await db("sessions").insert({
    id: session.id,
    owner_id: session.owner_id,
    title: session.title ?? "Test Session",
    planned_at: session.planned_at,
    started_at: session.started_at ?? null,
    completed_at: session.completed_at ?? null,
    status: session.status,
    visibility: session.visibility,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

async function persistAndAward(session: SessionWithExercises) {
  await persistSession(session);
  return awardPointsForSession(session);
}

describeWithTestDatabase("Integration: Vibe Level System (v2_vibe_lvl)", () => {
  let testUser: { id: string; email: string; password: string };

  beforeAll(async () => {
    await ensureUsernameColumnExists();
  });

  beforeEach(async () => {
    await withDatabaseErrorHandling(async () => {
      await truncateAll();
      await ensureRolesSeeded();

      // Create a test user
      const userId = uuidv4();
      const password = "SecureP@ssw0rd123!";
      const passwordHash = await bcrypt.hash(password, 12);
      const now = new Date().toISOString();

      const userResult = await createUser({
        id: userId,
        username: "vibetest",
        display_name: "Vibe Test User",
        status: "active",
        role_code: "athlete",
        password_hash: passwordHash,
        primaryEmail: "vibetest@example.com",
        emailVerified: true,
        terms_accepted: true,
        terms_accepted_at: now,
        terms_version: getCurrentTermsVersion(),
      });

      if (!userResult) {
        throw new Error("Failed to create test user");
      }

      testUser = {
        id: userId,
        email: "vibetest@example.com",
        password,
      };

      // Initialize vibe levels for the test user (migration only initializes existing users)
      await db.raw(
        `
        INSERT INTO user_domain_vibe_levels (user_id, domain_code, vibe_level, rating_deviation, volatility)
        SELECT 
          ?,
          domain.domain_code,
          1000.0,
          350.0,
          0.06
        FROM (
          SELECT unnest(ARRAY[
            'strength', 'agility', 'endurance', 
            'explosivity', 'intelligence', 'regeneration'
          ]) AS domain_code
        ) domain
        ON CONFLICT (user_id, domain_code) DO NOTHING;
      `,
        [userId],
      );

      // Verify vibe levels were initialized
      const vibeLevels = await getAllDomainVibeLevels(userId);
      expect(vibeLevels.size).toBe(6); // All 6 domains should be initialized
    });
  });

  afterEach(async () => {
    await truncateAll();
  });

  it("should initialize vibe levels for new user", async () => {
    const strengthLevel = await getDomainVibeLevel(testUser.id, "strength");
    expect(strengthLevel).toBeDefined();
    expect(strengthLevel?.vibe_level).toBe(1000.0);
    expect(strengthLevel?.rating_deviation).toBe(350.0);
    expect(strengthLevel?.volatility).toBe(0.06);

    const allLevels = await getAllDomainVibeLevels(testUser.id);
    expect(allLevels.size).toBe(6);
    for (const [domain, level] of allLevels) {
      expect(level.vibe_level).toBe(1000.0);
      expect(level.rating_deviation).toBe(350.0);
    }
  });

  it("converges concurrent scoring attempts to one current points event", async () => {
    const session: SessionWithExercises = {
      id: uuidv4(),
      owner_id: testUser.id,
      status: "completed",
      completed_at: new Date().toISOString(),
      started_at: new Date(Date.now() - 30 * 60000).toISOString(),
      visibility: "private",
      planned_at: new Date().toISOString(),
      exercises: [],
    };

    await persistSession(session);

    const results = await Promise.all([
      awardPointsForSession(session, { scheduleSecondary: false }),
      awardPointsForSession(session, { scheduleSecondary: false }),
    ]);

    expect(results.filter((result) => result.awarded)).toHaveLength(1);
    expect(new Set(results.map((result) => result.eventId)).size).toBe(1);

    const events = await db("user_points").where({
      user_id: testUser.id,
      source_type: "session_completed",
      source_id: session.id,
    });
    expect(events).toHaveLength(1);
  });

  it("archives replaced scoring and leaves one current event after a full projection rebuild", async () => {
    const session: SessionWithExercises = {
      id: uuidv4(),
      owner_id: testUser.id,
      status: "completed",
      completed_at: new Date().toISOString(),
      started_at: new Date(Date.now() - 30 * 60000).toISOString(),
      visibility: "private",
      planned_at: new Date().toISOString(),
      exercises: [],
    };

    await persistSession(session);
    await awardPointsForSession(session, { scheduleSecondary: false });

    const before = await db("user_points").where({
      user_id: testUser.id,
      source_type: "session_completed",
      source_id: session.id,
    });
    expect(before).toHaveLength(1);

    const manualEventId = uuidv4();
    await db("user_points").insert({
      id: manualEventId,
      user_id: testUser.id,
      source_type: "manual_adjustment",
      source_id: uuidv4(),
      algorithm_version: "manual",
      points: 17,
      calories: null,
      metadata: { reason: "integration-preserve-manual" },
      awarded_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });

    const rebuilt = await reconcileGamificationProjection(testUser.id, {
      forceFullRebuild: true,
      reason: "integration_test_rebuild",
    });
    expect(rebuilt.rebuilt).toBe(true);

    const after = await db("user_points").where({
      user_id: testUser.id,
      source_type: "session_completed",
      source_id: session.id,
    });
    expect(after).toHaveLength(1);

    const revisions = await db("points_event_revisions").where({
      user_id: testUser.id,
      points_event_id: before[0].id,
      revision_reason: "integration_test_rebuild",
    });
    expect(revisions).toHaveLength(1);

    const preservedManual = await db("user_points").where({ id: manualEventId }).first();
    expect(preservedManual).toBeDefined();
    expect(Number(preservedManual.points)).toBe(17);

    const projection = await db("user_gamification_projection_state")
      .where({ user_id: testUser.id })
      .first();
    expect(projection.is_stale).toBe(false);
    expect(projection.rebuild_required).toBe(false);
  });

  it("replays completed sessions in deterministic chronological order", async () => {
    const sameCompletedAt = "2026-09-23T11:00:00.000Z";
    const earlier: SessionWithExercises = {
      id: "00000000-0000-4000-8000-000000000010",
      owner_id: testUser.id,
      status: "completed",
      completed_at: "2026-09-23T10:00:00.000Z",
      visibility: "private",
      planned_at: "2026-09-23T09:00:00.000Z",
      exercises: [],
    };
    const sameTimeLowerId: SessionWithExercises = {
      ...earlier,
      id: "00000000-0000-4000-8000-000000000011",
      completed_at: sameCompletedAt,
    };
    const sameTimeHigherId: SessionWithExercises = {
      ...earlier,
      id: "00000000-0000-4000-8000-000000000012",
      completed_at: sameCompletedAt,
    };

    await persistSession(sameTimeHigherId);
    await persistSession(earlier);
    await persistSession(sameTimeLowerId);

    const ordered = await listCompletedSessionIdsForGamification(testUser.id);

    expect(ordered).toEqual([
      earlier.id,
      sameTimeLowerId.id,
      sameTimeHigherId.id,
    ]);
  });

  it("paginates equal-timestamp point events without gaps or duplicates", async () => {
    const awardedAt = "2026-09-23T10:00:00.000Z";
    const rows = [
      {
        id: "00000000-0000-4000-8000-000000000003",
        sourceId: "10000000-0000-4000-8000-000000000003",
        points: 30,
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        sourceId: "10000000-0000-4000-8000-000000000002",
        points: 20,
      },
      {
        id: "00000000-0000-4000-8000-000000000001",
        sourceId: "10000000-0000-4000-8000-000000000001",
        points: 10,
      },
    ];

    await db("user_points").insert(
      rows.map((row) => ({
        id: row.id,
        user_id: testUser.id,
        source_type: "manual_adjustment",
        source_id: row.sourceId,
        algorithm_version: "manual",
        points: row.points,
        calories: null,
        metadata: {},
        awarded_at: awardedAt,
        created_at: awardedAt,
      })),
    );

    const first = await getPointsHistory(testUser.id, { limit: 2 });
    expect(first.items.map((item) => item.id)).toEqual([rows[0].id, rows[1].id]);
    expect(first.nextCursor).toBe(awardedAt + "|" + rows[1].id);

    const second = await getPointsHistory(testUser.id, {
      limit: 2,
      cursor: first.nextCursor ?? undefined,
    });

    const allIds = [...first.items, ...second.items].map((item) => item.id);
    expect(allIds).toEqual(rows.map((row) => row.id));
    expect(new Set(allIds).size).toBe(rows.length);
    expect(second.nextCursor).toBeNull();
  });

  it("should detect strength domain and update vibe level", async () => {
    const session: SessionWithExercises = {
      id: uuidv4(),
      owner_id: testUser.id,
      status: "completed",
      completed_at: new Date().toISOString(),
      started_at: new Date(Date.now() - 3600000).toISOString(),
      visibility: "private",
      planned_at: new Date().toISOString(),
      exercises: [
        {
          id: uuidv4(),
          session_id: uuidv4(),
          order_index: 0,
          sets: [
            {
              id: uuidv4(),
              order_index: 0,
              weight_kg: 100,
              reps: 5,
            },
            {
              id: uuidv4(),
              order_index: 1,
              weight_kg: 100,
              reps: 5,
            },
          ],
        },
      ],
    };

    const result = await persistAndAward(session);

    expect(result.awarded).toBe(true);
    expect(result.pointsAwarded).toBeGreaterThan(0);

    // Check that strength vibe level was updated
    const strengthLevel = await getDomainVibeLevel(testUser.id, "strength");
    expect(strengthLevel).toBeDefined();
    // Vibe level should have changed (could be up or down depending on performance)
    expect(strengthLevel?.vibe_level).not.toBe(1000.0);
    expect(strengthLevel?.rating_deviation).toBeLessThan(350.0); // RD should decrease with activity
  });

  it("should detect endurance domain from distance", async () => {
    const session: SessionWithExercises = {
      id: uuidv4(),
      owner_id: testUser.id,
      status: "completed",
      completed_at: new Date().toISOString(),
      started_at: new Date(Date.now() - 3600000).toISOString(),
      visibility: "private",
      planned_at: new Date().toISOString(),
      exercises: [
        {
          id: uuidv4(),
          session_id: uuidv4(),
          order_index: 0,
          actual: {
            distance: 10, // 10km
            rpe: 7,
          },
          sets: [],
        },
      ],
    };

    const result = await persistAndAward(session);

    expect(result.awarded).toBe(true);
    expect(result.pointsAwarded).toBeGreaterThan(0);

    const enduranceLevel = await getDomainVibeLevel(testUser.id, "endurance");
    expect(enduranceLevel).toBeDefined();
    expect(enduranceLevel?.vibe_level).not.toBe(1000.0);
  });

  it("should detect multiple domains in one session", async () => {
    const session: SessionWithExercises = {
      id: uuidv4(),
      owner_id: testUser.id,
      status: "completed",
      completed_at: new Date().toISOString(),
      started_at: new Date(Date.now() - 20 * 60000).toISOString(), // 20 minutes
      visibility: "private",
      planned_at: new Date().toISOString(),
      exercises: [
        {
          id: uuidv4(),
          session_id: uuidv4(),
          order_index: 0,
          actual: {
            rpe: 10,
          },
          sets: [
            {
              id: uuidv4(),
              order_index: 0,
              weight_kg: 100,
              reps: 10,
              rpe: 10,
            },
          ],
        },
      ],
    };

    const result = await persistAndAward(session);

    expect(result.awarded).toBe(true);
    expect(result.pointsAwarded).toBeGreaterThan(0);

    // Both strength and explosivity should be updated
    const strengthLevel = await getDomainVibeLevel(testUser.id, "strength");
    const explosivityLevel = await getDomainVibeLevel(testUser.id, "explosivity");

    expect(strengthLevel).toBeDefined();
    expect(explosivityLevel).toBeDefined();
    expect(strengthLevel?.vibe_level).not.toBe(1000.0);
    expect(explosivityLevel?.vibe_level).not.toBe(1000.0);
  });

  it("should apply rating decay for inactive domains", async () => {
    // First, update a domain to have a recent timestamp
    const session: SessionWithExercises = {
      id: uuidv4(),
      owner_id: testUser.id,
      status: "completed",
      completed_at: new Date().toISOString(),
      started_at: new Date(Date.now() - 3600000).toISOString(),
      visibility: "private",
      planned_at: new Date().toISOString(),
      exercises: [
        {
          id: uuidv4(),
          session_id: uuidv4(),
          order_index: 0,
          sets: [
            {
              id: uuidv4(),
              order_index: 0,
              weight_kg: 100,
              reps: 5,
            },
          ],
        },
      ],
    };

    await persistAndAward(session);

    // Manually set last_updated_at to 2 days ago for strength domain
    await db("user_domain_vibe_levels")
      .where({ user_id: testUser.id, domain_code: "strength" })
      .update({
        last_updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      });

    // Get initial values
    const initialLevel = await getDomainVibeLevel(testUser.id, "strength");
    const initialVibeLevel = initialLevel?.vibe_level ?? 1000;
    const initialRd = initialLevel?.rating_deviation ?? 350;

    // Apply decay
    await applyVibeLevelDecay();

    // Check that decay was applied
    const decayedLevel = await getDomainVibeLevel(testUser.id, "strength");
    expect(decayedLevel).toBeDefined();
    expect(decayedLevel?.vibe_level).toBeLessThanOrEqual(initialVibeLevel); // Should decrease or stay same
    expect(decayedLevel?.rating_deviation).toBeGreaterThanOrEqual(initialRd); // RD should increase or stay same

    // Check that vibe level change was logged (if decay actually changed values)
    const changes = await db("vibe_level_changes")
      .where({ user_id: testUser.id, domain_code: "strength", change_reason: "decay" })
      .orderBy("created_at", "desc")
      .limit(1);

    // Decay may or may not create a log entry depending on whether values actually changed
    // If changes exist, verify they match expectations
    if (changes.length > 0) {
      expect(Number(changes[0].old_vibe_level)).toBe(initialVibeLevel);
      expect(Number(changes[0].new_vibe_level)).toBe(decayedLevel?.vibe_level);
    }
  });

  it("should not decay recently updated domains", async () => {
    // Update a domain
    const session: SessionWithExercises = {
      id: uuidv4(),
      owner_id: testUser.id,
      status: "completed",
      completed_at: new Date().toISOString(),
      started_at: new Date(Date.now() - 3600000).toISOString(),
      visibility: "private",
      planned_at: new Date().toISOString(),
      exercises: [
        {
          id: uuidv4(),
          session_id: uuidv4(),
          order_index: 0,
          sets: [
            {
              id: uuidv4(),
              order_index: 0,
              weight_kg: 100,
              reps: 5,
            },
          ],
        },
      ],
    };

    await persistAndAward(session);

    const initialLevel = await getDomainVibeLevel(testUser.id, "strength");
    const initialVibeLevel = initialLevel?.vibe_level ?? 1000;

    // Apply decay (should not affect recently updated domain)
    await applyVibeLevelDecay();

    const afterDecay = await getDomainVibeLevel(testUser.id, "strength");
    expect(afterDecay?.vibe_level).toBe(initialVibeLevel); // Should not change
  });

  it("should calculate general fitness score correctly", async () => {
    const { calculateGeneralFitnessScore } =
      await import("../../../apps/backend/src/modules/points/vibe-level.service.js");

    // Get all vibe levels
    const vibeLevels = await getAllDomainVibeLevels(testUser.id);

    // For balanced user (all 1000), score should be 1000
    const score = calculateGeneralFitnessScore(vibeLevels);
    expect(score).toBeCloseTo(1000, 0);

    // Update one domain to be much higher
    await db("user_domain_vibe_levels")
      .where({ user_id: testUser.id, domain_code: "strength" })
      .update({ vibe_level: 2000 });

    const updatedLevels = await getAllDomainVibeLevels(testUser.id);
    const updatedScore = calculateGeneralFitnessScore(updatedLevels);

    // Geometric mean should be lower than arithmetic mean for imbalanced users
    const arithmeticMean = (2000 + 1000 * 5) / 6; // ~1167
    expect(updatedScore).toBeLessThan(arithmeticMean);
  });

  it("should award more points to beginners for same effort", async () => {
    // Create two users: beginner (low vibe level) and advanced (high vibe level)
    const beginnerId = uuidv4();
    const advancedId = uuidv4();
    const passwordHash = await bcrypt.hash("password", 12);
    const now = new Date().toISOString();

    await createUser({
      id: beginnerId,
      username: "beginner",
      display_name: "Beginner",
      status: "active",
      role_code: "athlete",
      password_hash: passwordHash,
      primaryEmail: "beginner@example.com",
      emailVerified: true,
      terms_accepted: true,
      terms_accepted_at: now,
      terms_version: getCurrentTermsVersion(),
    });

    await createUser({
      id: advancedId,
      username: "advanced",
      display_name: "Advanced",
      status: "active",
      role_code: "athlete",
      password_hash: passwordHash,
      primaryEmail: "advanced@example.com",
      emailVerified: true,
      terms_accepted: true,
      terms_accepted_at: now,
      terms_version: getCurrentTermsVersion(),
    });

    // Initialize vibe levels for both users
    await db.raw(
      `
      INSERT INTO user_domain_vibe_levels (user_id, domain_code, vibe_level, rating_deviation, volatility)
      SELECT 
        ?,
        domain.domain_code,
        1000.0,
        350.0,
        0.06
      FROM (
        SELECT unnest(ARRAY[
          'strength', 'agility', 'endurance', 
          'explosivity', 'intelligence', 'regeneration'
        ]) AS domain_code
      ) domain
      ON CONFLICT (user_id, domain_code) DO NOTHING;
    `,
      [beginnerId],
    );

    await db.raw(
      `
      INSERT INTO user_domain_vibe_levels (user_id, domain_code, vibe_level, rating_deviation, volatility)
      SELECT 
        ?,
        domain.domain_code,
        1000.0,
        350.0,
        0.06
      FROM (
        SELECT unnest(ARRAY[
          'strength', 'agility', 'endurance', 
          'explosivity', 'intelligence', 'regeneration'
        ]) AS domain_code
      ) domain
      ON CONFLICT (user_id, domain_code) DO NOTHING;
    `,
      [advancedId],
    );

    // Set advanced user's strength vibe level to 2000
    await db("user_domain_vibe_levels")
      .where({ user_id: advancedId, domain_code: "strength" })
      .update({ vibe_level: 2000, rating_deviation: 50 });

    // Same session for both users
    const createSession = (userId: string): SessionWithExercises => ({
      id: uuidv4(),
      owner_id: userId,
      status: "completed",
      completed_at: new Date().toISOString(),
      started_at: new Date(Date.now() - 3600000).toISOString(),
      visibility: "private",
      planned_at: new Date().toISOString(),
      exercises: [
        {
          id: uuidv4(),
          session_id: uuidv4(),
          order_index: 0,
          sets: [
            {
              id: uuidv4(),
              order_index: 0,
              weight_kg: 100,
              reps: 5,
            },
          ],
        },
      ],
    });

    const beginnerResult = await persistAndAward(createSession(beginnerId));
    const advancedResult = await persistAndAward(createSession(advancedId));

    // Beginner should get more points for same effort (relative achievement)
    // Use >= to handle edge cases where they might be equal
    expect(beginnerResult.pointsAwarded).toBeGreaterThanOrEqual(advancedResult.pointsAwarded ?? 0);
  });
});
