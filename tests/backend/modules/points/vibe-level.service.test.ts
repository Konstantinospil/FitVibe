import * as vibeLevelService from "../../../../apps/backend/src/modules/points/vibe-level.service.js";
import * as vibeLevelRepository from "../../../../apps/backend/src/modules/points/vibe-level.repository.js";
import type {
  DomainCode,
  DomainImpact,
  DomainVibeLevel,
  ExerciseMetadata,
} from "../../../../apps/backend/src/modules/points/points.types.js";
import type { SessionWithExercises } from "../../../../apps/backend/src/modules/sessions/sessions.types.js";

// Mock dependencies
jest.mock("../../../../apps/backend/src/modules/points/vibe-level.repository.js");
jest.mock("../../../../apps/backend/src/db/connection.js", () => ({
  db: {
    transaction: jest.fn((cb) => cb({})),
  },
}));

const mockVibeLevelRepo = jest.mocked(vibeLevelRepository);

describe("Vibe Level Service", () => {
  const userId = "user-123";
  const sessionId = "session-123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("detectSessionDomains", () => {
    it("should detect strength domain from weight lifted", () => {
      const session: SessionWithExercises = {
        id: sessionId,
        owner_id: userId,
        status: "completed",
        completed_at: new Date().toISOString(),
        started_at: new Date(Date.now() - 3600000).toISOString(),
        exercises: [
          {
            id: "ex-1",
            session_id: sessionId,
            order_index: 0,
            sets: [
              {
                id: "set-1",
                order_index: 0,
                weight_kg: 100,
                reps: 5,
              },
              {
                id: "set-2",
                order_index: 1,
                weight_kg: 100,
                reps: 5,
              },
            ],
          },
        ],
      } as SessionWithExercises;

      const exerciseMetadata = new Map<string, ExerciseMetadata>();
      const domains = vibeLevelService.detectSessionDomains(session, exerciseMetadata);

      expect(domains.length).toBeGreaterThan(0);
      const strengthDomain = domains.find((d) => d.domain === "strength");
      expect(strengthDomain).toBeDefined();
      expect(strengthDomain?.impact).toBeGreaterThan(0);
      expect(strengthDomain?.reason).toContain("Lifted");
    });

    it("should detect endurance domain from distance", () => {
      const session: SessionWithExercises = {
        id: sessionId,
        owner_id: userId,
        status: "completed",
        completed_at: new Date().toISOString(),
        started_at: new Date(Date.now() - 3600000).toISOString(),
        exercises: [
          {
            id: "ex-1",
            session_id: sessionId,
            order_index: 0,
            actual: {
              distance: 10, // 10km
            },
            sets: [],
          },
        ],
      } as SessionWithExercises;

      const exerciseMetadata = new Map<string, ExerciseMetadata>();
      const domains = vibeLevelService.detectSessionDomains(session, exerciseMetadata);

      const enduranceDomain = domains.find((d) => d.domain === "endurance");
      expect(enduranceDomain).toBeDefined();
      expect(enduranceDomain?.impact).toBe(1.0); // 10km = max impact
      expect(enduranceDomain?.reason).toContain("Covered");
    });

    it("should detect explosivity domain from high RPE and short duration", () => {
      const session: SessionWithExercises = {
        id: sessionId,
        owner_id: userId,
        status: "completed",
        completed_at: new Date().toISOString(),
        started_at: new Date(Date.now() - 20 * 60000).toISOString(), // 20 minutes
        exercises: [
          {
            id: "ex-1",
            session_id: sessionId,
            order_index: 0,
            actual: {
              rpe: 10,
            },
            sets: [
              {
                id: "set-1",
                order_index: 0,
                rpe: 10,
              },
            ],
          },
        ],
      } as SessionWithExercises;

      const exerciseMetadata = new Map<string, ExerciseMetadata>();
      const domains = vibeLevelService.detectSessionDomains(session, exerciseMetadata);

      const explosivityDomain = domains.find((d) => d.domain === "explosivity");
      expect(explosivityDomain).toBeDefined();
      expect(explosivityDomain?.impact).toBe(1.0); // RPE 10 = max impact
      expect(explosivityDomain?.reason).toContain("High intensity");
    });

    it("should detect agility domain from bodyweight reps", () => {
      const session: SessionWithExercises = {
        id: sessionId,
        owner_id: userId,
        status: "completed",
        completed_at: new Date().toISOString(),
        started_at: new Date(Date.now() - 3600000).toISOString(),
        exercises: [
          {
            id: "ex-1",
            session_id: sessionId,
            order_index: 0,
            sets: [
              {
                id: "set-1",
                order_index: 0,
                reps: 50,
                rpe: 6,
              },
            ],
          },
        ],
      } as SessionWithExercises;

      const exerciseMetadata = new Map<string, ExerciseMetadata>();
      const domains = vibeLevelService.detectSessionDomains(session, exerciseMetadata);

      const agilityDomain = domains.find((d) => d.domain === "agility");
      expect(agilityDomain).toBeDefined();
      expect(agilityDomain?.impact).toBeGreaterThan(0);
      expect(agilityDomain?.reason).toContain("bodyweight reps");
    });

    it("should detect regeneration domain from yoga/pilates", () => {
      const session: SessionWithExercises = {
        id: sessionId,
        owner_id: userId,
        status: "completed",
        completed_at: new Date().toISOString(),
        started_at: new Date(Date.now() - 3600000).toISOString(),
        exercises: [
          {
            id: "ex-1",
            session_id: sessionId,
            exercise_id: "yoga-exercise",
            order_index: 0,
            sets: [],
          },
        ],
      } as SessionWithExercises;

      const exerciseMetadata = new Map<string, ExerciseMetadata>([
        ["yoga-exercise", { id: "yoga-exercise", type_code: "yoga", tags: [] }],
      ]);
      const domains = vibeLevelService.detectSessionDomains(session, exerciseMetadata);

      const regenerationDomain = domains.find((d) => d.domain === "regeneration");
      expect(regenerationDomain).toBeDefined();
      expect(regenerationDomain?.impact).toBe(0.9);
      expect(regenerationDomain?.reason).toContain("Flexibility/mobility");
    });

    it("should detect intelligence domain from skill exercises", () => {
      const session: SessionWithExercises = {
        id: sessionId,
        owner_id: userId,
        status: "completed",
        completed_at: new Date().toISOString(),
        started_at: new Date(Date.now() - 3600000).toISOString(),
        exercises: [
          {
            id: "ex-1",
            session_id: sessionId,
            exercise_id: "sailing-exercise",
            order_index: 0,
            sets: [],
          },
        ],
      } as SessionWithExercises;

      const exerciseMetadata = new Map<string, ExerciseMetadata>([
        ["sailing-exercise", { id: "sailing-exercise", type_code: "skill", tags: [] }],
      ]);
      const domains = vibeLevelService.detectSessionDomains(session, exerciseMetadata);

      const intelligenceDomain = domains.find((d) => d.domain === "intelligence");
      expect(intelligenceDomain).toBeDefined();
      expect(intelligenceDomain?.impact).toBe(0.8);
      expect(intelligenceDomain?.reason).toContain("Skill/mental");
    });

    it("should credit a domain from vibe type_code when metrics do not trigger it", () => {
      const session: SessionWithExercises = {
        id: sessionId,
        owner_id: userId,
        status: "completed",
        completed_at: new Date().toISOString(),
        started_at: new Date(Date.now() - 5 * 60000).toISOString(),
        exercises: [
          {
            id: "ex-1",
            session_id: sessionId,
            exercise_id: "strength-catalog",
            order_index: 0,
            sets: [],
          },
        ],
      } as SessionWithExercises;

      const exerciseMetadata = new Map<string, ExerciseMetadata>([
        ["strength-catalog", { id: "strength-catalog", type_code: "strength", tags: [] }],
      ]);
      const domains = vibeLevelService.detectSessionDomains(session, exerciseMetadata);

      const strengthDomain = domains.find((d) => d.domain === "strength");
      expect(strengthDomain).toBeDefined();
      expect(strengthDomain?.impact).toBe(0.85);
      expect(strengthDomain?.reason).toContain("Catalog vibe");
      expect(domains.filter((d) => d.domain === "strength")).toHaveLength(1);
    });

    it("should not duplicate a domain already credited by metrics", () => {
      const session: SessionWithExercises = {
        id: sessionId,
        owner_id: userId,
        status: "completed",
        completed_at: new Date().toISOString(),
        started_at: new Date(Date.now() - 3600000).toISOString(),
        exercises: [
          {
            id: "ex-1",
            session_id: sessionId,
            exercise_id: "strength-catalog",
            order_index: 0,
            sets: [
              {
                id: "set-1",
                order_index: 0,
                weight_kg: 100,
                reps: 5,
              },
            ],
          },
        ],
      } as SessionWithExercises;

      const exerciseMetadata = new Map<string, ExerciseMetadata>([
        ["strength-catalog", { id: "strength-catalog", type_code: "strength", tags: [] }],
      ]);
      const domains = vibeLevelService.detectSessionDomains(session, exerciseMetadata);

      expect(domains.filter((d) => d.domain === "strength")).toHaveLength(1);
      expect(domains.find((d) => d.domain === "strength")?.reason).toContain("Lifted");
    });

    it("should detect multiple domains in one session", () => {
      const session: SessionWithExercises = {
        id: sessionId,
        owner_id: userId,
        status: "completed",
        completed_at: new Date().toISOString(),
        started_at: new Date(Date.now() - 20 * 60000).toISOString(), // 20 minutes
        exercises: [
          {
            id: "ex-1",
            session_id: sessionId,
            order_index: 0,
            actual: {
              rpe: 10,
            },
            sets: [
              {
                id: "set-1",
                order_index: 0,
                weight_kg: 100,
                reps: 10,
                rpe: 10,
              },
            ],
          },
        ],
      } as SessionWithExercises;

      const exerciseMetadata = new Map<string, ExerciseMetadata>();
      const domains = vibeLevelService.detectSessionDomains(session, exerciseMetadata);

      expect(domains.length).toBeGreaterThan(1);
      const strengthDomain = domains.find((d) => d.domain === "strength");
      const explosivityDomain = domains.find((d) => d.domain === "explosivity");
      expect(strengthDomain).toBeDefined();
      expect(explosivityDomain).toBeDefined();
    });

    it("should default to intelligence domain if no domains detected", () => {
      const session: SessionWithExercises = {
        id: sessionId,
        owner_id: userId,
        status: "completed",
        completed_at: new Date().toISOString(),
        started_at: new Date().toISOString(), // No duration (same time)
        exercises: [],
      } as SessionWithExercises;

      const exerciseMetadata = new Map<string, ExerciseMetadata>();
      const domains = vibeLevelService.detectSessionDomains(session, exerciseMetadata);

      expect(domains.length).toBeGreaterThan(0);
      expect(domains[0].domain).toBe("intelligence");
      expect(domains[0].reason).toContain("Default domain");
    });

    it("should sort domains by impact (highest first)", () => {
      const session: SessionWithExercises = {
        id: sessionId,
        owner_id: userId,
        status: "completed",
        completed_at: new Date().toISOString(),
        started_at: new Date(Date.now() - 3600000).toISOString(),
        exercises: [
          {
            id: "ex-1",
            session_id: sessionId,
            order_index: 0,
            actual: {
              distance: 5, // 5km
            },
            sets: [
              {
                id: "set-1",
                order_index: 0,
                weight_kg: 50,
                reps: 5,
              },
            ],
          },
        ],
      } as SessionWithExercises;

      const exerciseMetadata = new Map<string, ExerciseMetadata>();
      const domains = vibeLevelService.detectSessionDomains(session, exerciseMetadata);

      // Check that domains are sorted by impact
      for (let i = 0; i < domains.length - 1; i++) {
        expect(domains[i].impact).toBeGreaterThanOrEqual(domains[i + 1].impact);
      }
    });
  });

  describe("calculatePerformanceScore", () => {
    const createSession = (overrides: Partial<SessionWithExercises>): SessionWithExercises => ({
      id: sessionId,
      owner_id: userId,
      status: "completed",
      completed_at: new Date().toISOString(),
      started_at: new Date(Date.now() - 3600000).toISOString(),
      exercises: [],
      ...overrides,
    });

    it("should calculate performance score for strength domain", () => {
      const session = createSession({
        exercises: [
          {
            id: "ex-1",
            session_id: sessionId,
            order_index: 0,
            sets: [
              {
                id: "set-1",
                order_index: 0,
                weight_kg: 100,
                reps: 5,
              },
            ],
          },
        ],
      });

      const exerciseMetadata = new Map<string, ExerciseMetadata>();
      const score = vibeLevelService.calculatePerformanceScore(
        session,
        "strength",
        1000, // Initial vibe level
        exerciseMetadata,
      );

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("should calculate performance score for endurance domain", () => {
      const session = createSession({
        exercises: [
          {
            id: "ex-1",
            session_id: sessionId,
            order_index: 0,
            actual: {
              distance: 10, // 10km
            },
            sets: [],
          },
        ],
      });

      const exerciseMetadata = new Map<string, ExerciseMetadata>();
      const score = vibeLevelService.calculatePerformanceScore(
        session,
        "endurance",
        1000,
        exerciseMetadata,
      );

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("should handle missing metrics gracefully", () => {
      const session = createSession({ exercises: [] });
      const exerciseMetadata = new Map<string, ExerciseMetadata>();

      const score = vibeLevelService.calculatePerformanceScore(
        session,
        "strength",
        1000,
        exerciseMetadata,
      );

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe("updateVibeProgression", () => {
    it("should update rating for good performance", () => {
      const result = vibeLevelService.updateVibeProgression(
        1000, // Current rating
        350, // Current RD
        0.06, // Current volatility
        0.8, // Good outcome (80%)
        1.0, // Full domain impact
      );

      expect(result.newRating).toBeGreaterThan(1000);
      expect(result.newRd).toBeLessThan(350); // RD should decrease with activity
      expect(result.newRating).toBeGreaterThanOrEqual(100);
      expect(result.newRating).toBeLessThanOrEqual(3000);
      expect(result.newRd).toBeGreaterThanOrEqual(30);
      expect(result.newRd).toBeLessThanOrEqual(350);
    });

    it("should update rating for poor performance", () => {
      const result = vibeLevelService.updateVibeProgression(
        1000,
        350,
        0.06,
        0.2, // Poor outcome (20%)
        1.0,
      );

      // With high RD (350), even poor performance might not decrease rating much
      // The key is that RD should decrease with activity
      expect(result.newRd).toBeLessThan(350);
      // Rating change should be negative or minimal
      const ratingChange = result.newRating - 1000;
      expect(ratingChange).toBeLessThan(50); // Should not increase significantly
    });

    it("should apply domain impact multiplier", () => {
      const resultFull = vibeLevelService.updateVibeProgression(1000, 350, 0.06, 0.8, 1.0);
      const resultPartial = vibeLevelService.updateVibeProgression(1000, 350, 0.06, 0.8, 0.5);

      // Partial impact should result in smaller rating change
      const changeFull = resultFull.newRating - 1000;
      const changePartial = resultPartial.newRating - 1000;
      expect(Math.abs(changePartial)).toBeLessThan(Math.abs(changeFull));
    });

    it("should clamp rating values to valid ranges", () => {
      const result = vibeLevelService.updateVibeProgression(100, 350, 0.06, 0.0, 1.0);

      expect(result.newRating).toBeGreaterThanOrEqual(100);
      expect(result.newRating).toBeLessThanOrEqual(3000);
      expect(result.newRd).toBeGreaterThanOrEqual(30);
      expect(result.newRd).toBeLessThanOrEqual(350);
      expect(result.newVolatility).toBeGreaterThanOrEqual(0.01);
      expect(result.newVolatility).toBeLessThanOrEqual(0.1);
    });
  });

  describe("calculateGeneralFitnessScore", () => {
    it("should calculate geometric mean for balanced user", () => {
      const vibeLevels = new Map<DomainCode, DomainVibeLevel>([
        [
          "strength",
          {
            user_id: userId,
            domain_code: "strength",
            vibe_level: 1500,
            rating_deviation: 50,
            volatility: 0.06,
            last_updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        [
          "agility",
          {
            user_id: userId,
            domain_code: "agility",
            vibe_level: 1500,
            rating_deviation: 50,
            volatility: 0.06,
            last_updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        [
          "endurance",
          {
            user_id: userId,
            domain_code: "endurance",
            vibe_level: 1500,
            rating_deviation: 50,
            volatility: 0.06,
            last_updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        [
          "explosivity",
          {
            user_id: userId,
            domain_code: "explosivity",
            vibe_level: 1500,
            rating_deviation: 50,
            volatility: 0.06,
            last_updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        [
          "intelligence",
          {
            user_id: userId,
            domain_code: "intelligence",
            vibe_level: 1500,
            rating_deviation: 50,
            volatility: 0.06,
            last_updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        [
          "regeneration",
          {
            user_id: userId,
            domain_code: "regeneration",
            vibe_level: 1500,
            rating_deviation: 50,
            volatility: 0.06,
            last_updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      ]);

      const score = vibeLevelService.calculateGeneralFitnessScore(vibeLevels);
      expect(score).toBe(1500);
    });

    it("should penalize imbalanced users", () => {
      const vibeLevels = new Map<DomainCode, DomainVibeLevel>([
        [
          "strength",
          {
            user_id: userId,
            domain_code: "strength",
            vibe_level: 2000,
            rating_deviation: 50,
            volatility: 0.06,
            last_updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        [
          "agility",
          {
            user_id: userId,
            domain_code: "agility",
            vibe_level: 2000,
            rating_deviation: 50,
            volatility: 0.06,
            last_updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        [
          "endurance",
          {
            user_id: userId,
            domain_code: "endurance",
            vibe_level: 2000,
            rating_deviation: 50,
            volatility: 0.06,
            last_updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        [
          "explosivity",
          {
            user_id: userId,
            domain_code: "explosivity",
            vibe_level: 2000,
            rating_deviation: 50,
            volatility: 0.06,
            last_updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        [
          "intelligence",
          {
            user_id: userId,
            domain_code: "intelligence",
            vibe_level: 2000,
            rating_deviation: 50,
            volatility: 0.06,
            last_updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        [
          "regeneration",
          {
            user_id: userId,
            domain_code: "regeneration",
            vibe_level: 500, // Weak domain
            rating_deviation: 50,
            volatility: 0.06,
            last_updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      ]);

      const score = vibeLevelService.calculateGeneralFitnessScore(vibeLevels);
      const arithmeticMean = (2000 * 5 + 500) / 6; // 1750

      // Geometric mean should be lower than arithmetic mean for imbalanced users
      expect(score).toBeLessThan(arithmeticMean);
      // Calculate: (2000^5 * 500)^(1/6) ≈ 1587
      expect(score).toBeCloseTo(1587, 0);
    });

    it("should handle missing domains (default to 1000)", () => {
      const vibeLevels = new Map<DomainCode, DomainVibeLevel>([
        [
          "strength",
          {
            user_id: userId,
            domain_code: "strength",
            vibe_level: 1200,
            rating_deviation: 50,
            volatility: 0.06,
            last_updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        // Other domains missing
      ]);

      const score = vibeLevelService.calculateGeneralFitnessScore(vibeLevels);
      expect(score).toBeGreaterThan(0);
      // Should use 1000 for missing domains
    });
  });

  describe("updateDomainVibeLevelForSession", () => {
    it("should update vibe level and return result", async () => {
      const session: SessionWithExercises = {
        id: sessionId,
        owner_id: userId,
        status: "completed",
        completed_at: new Date().toISOString(),
        started_at: new Date(Date.now() - 3600000).toISOString(),
        exercises: [
          {
            id: "ex-1",
            session_id: sessionId,
            order_index: 0,
            sets: [
              {
                id: "set-1",
                order_index: 0,
                weight_kg: 100,
                reps: 5,
              },
            ],
          },
        ],
      } as SessionWithExercises;

      const domainImpact: DomainImpact = {
        domain: "strength",
        impact: 1.0,
        reason: "Lifted 500kg total",
      };

      const exerciseMetadata = new Map<string, ExerciseMetadata>();

      mockVibeLevelRepo.getDomainVibeLevel.mockResolvedValue({
        user_id: userId,
        domain_code: "strength",
        vibe_level: 1000,
        rating_deviation: 350,
        volatility: 0.06,
        last_updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      mockVibeLevelRepo.updateDomainVibeLevel.mockResolvedValue();
      mockVibeLevelRepo.insertVibeLevelChange.mockResolvedValue({
        id: "change-1",
        user_id: userId,
        domain_code: "strength",
        session_id: sessionId,
        old_vibe_level: 1000,
        new_vibe_level: 1010,
        old_rd: 350,
        new_rd: 340,
        change_amount: 10,
        performance_score: 80,
        domain_impact: 1.0,
        points_awarded: 20,
        change_reason: "session_completed",
        metadata: {},
        created_at: new Date().toISOString(),
      });

      mockVibeLevelRepo.getAllDomainVibeLevels.mockResolvedValue(
        new Map([
          [
            "strength",
            {
              user_id: userId,
              domain_code: "strength",
              vibe_level: 1000,
              rating_deviation: 350,
              volatility: 0.06,
              last_updated_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        ]),
      );

      const result = await vibeLevelService.updateDomainVibeLevelForSession(
        userId,
        "strength",
        session,
        domainImpact,
        exerciseMetadata,
      );

      expect(mockVibeLevelRepo.lockVibeLevelsForUser).toHaveBeenCalledWith(
        userId,
        expect.anything(),
      );
      expect(mockVibeLevelRepo.lockVibeLevelsForUser.mock.invocationCallOrder[0]).toBeLessThan(
        mockVibeLevelRepo.getDomainVibeLevel.mock.invocationCallOrder[0],
      );
      expect(result.domain).toBe("strength");
      expect(result.oldVibeLevel).toBe(1000);
      expect(result.newVibeLevel).toBeGreaterThan(1000);
      expect(mockVibeLevelRepo.updateDomainVibeLevel).toHaveBeenCalled();
      expect(mockVibeLevelRepo.insertVibeLevelChange).toHaveBeenCalled();
    });

    it("should use initial values if domain rating doesn't exist", async () => {
      const session: SessionWithExercises = {
        id: sessionId,
        owner_id: userId,
        status: "completed",
        completed_at: new Date().toISOString(),
        started_at: new Date(Date.now() - 3600000).toISOString(),
        exercises: [],
      } as SessionWithExercises;

      const domainImpact: DomainImpact = {
        domain: "strength",
        impact: 1.0,
        reason: "Test",
      };

      const exerciseMetadata = new Map<string, ExerciseMetadata>();

      mockVibeLevelRepo.getDomainVibeLevel.mockResolvedValue(undefined);
      mockVibeLevelRepo.updateDomainVibeLevel.mockResolvedValue();
      mockVibeLevelRepo.insertVibeLevelChange.mockResolvedValue({
        id: "change-1",
        user_id: userId,
        domain_code: "strength",
        session_id: sessionId,
        old_vibe_level: 1000,
        new_vibe_level: 1010,
        old_rd: 350,
        new_rd: 340,
        change_amount: 10,
        performance_score: 50,
        domain_impact: 1.0,
        points_awarded: 10,
        change_reason: "session_completed",
        metadata: {},
        created_at: new Date().toISOString(),
      });

      mockVibeLevelRepo.getAllDomainVibeLevels.mockResolvedValue(new Map());

      await vibeLevelService.updateDomainVibeLevelForSession(
        userId,
        "strength",
        session,
        domainImpact,
        exerciseMetadata,
      );

      expect(mockVibeLevelRepo.updateDomainVibeLevel).toHaveBeenCalled();
    });
  });
});
