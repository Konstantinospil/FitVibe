import { db } from "../../../../apps/backend/src/db/connection.js";
import * as sessionsService from "../../../../apps/backend/src/modules/sessions/sessions.service.js";
import * as sessionsRepository from "../../../../apps/backend/src/modules/sessions/sessions.repository.js";
import * as plansService from "../../../../apps/backend/src/modules/plans/plans.service.js";
import * as gamificationProjection from "../../../../apps/backend/src/modules/points/gamification-projection.service.js";
import * as auditUtil from "../../../../apps/backend/src/modules/common/audit.util.js";
import * as publicationService from "../../../../apps/backend/src/modules/feed/feed.publication.service.js";
import * as feedAccess from "../../../../apps/backend/src/modules/feed/feed.access.js";
import { HttpError } from "../../../../apps/backend/src/utils/http.js";
import type {
  CreateSessionDTO,
  UpdateSessionDTO,
  CloneSessionDTO,
  SessionRecurrenceDTO,
  Session,
  SessionWithExercises,
  SessionExercise,
} from "../../../../apps/backend/src/modules/sessions/sessions.types.js";

// Mock dependencies
jest.mock("../../../../apps/backend/src/modules/sessions/sessions.repository.js");
jest.mock("../../../../apps/backend/src/modules/plans/plans.service.js");
jest.mock("../../../../apps/backend/src/modules/points/gamification-projection.service.js");
jest.mock("../../../../apps/backend/src/modules/common/audit.util.js");
jest.mock("../../../../apps/backend/src/modules/feed/feed.publication.service.js");
jest.mock("../../../../apps/backend/src/modules/feed/feed.access.js");

const mockSessionsRepo = jest.mocked(sessionsRepository);
const mockPlansService = jest.mocked(plansService);
const mockGamificationProjection = jest.mocked(gamificationProjection);
const mockAuditUtil = jest.mocked(auditUtil);
const mockPublicationService = jest.mocked(publicationService);
const mockFeedAccess = jest.mocked(feedAccess);

// Mock db
jest.mock("../../../../apps/backend/src/db/connection.js", () => {
  const createQueryBuilder = (defaultValue: unknown = 1) => {
    const builder = Object.assign(Promise.resolve(defaultValue), {
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({ id: "plan-123", user_id: "user-123" }),
      update: jest.fn().mockResolvedValue(1),
      insert: jest.fn().mockResolvedValue([]),
    });
    return builder;
  };

  // Create a transaction object that can be used as a query builder and called as a function
  const createTrx = () => {
    const builder = createQueryBuilder({ id: "plan-123", user_id: "user-123" });
    // Make it callable like trx("plans") - Knex transaction is both a function and has query builder methods
    const callableBuilder = jest.fn((table: string) => builder) as jest.Mock;
    // Copy all builder methods to the callable function
    Object.keys(builder).forEach((key) => {
      if (typeof builder[key as keyof typeof builder] === "function") {
        (callableBuilder as unknown as Record<string, unknown>)[key] = (
          builder[key as keyof typeof builder] as () => unknown
        ).bind(builder);
      } else {
        (callableBuilder as unknown as Record<string, unknown>)[key] =
          builder[key as keyof typeof builder];
      }
    });
    return callableBuilder as typeof builder & jest.Mock;
  };

  const mockTransaction = jest.fn((cb: (trx: ReturnType<typeof createTrx>) => Promise<void>) =>
    cb(createTrx()),
  );

  const mockDbFunction = jest.fn(createQueryBuilder) as jest.Mock & {
    transaction: jest.Mock;
  };
  mockDbFunction.transaction = mockTransaction;

  return {
    db: mockDbFunction,
  };
});

const mockDb = jest.mocked(db);

describe("Sessions Service", () => {
  const userId = "user-123";
  const sessionId = "session-123";

  beforeEach(() => {
    jest.clearAllMocks();
    mockGamificationProjection.markGamificationStale.mockResolvedValue(undefined);
  });

  describe("getAll", () => {
    it("should return paginated sessions", async () => {
      const query = { page: 1, limit: 10 };
      const expectedResult = {
        items: [],
        total: 0,
        page: 1,
        limit: 10,
      };

      mockSessionsRepo.listSessions.mockResolvedValue(expectedResult);

      const result = await sessionsService.getAll(userId, query);

      expect(result).toEqual(expectedResult);
      expect(mockSessionsRepo.listSessions).toHaveBeenCalledWith(userId, query);
    });
  });

  describe("getOne", () => {
    it("should return session when found", async () => {
      const mockSession: SessionWithExercises = {
        id: sessionId,
        owner_id: userId,
        title: "Test Session",
        planned_at: new Date().toISOString(),
        status: "planned",
        visibility: "private",
        exercises: [],
      } as SessionWithExercises;

      mockFeedAccess.loadSessionOrThrow.mockResolvedValue(mockSession);
      mockFeedAccess.ensureSessionInteractionAllowed.mockResolvedValue(undefined);
      mockSessionsRepo.getSessionWithDetails.mockResolvedValue(mockSession);

      const result = await sessionsService.getOne(userId, sessionId);

      expect(result).toEqual(mockSession);
      expect(mockSessionsRepo.getSessionWithDetails).toHaveBeenCalledWith(sessionId, userId);
    });

    it("should throw 404 when session not found", async () => {
      mockFeedAccess.loadSessionOrThrow.mockResolvedValue({
        id: sessionId,
        owner_id: userId,
        status: "planned",
        visibility: "private",
        completed_at: null,
      });
      mockFeedAccess.ensureSessionInteractionAllowed.mockResolvedValue(undefined);
      mockSessionsRepo.getSessionWithDetails.mockResolvedValue(null);

      await expect(sessionsService.getOne(userId, sessionId)).rejects.toThrow(HttpError);
      await expect(sessionsService.getOne(userId, sessionId)).rejects.toThrow("SESSION_NOT_FOUND");
    });
  });

  describe("createOne", () => {
    const validDto: CreateSessionDTO = {
      title: "Test Session",
      planned_at: new Date().toISOString(),
      visibility: "private",
    };

    it("should create a session with minimal data", async () => {
      const mockCreated: SessionWithExercises = {
        id: sessionId,
        owner_id: userId,
        title: "Test Session",
        planned_at: validDto.planned_at,
        status: "planned",
        visibility: "private",
        exercises: [],
      } as SessionWithExercises;

      mockSessionsRepo.createSession.mockResolvedValue(undefined);
      mockSessionsRepo.getSessionWithDetails.mockResolvedValue(mockCreated);

      const result = await sessionsService.createOne(userId, validDto);

      expect(result).toEqual(mockCreated);
      expect(mockSessionsRepo.createSession).toHaveBeenCalled();
      expect(mockAuditUtil.insertAudit).toHaveBeenCalled();
    });

    it("should create a session with exercises", async () => {
      const dtoWithExercises: CreateSessionDTO = {
        ...validDto,
        exercises: [
          {
            order: 1,
            exercise_id: "exercise-1",
            planned: {
              sets: 3,
              reps: 10,
              load: 50,
            },
          },
        ],
      };

      const mockCreated: SessionWithExercises = {
        id: sessionId,
        owner_id: userId,
        title: "Test Session",
        planned_at: validDto.planned_at,
        status: "planned",
        visibility: "private",
        exercises: [],
      } as SessionWithExercises;

      mockSessionsRepo.createSession.mockResolvedValue(undefined);
      mockSessionsRepo.replaceSessionExercises.mockResolvedValue(undefined);
      mockSessionsRepo.getSessionWithDetails.mockResolvedValue(mockCreated);
      mockSessionsRepo.refreshSessionSummary.mockResolvedValue(undefined);

      const result = await sessionsService.createOne(userId, dtoWithExercises);

      expect(result).toEqual(mockCreated);
      expect(mockSessionsRepo.replaceSessionExercises).toHaveBeenCalled();
    });

    it("should validate plan exists when plan_id provided", async () => {
      const dtoWithPlan: CreateSessionDTO = {
        ...validDto,
        plan_id: "plan-123",
      };

      const mockCreated: SessionWithExercises = {
        id: sessionId,
        owner_id: userId,
        plan_id: "plan-123",
        title: "Test Session",
        planned_at: validDto.planned_at,
        status: "planned",
        visibility: "private",
        exercises: [],
      } as SessionWithExercises;

      mockSessionsRepo.createSession.mockResolvedValue(undefined);
      mockSessionsRepo.getSessionWithDetails.mockResolvedValue(mockCreated);
      mockPlansService.recomputeProgress.mockResolvedValue(undefined);

      await sessionsService.createOne(userId, dtoWithPlan);

      expect(mockPlansService.recomputeProgress).toHaveBeenCalledWith(userId, "plan-123");
    });

    it("should throw error when session creation fails", async () => {
      mockSessionsRepo.createSession.mockResolvedValue(undefined);
      mockSessionsRepo.getSessionWithDetails.mockResolvedValue(null);

      await expect(sessionsService.createOne(userId, validDto)).rejects.toThrow(HttpError);
      await expect(sessionsService.createOne(userId, validDto)).rejects.toThrow(
        "SESSION_CREATE_FAILED",
      );
    });

    it("should validate exercise order", async () => {
      const dtoWithInvalidOrder: CreateSessionDTO = {
        ...validDto,
        exercises: [
          {
            order: 0, // Invalid: must be >= 1
            exercise_id: "exercise-1",
          },
        ],
      };

      await expect(sessionsService.createOne(userId, dtoWithInvalidOrder)).rejects.toThrow(
        HttpError,
      );
    });

    it("should validate duplicate exercise orders", async () => {
      const dtoWithDuplicateOrder: CreateSessionDTO = {
        ...validDto,
        exercises: [
          {
            order: 1,
            exercise_id: "exercise-1",
          },
          {
            order: 1, // Duplicate
            exercise_id: "exercise-2",
          },
        ],
      };

      await expect(sessionsService.createOne(userId, dtoWithDuplicateOrder)).rejects.toThrow(
        HttpError,
      );
    });

    it("should validate negative values in exercise attributes", async () => {
      const dtoWithNegative: CreateSessionDTO = {
        ...validDto,
        exercises: [
          {
            order: 1,
            exercise_id: "exercise-1",
            planned: {
              sets: -1, // Invalid: cannot be negative
            },
          },
        ],
      };

      await expect(sessionsService.createOne(userId, dtoWithNegative)).rejects.toThrow(HttpError);
    });

    it("should validate RPE range", async () => {
      const dtoWithInvalidRPE: CreateSessionDTO = {
        ...validDto,
        exercises: [
          {
            order: 1,
            exercise_id: "exercise-1",
            planned: {
              rpe: 11, // Invalid: must be 1-10
            },
          },
        ],
      };

      await expect(sessionsService.createOne(userId, dtoWithInvalidRPE)).rejects.toThrow(HttpError);
    });

    it("should validate interval format", async () => {
      const dtoWithInvalidInterval: CreateSessionDTO = {
        ...validDto,
        exercises: [
          {
            order: 1,
            exercise_id: "exercise-1",
            planned: {
              duration: "invalid", // Invalid: must be ISO 8601 or HH:MM:SS
            },
          },
        ],
      };

      await expect(sessionsService.createOne(userId, dtoWithInvalidInterval)).rejects.toThrow(
        HttpError,
      );
    });

    it("should handle empty title and notes", async () => {
      const dtoWithEmptyStrings: CreateSessionDTO = {
        title: "   ", // Whitespace only
        notes: "", // Empty string
        planned_at: new Date().toISOString(),
        visibility: "private",
      };

      const mockCreated: SessionWithExercises = {
        id: sessionId,
        owner_id: userId,
        title: null,
        planned_at: dtoWithEmptyStrings.planned_at,
        status: "planned",
        visibility: "private",
        exercises: [],
      } as SessionWithExercises;

      mockSessionsRepo.createSession.mockResolvedValue(undefined);
      mockSessionsRepo.getSessionWithDetails.mockResolvedValue(mockCreated);

      const result = await sessionsService.createOne(userId, dtoWithEmptyStrings);

      expect(result).toEqual(mockCreated);
    });

    it("should refresh summary when session is created with completed status", async () => {
      const mockCreated: SessionWithExercises = {
        id: sessionId,
        owner_id: userId,
        title: "Test Session",
        planned_at: validDto.planned_at,
        status: "completed", // Completed status
        visibility: "private",
        exercises: [],
      } as SessionWithExercises;

      mockSessionsRepo.createSession.mockResolvedValue(undefined);
      mockSessionsRepo.getSessionWithDetails.mockResolvedValue(mockCreated);
      mockSessionsRepo.refreshSessionSummary.mockResolvedValue(undefined);

      await sessionsService.createOne(userId, validDto);

      expect(mockSessionsRepo.refreshSessionSummary).toHaveBeenCalled();
    });

    it("should not refresh summary when no exercises and status is not completed", async () => {
      const mockCreated: SessionWithExercises = {
        id: sessionId,
        owner_id: userId,
        title: "Test Session",
        planned_at: validDto.planned_at,
        status: "planned", // Not completed
        visibility: "private",
        exercises: [],
      } as SessionWithExercises;

      mockSessionsRepo.createSession.mockResolvedValue(undefined);
      mockSessionsRepo.getSessionWithDetails.mockResolvedValue(mockCreated);

      await sessionsService.createOne(userId, validDto);

      expect(mockSessionsRepo.refreshSessionSummary).not.toHaveBeenCalled();
    });
  });

  describe("updateOne", () => {
    const existingSession: Session = {
      id: sessionId,
      owner_id: userId,
      title: "Existing Session",
      planned_at: new Date().toISOString(),
      status: "planned",
      visibility: "private",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it("should update session title", async () => {
      const updateDto: UpdateSessionDTO = {
        title: "Updated Title",
      };

      const mockUpdated: SessionWithExercises = {
        ...existingSession,
        title: "Updated Title",
        exercises: [],
      } as SessionWithExercises;

      mockSessionsRepo.getSessionById.mockResolvedValue(existingSession);
      mockSessionsRepo.updateSession.mockResolvedValue(1);
      mockSessionsRepo.getSessionWithDetails.mockResolvedValue(mockUpdated);

      const result = await sessionsService.updateOne(userId, sessionId, updateDto);

      expect(result.title).toBe("Updated Title");
      expect(mockSessionsRepo.updateSession).toHaveBeenCalled();
    });

    it("should throw 404 when session not found", async () => {
      mockSessionsRepo.getSessionById.mockResolvedValue(null);

      await expect(
        sessionsService.updateOne(userId, sessionId, { title: "New Title" }),
      ).rejects.toThrow(HttpError);
      await expect(
        sessionsService.updateOne(userId, sessionId, { title: "New Title" }),
      ).rejects.toThrow("SESSION_NOT_FOUND");
    });

    it("should validate status transitions", async () => {
      const completedSession: Session = {
        ...existingSession,
        status: "completed",
      };

      mockSessionsRepo.getSessionById.mockResolvedValue(completedSession);

      // Cannot transition from completed to any other status
      await expect(
        sessionsService.updateOne(userId, sessionId, { status: "planned" }),
      ).rejects.toThrow(HttpError);
      await expect(
        sessionsService.updateOne(userId, sessionId, { status: "planned" }),
      ).rejects.toThrow("Invalid status transition");
    });

    it("should allow valid status transition from planned to in_progress", async () => {
      const mockUpdated: SessionWithExercises = {
        ...existingSession,
        status: "in_progress",
        started_at: new Date().toISOString(),
        exercises: [],
      } as SessionWithExercises;

      mockSessionsRepo.getSessionById.mockResolvedValue(existingSession);
      mockSessionsRepo.updateSession.mockResolvedValue(1);
      mockSessionsRepo.getSessionWithDetails.mockResolvedValue(mockUpdated);

      const result = await sessionsService.updateOne(userId, sessionId, {
        status: "in_progress",
      });

      expect(result.status).toBe("in_progress");
    });

    it("should mark and schedule gamification reconciliation when status changes to completed", async () => {
      const inProgressSession: Session = {
        ...existingSession,
        status: "in_progress",
        started_at: new Date().toISOString(),
      };

      const mockUpdated: SessionWithExercises = {
        ...inProgressSession,
        status: "completed",
        completed_at: new Date().toISOString(),
        exercises: [],
      } as SessionWithExercises;

      mockSessionsRepo.getSessionById.mockResolvedValue(inProgressSession);
      mockSessionsRepo.updateSession.mockResolvedValue(1);
      mockSessionsRepo.getSessionWithDetails.mockResolvedValue(mockUpdated);

      await sessionsService.updateOne(userId, sessionId, { status: "completed" });

      expect(mockGamificationProjection.markGamificationStale).toHaveBeenCalledWith(
        userId,
        false,
        expect.anything(),
      );
      expect(mockGamificationProjection.scheduleGamificationReconciliation).toHaveBeenCalledWith(
        userId,
        sessionId,
        false,
      );
    });

    it("forces a full gamification rebuild when a corrected session is recompleted", async () => {
      const correctedSession: Session = {
        ...existingSession,
        status: "in_progress",
        started_at: new Date().toISOString(),
        gamification_rebuild_required: true,
      };

      const mockUpdated: SessionWithExercises = {
        ...correctedSession,
        status: "completed",
        completed_at: "2026-09-23T12:00:00.000Z",
        exercises: [],
      } as SessionWithExercises;

      mockSessionsRepo.getSessionById.mockResolvedValue(correctedSession);
      mockSessionsRepo.updateSession.mockResolvedValue(1);
      mockSessionsRepo.getSessionWithDetails.mockResolvedValue(mockUpdated);

      await sessionsService.updateOne(userId, sessionId, {
        status: "completed",
        completed_at: "2026-09-23T12:00:00.000Z",
      });

      expect(mockGamificationProjection.markGamificationStale).toHaveBeenCalledWith(
        userId,
        true,
        expect.anything(),
      );
      expect(mockGamificationProjection.scheduleGamificationReconciliation).toHaveBeenCalledWith(
        userId,
        sessionId,
        true,
      );
    });

    it("publishes a session when completion makes it feed-visible", async () => {
      const inProgressSession: Session = {
        ...existingSession,
        status: "in_progress",
        visibility: "public",
        started_at: new Date().toISOString(),
      };

      const mockUpdated: SessionWithExercises = {
        ...inProgressSession,
        status: "completed",
        completed_at: new Date().toISOString(),
        exercises: [],
      } as SessionWithExercises;

      mockSessionsRepo.getSessionById.mockResolvedValue(inProgressSession);
      mockSessionsRepo.updateSession.mockResolvedValue(1);
      mockSessionsRepo.getSessionWithDetails.mockResolvedValue(mockUpdated);
      mockPublicationService.reconcileSessionPublication.mockResolvedValue(undefined);

      await sessionsService.updateOne(userId, sessionId, { status: "completed" });

      expect(mockPublicationService.reconcileSessionPublication).toHaveBeenCalledWith(
        userId,
        sessionId,
        "completed",
        "public",
      );
    });

    it("publishes a completed session when visibility changes to followers", async () => {
      const completedPrivateSession: Session = {
        ...existingSession,
        status: "completed",
        visibility: "private",
        completed_at: new Date().toISOString(),
        points: 100,
      };

      const mockUpdated: SessionWithExercises = {
        ...completedPrivateSession,
        visibility: "followers",
        exercises: [],
      } as SessionWithExercises;

      mockSessionsRepo.getSessionById.mockResolvedValue(completedPrivateSession);
      mockSessionsRepo.updateSession.mockResolvedValue(1);
      mockSessionsRepo.getSessionWithDetails.mockResolvedValue(mockUpdated);
      mockPublicationService.reconcileSessionPublication.mockResolvedValue(undefined);

      await sessionsService.updateOne(userId, sessionId, { visibility: "followers" });

      expect(mockPublicationService.reconcileSessionPublication).toHaveBeenCalledWith(
        userId,
        sessionId,
        "completed",
        "followers",
      );
    });



    it("retires feed publication when a completed public session becomes private", async () => {
      const completedPublicSession: Session = {
        ...existingSession,
        status: "completed",
        visibility: "public",
        completed_at: new Date().toISOString(),
        points: 100,
      };

      const mockUpdated: SessionWithExercises = {
        ...completedPublicSession,
        visibility: "private",
        exercises: [],
      } as SessionWithExercises;

      mockSessionsRepo.getSessionById.mockResolvedValue(completedPublicSession);
      mockSessionsRepo.updateSession.mockResolvedValue(1);
      mockSessionsRepo.getSessionWithDetails.mockResolvedValue(mockUpdated);
      mockPublicationService.reconcileSessionPublication.mockResolvedValue(undefined);

      await sessionsService.updateOne(userId, sessionId, { visibility: "private" });

      expect(mockPublicationService.reconcileSessionPublication).toHaveBeenCalledWith(
        userId,
        sessionId,
        "completed",
        "private",
      );
    });

    it("should validate calories as non-negative integer", async () => {
      mockSessionsRepo.getSessionById.mockResolvedValue(existingSession);

      await expect(sessionsService.updateOne(userId, sessionId, { calories: -1 })).rejects.toThrow(
        HttpError,
      );
    });

    it("should handle status transition to canceled", async () => {
      const mockUpdated: SessionWithExercises = {
        ...existingSession,
        status: "canceled",
        deleted_at: new Date().toISOString(),
        exercises: [],
      } as SessionWithExercises;

      mockSessionsRepo.getSessionById.mockResolvedValue(existingSession);
      mockSessionsRepo.updateSession.mockResolvedValue(1);
      mockSessionsRepo.getSessionWithDetails.mockResolvedValue(mockUpdated);

      const result = await sessionsService.updateOne(userId, sessionId, { status: "canceled" });

      expect(result.status).toBe("canceled");
      expect(mockSessionsRepo.getSessionWithDetails).toHaveBeenCalledWith(sessionId, userId, {
        includeDeleted: true,
      });
    });

    it("should handle status transition to completed with existing completed_at", async () => {
      const mockUpdated: SessionWithExercises = {
        ...existingSession,
        status: "completed",
        completed_at: "2024-01-01T00:00:00Z", // Already set
        exercises: [],
      } as SessionWithExercises;

      mockSessionsRepo.getSessionById.mockResolvedValue(existingSession);
      mockSessionsRepo.updateSession.mockResolvedValue(1);
      mockSessionsRepo.getSessionWithDetails.mockResolvedValue(mockUpdated);

      await sessionsService.updateOne(userId, sessionId, {
        status: "completed",
        completed_at: "2024-01-01T00:00:00Z",
      });

      expect(mockGamificationProjection.markGamificationStale).toHaveBeenCalledWith(
        userId,
        false,
        expect.anything(),
      );
      expect(mockGamificationProjection.scheduleGamificationReconciliation).toHaveBeenCalledWith(
        userId,
        sessionId,
        false,
      );
    });

    it("should handle status transition to in_progress with existing started_at", async () => {
      const mockUpdated: SessionWithExercises = {
        ...existingSession,
        status: "in_progress",
        started_at: "2024-01-01T00:00:00Z", // Already set
        exercises: [],
      } as SessionWithExercises;

      mockSessionsRepo.getSessionById.mockResolvedValue(existingSession);
      mockSessionsRepo.updateSession.mockResolvedValue(1);
      mockSessionsRepo.getSessionWithDetails.mockResolvedValue(mockUpdated);

      const result = await sessionsService.updateOne(userId, sessionId, {
        status: "in_progress",
        started_at: "2024-01-01T00:00:00Z",
      });

      expect(result.status).toBe("in_progress");
    });

    it("should handle empty title and notes in update", async () => {
      const updateDto: UpdateSessionDTO = {
        title: "   ", // Whitespace only
        notes: "", // Empty string
      };

      const mockUpdated: SessionWithExercises = {
        ...existingSession,
        title: null,
        notes: null,
        exercises: [],
      } as SessionWithExercises;

      mockSessionsRepo.getSessionById.mockResolvedValue(existingSession);
      mockSessionsRepo.updateSession.mockResolvedValue(1);
      mockSessionsRepo.getSessionWithDetails.mockResolvedValue(mockUpdated);

      const result = await sessionsService.updateOne(userId, sessionId, updateDto);

      expect(result.title).toBeNull();
      expect(result.notes).toBeNull();
    });

    it("should handle plan_id changes", async () => {
      const sessionWithPlan: Session = {
        ...existingSession,
        plan_id: "plan-1",
      };

      const mockUpdated: SessionWithExercises = {
        ...sessionWithPlan,
        plan_id: "plan-2",
        exercises: [],
      } as SessionWithExercises;

      mockSessionsRepo.getSessionById.mockResolvedValue(sessionWithPlan);
      mockSessionsRepo.updateSession.mockResolvedValue(1);
      mockSessionsRepo.getSessionWithDetails.mockResolvedValue(mockUpdated);
      mockPlansService.recomputeProgress.mockResolvedValue(undefined);

      await sessionsService.updateOne(userId, sessionId, { plan_id: "plan-2" });

      // Should recompute progress for both old and new plan
      expect(mockPlansService.recomputeProgress).toHaveBeenCalledWith(userId, "plan-1");
      expect(mockPlansService.recomputeProgress).toHaveBeenCalledWith(userId, "plan-2");
    });

    it("should refresh summary when exercises are touched", async () => {
      const updateDto: UpdateSessionDTO = {
        exercises: [
          {
            order: 1,
            exercise_id: "exercise-1",
          },
        ],
      };

      const mockUpdated: SessionWithExercises = {
        ...existingSession,
        exercises: [],
      } as SessionWithExercises;

      mockSessionsRepo.getSessionById.mockResolvedValue(existingSession);
      mockSessionsRepo.updateSession.mockResolvedValue(1);
      mockSessionsRepo.replaceSessionExercises.mockResolvedValue(undefined);
      mockSessionsRepo.getSessionWithDetails.mockResolvedValue(mockUpdated);
      mockSessionsRepo.refreshSessionSummary.mockResolvedValue(undefined);

      await sessionsService.updateOne(userId, sessionId, updateDto);

      expect(mockSessionsRepo.refreshSessionSummary).toHaveBeenCalled();
    });

    it("does not rescore a completed session for metadata-only edits", async () => {
      const completedSession: Session = {
        ...existingSession,
        status: "completed",
        points: null, // Points are null
      };

      const mockUpdated: SessionWithExercises = {
        ...completedSession,
        exercises: [],
      } as SessionWithExercises;

      mockSessionsRepo.getSessionById.mockResolvedValue(completedSession);
      mockSessionsRepo.updateSession.mockResolvedValue(1);
      mockSessionsRepo.getSessionWithDetails.mockResolvedValue(mockUpdated);

      await sessionsService.updateOne(userId, sessionId, { title: "Updated" });

      expect(mockGamificationProjection.markGamificationStale).not.toHaveBeenCalled();
      expect(mockGamificationProjection.scheduleGamificationReconciliation).not.toHaveBeenCalled();
    });

    it("requires reopen before correcting a completed workout", async () => {
      const completedSession: Session = {
        ...existingSession,
        status: "completed",
        completed_at: new Date().toISOString(),
        points: 100,
      };
      mockSessionsRepo.getSessionById.mockResolvedValue(completedSession);

      await expect(
        sessionsService.updateOne(userId, sessionId, { calories: 450 }),
      ).rejects.toThrow("Completed workout records must be reopened before correction.");
    });

    it("should handle update when affected rows is 0", async () => {
      mockSessionsRepo.getSessionById.mockResolvedValue(existingSession);
      mockSessionsRepo.updateSession.mockResolvedValue(0); // No rows affected

      await expect(
        sessionsService.updateOne(userId, sessionId, { title: "Updated" }),
      ).rejects.toThrow(HttpError);
      await expect(
        sessionsService.updateOne(userId, sessionId, { title: "Updated" }),
      ).rejects.toThrow("SESSION_NOT_FOUND");
    });
  });

  describe("reopenOne", () => {
    it("reopens a completed session and forces full gamification reconciliation", async () => {
      const completed: Session = {
        id: sessionId,
        owner_id: userId,
        title: "Recorded workout",
        planned_at: new Date().toISOString(),
        status: "completed",
        visibility: "private",
        completed_at: "2026-09-23T12:00:00.000Z",
        points: 120,
      };
      const reopened: SessionWithExercises = {
        ...completed,
        status: "in_progress",
        completed_at: null,
        points: null,
        gamification_rebuild_required: true,
        exercises: [],
      } as SessionWithExercises;

      mockSessionsRepo.getSessionById.mockResolvedValue(completed);
      mockSessionsRepo.updateSession.mockResolvedValue(1);
      mockSessionsRepo.getSessionWithDetails.mockResolvedValue(reopened);

      const result = await sessionsService.reopenOne(userId, sessionId);

      expect(result.status).toBe("in_progress");
      expect(mockSessionsRepo.updateSession).toHaveBeenCalledWith(
        sessionId,
        userId,
        expect.objectContaining({
          status: "in_progress",
          completed_at: null,
          points: null,
          gamification_rebuild_required: true,
        }),
        expect.anything(),
      );
      expect(mockGamificationProjection.markGamificationStale).toHaveBeenCalledWith(
        userId,
        true,
        expect.anything(),
      );
      expect(mockGamificationProjection.scheduleGamificationReconciliation).toHaveBeenCalledWith(
        userId,
        undefined,
        true,
      );
    });

    it("rejects reopen for a session that is not completed", async () => {
      mockSessionsRepo.getSessionById.mockResolvedValue({
        id: sessionId,
        owner_id: userId,
        planned_at: new Date().toISOString(),
        status: "in_progress",
        visibility: "private",
      });

      await expect(sessionsService.reopenOne(userId, sessionId)).rejects.toThrow(
        "Only completed sessions can be reopened.",
      );
    });
  });

  describe("cloneOne", () => {
    const sourceSession: SessionWithExercises = {
      id: "source-123",
      owner_id: userId,
      title: "Source Session",
      planned_at: new Date().toISOString(),
      status: "planned",
      visibility: "private",
      exercises: [
        {
          id: "exercise-1",
          order_index: 1,
          exercise_id: "ex-1",
          notes: "Test exercise",
          planned: {
            sets: 3,
            reps: 10,
          },
        } as SessionExercise,
      ],
    } as SessionWithExercises;

    it("should clone a session with default settings", async () => {
      const cloneDto: CloneSessionDTO = {};

      const mockCloned: SessionWithExercises = {
        id: sessionId,
        owner_id: userId,
        title: "Source Session",
        planned_at: sourceSession.planned_at,
        status: "planned",
        visibility: "private",
        exercises: [],
      } as SessionWithExercises;

      mockSessionsRepo.getSessionWithDetails.mockResolvedValueOnce(sourceSession);
      mockSessionsRepo.createSession.mockResolvedValue(undefined);
      mockSessionsRepo.getSessionWithDetails.mockResolvedValueOnce(mockCloned);

      const result = await sessionsService.cloneOne(userId, "source-123", cloneDto);

      expect(result).toEqual(mockCloned);
      expect(mockSessionsRepo.createSession).toHaveBeenCalled();
    });

    it("should clone with date offset", async () => {
      const cloneDto: CloneSessionDTO = {
        date_offset_days: 7,
      };

      const mockCloned: SessionWithExercises = {
        id: sessionId,
        owner_id: userId,
        title: "Source Session",
        planned_at: new Date(
          new Date(sourceSession.planned_at).getTime() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        status: "planned",
        visibility: "private",
        exercises: [],
      } as SessionWithExercises;

      mockSessionsRepo.getSessionWithDetails.mockResolvedValueOnce(sourceSession);
      mockSessionsRepo.createSession.mockResolvedValue(undefined);
      mockSessionsRepo.getSessionWithDetails.mockResolvedValueOnce(mockCloned);

      const result = await sessionsService.cloneOne(userId, "source-123", cloneDto);

      expect(result).toEqual(mockCloned);
    });

    it("should throw 404 when source session not found", async () => {
      mockSessionsRepo.getSessionWithDetails.mockResolvedValue(null);

      await expect(sessionsService.cloneOne(userId, "source-123", {})).rejects.toThrow(HttpError);
    });
  });

  describe("applyRecurrence", () => {
    const sourceSession: SessionWithExercises = {
      id: "source-123",
      owner_id: userId,
      title: "Source Session",
      planned_at: new Date().toISOString(),
      status: "planned",
      visibility: "private",
      exercises: [],
    } as SessionWithExercises;

    it("should create recurring sessions", async () => {
      const recurrenceDto: SessionRecurrenceDTO = {
        occurrences: 3,
        offset_days: 7,
      };

      const mockCloned: SessionWithExercises = {
        id: sessionId,
        owner_id: userId,
        title: "Source Session",
        planned_at: new Date().toISOString(),
        status: "planned",
        visibility: "private",
        exercises: [],
      } as SessionWithExercises;

      mockSessionsRepo.getSessionWithDetails.mockResolvedValueOnce(sourceSession);
      mockSessionsRepo.sessionsExistAtDates.mockResolvedValue([]);
      mockSessionsRepo.createSession.mockResolvedValue(undefined);
      mockSessionsRepo.getSessionWithDetails.mockResolvedValue(mockCloned);
      mockSessionsRepo.refreshSessionSummary.mockResolvedValue(undefined);

      const result = await sessionsService.applyRecurrence(userId, "source-123", recurrenceDto);

      expect(result).toHaveLength(3);
      expect(mockSessionsRepo.createSession).toHaveBeenCalledTimes(3);
    });

    it("should validate occurrences range", async () => {
      mockSessionsRepo.getSessionWithDetails.mockResolvedValueOnce(sourceSession);

      await expect(
        sessionsService.applyRecurrence(userId, "source-123", {
          occurrences: 0,
          offset_days: 7,
        }),
      ).rejects.toThrow(HttpError);

      await expect(
        sessionsService.applyRecurrence(userId, "source-123", {
          occurrences: 53,
          offset_days: 7,
        }),
      ).rejects.toThrow(HttpError);
    });

    it("should validate offset_days range", async () => {
      mockSessionsRepo.getSessionWithDetails.mockResolvedValueOnce(sourceSession);

      await expect(
        sessionsService.applyRecurrence(userId, "source-123", {
          occurrences: 3,
          offset_days: 0,
        }),
      ).rejects.toThrow(HttpError);

      await expect(
        sessionsService.applyRecurrence(userId, "source-123", {
          occurrences: 3,
          offset_days: 181,
        }),
      ).rejects.toThrow(HttpError);
    });

    it("should throw error when source session is canceled", async () => {
      const canceledSession: SessionWithExercises = {
        ...sourceSession,
        status: "canceled",
      };

      // Clear any previous mock implementations
      mockSessionsRepo.getSessionWithDetails.mockReset();
      // Mock should return canceled session for the source check
      mockSessionsRepo.getSessionWithDetails.mockResolvedValue(canceledSession);

      await expect(
        sessionsService.applyRecurrence(userId, "source-123", {
          occurrences: 3,
          offset_days: 7,
        }),
      ).rejects.toThrow("SESSION_INVALID_SOURCE");

      // Reset mocks for second call
      mockSessionsRepo.getSessionWithDetails.mockReset();
      mockSessionsRepo.getSessionWithDetails.mockResolvedValue(canceledSession);

      await expect(
        sessionsService.applyRecurrence(userId, "source-123", {
          occurrences: 3,
          offset_days: 7,
        }),
      ).rejects.toThrow("SESSION_INVALID_SOURCE");
    });

    it("should throw error when conflicts exist", async () => {
      mockSessionsRepo.getSessionWithDetails.mockResolvedValueOnce(sourceSession);
      mockSessionsRepo.sessionsExistAtDates.mockResolvedValue(["2024-01-01T00:00:00Z"]);

      await expect(
        sessionsService.applyRecurrence(userId, "source-123", {
          occurrences: 3,
          offset_days: 7,
        }),
      ).rejects.toThrow(HttpError);
    });
  });

  describe("cancelOne", () => {
    const existingSession: Session = {
      id: sessionId,
      owner_id: userId,
      title: "Test Session",
      planned_at: new Date().toISOString(),
      status: "planned",
      visibility: "private",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it("should cancel a planned session", async () => {
      mockSessionsRepo.getSessionById.mockResolvedValue(existingSession);
      mockSessionsRepo.cancelSession.mockResolvedValue(1);
      mockSessionsRepo.refreshSessionSummary.mockResolvedValue(undefined);

      await sessionsService.cancelOne(userId, sessionId);

      expect(mockSessionsRepo.cancelSession).toHaveBeenCalledWith(sessionId, userId);
      expect(mockAuditUtil.insertAudit).toHaveBeenCalled();
    });

    it("should throw 404 when session not found", async () => {
      mockSessionsRepo.getSessionById.mockResolvedValue(null);

      await expect(sessionsService.cancelOne(userId, sessionId)).rejects.toThrow(HttpError);
    });

    it("should throw error when trying to cancel completed session", async () => {
      const completedSession: Session = {
        ...existingSession,
        status: "completed",
      };

      mockSessionsRepo.getSessionById.mockResolvedValue(completedSession);

      await expect(sessionsService.cancelOne(userId, sessionId)).rejects.toThrow(HttpError);
      await expect(sessionsService.cancelOne(userId, sessionId)).rejects.toThrow(
        "Completed sessions cannot be canceled",
      );
    });
  });
});
