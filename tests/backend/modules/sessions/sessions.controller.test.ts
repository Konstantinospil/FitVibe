import type { Request, Response } from "express";
import * as sessionsController from "../../../../apps/backend/src/modules/sessions/sessions.controller.js";
import * as sessionsService from "../../../../apps/backend/src/modules/sessions/sessions.service.js";
import * as estimationService from "../../../../apps/backend/src/modules/sessions/sessions.estimation.service.js";
import * as idempotencyService from "../../../../apps/backend/src/modules/common/idempotency.service.js";
import { HttpError } from "../../../../apps/backend/src/utils/http.js";

// Mock dependencies
jest.mock("../../../../apps/backend/src/modules/sessions/sessions.service.js");
jest.mock("../../../../apps/backend/src/modules/sessions/sessions.estimation.service.js");
jest.mock("../../../../apps/backend/src/modules/common/idempotency.service.js");

const mockSessionsService = jest.mocked(sessionsService);
const mockEstimationService = jest.mocked(estimationService);
const mockIdempotencyService = jest.mocked(idempotencyService);

describe("Sessions Controller", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  const userId = "user-123";
  const sessionId = "session-123";

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      user: { sub: userId, role: "athlete" },
      body: {},
      query: {},
      params: {},
      headers: {},
      get: jest.fn(),
      method: "GET",
      baseUrl: "/api/v1",
      route: { path: "/sessions" },
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };
  });

  describe("listSessionsHandler", () => {
    it("should list sessions successfully", async () => {
      const mockResult = {
        data: [],
        total: 0,
        limit: 10,
        offset: 0,
      };

      mockSessionsService.getAll.mockResolvedValue(mockResult);

      await sessionsController.listSessionsHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockResponse.json).toHaveBeenCalledWith(mockResult);
    });
  });

  describe("getSessionHandler", () => {
    it("should get session successfully", async () => {
      const mockSession = {
        id: sessionId,
        owner_id: userId,
        title: "Test Session",
        planned_at: new Date().toISOString(),
        status: "planned",
        visibility: "private",
        exercises: [],
      };

      mockRequest.params = { id: sessionId };
      mockSessionsService.getOne.mockResolvedValue(mockSession as never);

      await sessionsController.getSessionHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(mockSession);
    });
  });

  describe("getSessionEstimateHandler", () => {
    it("returns the current athlete-specific session estimate", async () => {
      const estimate = {
        activeDurationSec: 600,
        restDurationSec: 120,
        minimumTotalDurationSec: 720,
        normalizedMet: 6.5,
        estimatedKcalPerMin: 7.96,
        estimatedActiveKcal: 79.6,
        complete: true,
        missingInputs: [],
      };
      mockRequest.params = { id: sessionId };
      mockEstimationService.getSessionEstimate.mockResolvedValue(estimate);

      await sessionsController.getSessionEstimateHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockEstimationService.getSessionEstimate).toHaveBeenCalledWith(userId, sessionId);
      expect(mockResponse.json).toHaveBeenCalledWith(estimate);
    });

    it("returns 401 when estimate is requested without authentication", async () => {
      mockRequest.user = undefined;
      mockRequest.params = { id: sessionId };

      await sessionsController.getSessionEstimateHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockEstimationService.getSessionEstimate).not.toHaveBeenCalled();
    });
  });

  describe("createSessionHandler", () => {
    it("should create session successfully", async () => {
      const sessionData = {
        title: "Test Session",
        planned_at: new Date().toISOString(),
      };

      const mockSession = {
        id: sessionId,
        owner_id: userId,
        ...sessionData,
        status: "planned",
        visibility: "private",
        exercises: [],
      };

      mockRequest.body = sessionData;
      mockRequest.method = "POST";
      mockSessionsService.createOne.mockResolvedValue(mockSession as never);

      await sessionsController.createSessionHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(mockSession);
    });

    it("should create session with idempotency key", async () => {
      const sessionData = {
        title: "Test Session",
        planned_at: new Date().toISOString(),
      };

      const mockSession = {
        id: sessionId,
        owner_id: userId,
        ...sessionData,
        status: "planned",
        visibility: "private",
        exercises: [],
      };

      mockRequest.body = sessionData;
      mockRequest.method = "POST";
      (mockRequest.get as jest.Mock).mockReturnValue("idempotency-key-123");
      mockIdempotencyService.resolveIdempotency.mockResolvedValue({
        type: "new",
        recordId: "record-123",
      });
      mockSessionsService.createOne.mockResolvedValue(mockSession as never);

      await sessionsController.createSessionHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockResponse.set).toHaveBeenCalledWith("Idempotency-Key", "idempotency-key-123");
      expect(mockIdempotencyService.persistIdempotencyResult).toHaveBeenCalledWith(
        "record-123",
        201,
        mockSession,
      );
    });

    it("should return 400 for invalid body", async () => {
      mockRequest.body = { title: "" }; // Invalid: empty title
      mockRequest.method = "POST";

      await sessionsController.createSessionHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockSessionsService.createOne).not.toHaveBeenCalled();
    });

    it("should return 401 when not authenticated", async () => {
      mockRequest.user = undefined;
      mockRequest.body = {
        title: "Test Session",
        planned_at: new Date().toISOString(),
      };

      await sessionsController.createSessionHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockSessionsService.createOne).not.toHaveBeenCalled();
    });
  });

  describe("updateSessionHandler", () => {
    it("should update session successfully", async () => {
      const updateData = {
        title: "Updated Session",
        status: "completed",
      };

      const mockUpdatedSession = {
        id: sessionId,
        owner_id: userId,
        title: "Updated Session",
        status: "completed",
        planned_at: new Date().toISOString(),
        visibility: "private",
        exercises: [],
      };

      mockRequest.params = { id: sessionId };
      mockRequest.body = updateData;
      mockSessionsService.updateOne.mockResolvedValue(mockUpdatedSession as never);

      await sessionsController.updateSessionHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockResponse.json).toHaveBeenCalledWith(mockUpdatedSession);
      expect(mockSessionsService.updateOne).toHaveBeenCalledWith(userId, sessionId, updateData);
    });

    it("should return 400 for invalid body", async () => {
      mockRequest.params = { id: sessionId };
      mockRequest.body = { title: "" }; // Invalid: empty title

      await sessionsController.updateSessionHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockSessionsService.updateOne).not.toHaveBeenCalled();
    });

    it("should return 400 when session ID missing", async () => {
      mockRequest.params = {};
      mockRequest.body = { title: "Updated" };

      await sessionsController.updateSessionHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockSessionsService.updateOne).not.toHaveBeenCalled();
    });

    it("should return 401 when not authenticated", async () => {
      mockRequest.user = undefined;
      mockRequest.params = { id: sessionId };
      mockRequest.body = { title: "Updated" };

      await sessionsController.updateSessionHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockSessionsService.updateOne).not.toHaveBeenCalled();
    });
  });

  describe("reopenSessionHandler", () => {
    it("reopens a completed session", async () => {
      const reopened = {
        id: sessionId,
        owner_id: userId,
        planned_at: new Date().toISOString(),
        status: "in_progress",
        visibility: "private",
        completed_at: null,
        points: null,
        exercises: [],
      };

      mockRequest.params = { id: sessionId };
      mockSessionsService.reopenOne.mockResolvedValue(reopened as never);

      await sessionsController.reopenSessionHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockSessionsService.reopenOne).toHaveBeenCalledWith(userId, sessionId);
      expect(mockResponse.json).toHaveBeenCalledWith(reopened);
    });

    it("returns 400 when session ID is missing", async () => {
      mockRequest.params = {};

      await sessionsController.reopenSessionHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockSessionsService.reopenOne).not.toHaveBeenCalled();
    });
  });

  describe("cloneSessionHandler", () => {
    it("should clone session successfully without idempotency", async () => {
      const mockClonedSession = {
        id: "session-456",
        owner_id: userId,
        title: "Cloned Session",
        planned_at: new Date().toISOString(),
        status: "planned",
        visibility: "private",
        exercises: [],
      };

      mockRequest.params = { id: sessionId };
      mockRequest.body = {};
      mockRequest.method = "POST";
      mockSessionsService.cloneOne.mockResolvedValue(mockClonedSession as never);

      await sessionsController.cloneSessionHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(mockClonedSession);
      expect(mockSessionsService.cloneOne).toHaveBeenCalledWith(userId, sessionId, {});
    });

    it("should clone session with idempotency key", async () => {
      const mockClonedSession = {
        id: "session-456",
        owner_id: userId,
        title: "Cloned Session",
        planned_at: new Date().toISOString(),
        status: "planned",
        visibility: "private",
        exercises: [],
      };

      mockRequest.params = { id: sessionId };
      mockRequest.body = { title: "Cloned Session" };
      mockRequest.method = "POST";
      (mockRequest.get as jest.Mock).mockReturnValue("idempotency-key-123");
      mockIdempotencyService.resolveIdempotency.mockResolvedValue({
        type: "new",
        recordId: "record-123",
      });
      mockSessionsService.cloneOne.mockResolvedValue(mockClonedSession as never);

      await sessionsController.cloneSessionHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockResponse.set).toHaveBeenCalledWith("Idempotency-Key", "idempotency-key-123");
      expect(mockIdempotencyService.persistIdempotencyResult).toHaveBeenCalledWith(
        "record-123",
        201,
        mockClonedSession,
      );
    });

    it("should return 400 for invalid body", async () => {
      mockRequest.params = { id: sessionId };
      mockRequest.body = { title: "" }; // Invalid: empty title
      mockRequest.method = "POST";

      await sessionsController.cloneSessionHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockSessionsService.cloneOne).not.toHaveBeenCalled();
    });

    it("should return 401 when not authenticated", async () => {
      mockRequest.user = undefined;
      mockRequest.params = { id: sessionId };
      mockRequest.body = {};

      await sessionsController.cloneSessionHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockSessionsService.cloneOne).not.toHaveBeenCalled();
    });
  });

  describe("applyRecurrenceHandler", () => {
    it("should apply recurrence successfully without idempotency", async () => {
      const mockSessions = [
        {
          id: "session-1",
          owner_id: userId,
          title: "Recurring Session 1",
          planned_at: new Date().toISOString(),
          status: "planned",
          visibility: "private",
          exercises: [],
        },
      ];

      mockRequest.params = { id: sessionId };
      mockRequest.body = { occurrences: 3, offset_days: 7 };
      mockRequest.method = "POST";
      mockSessionsService.applyRecurrence.mockResolvedValue(mockSessions as never);

      await sessionsController.applyRecurrenceHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({ sessions: mockSessions });
      expect(mockSessionsService.applyRecurrence).toHaveBeenCalledWith(
        userId,
        sessionId,
        expect.objectContaining({
          occurrences: 3,
          offset_days: 7,
        }),
      );
    });

    it("should apply recurrence with idempotency key", async () => {
      const mockSessions = [
        {
          id: "session-1",
          owner_id: userId,
          title: "Recurring Session 1",
          planned_at: new Date().toISOString(),
          status: "planned",
          visibility: "private",
          exercises: [],
        },
      ];

      mockRequest.params = { id: sessionId };
      mockRequest.body = { occurrences: 3, offset_days: 7 };
      mockRequest.method = "POST";
      (mockRequest.get as jest.Mock).mockReturnValue("idempotency-key-123");
      mockIdempotencyService.resolveIdempotency.mockResolvedValue({
        type: "new",
        recordId: "record-123",
      });
      mockSessionsService.applyRecurrence.mockResolvedValue(mockSessions as never);

      await sessionsController.applyRecurrenceHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockResponse.set).toHaveBeenCalledWith("Idempotency-Key", "idempotency-key-123");
      expect(mockIdempotencyService.persistIdempotencyResult).toHaveBeenCalledWith(
        "record-123",
        201,
        { sessions: mockSessions },
      );
    });

    it("should return 400 for invalid body", async () => {
      mockRequest.params = { id: sessionId };
      mockRequest.body = { occurrences: -1 }; // Invalid: negative occurrences
      mockRequest.method = "POST";

      await sessionsController.applyRecurrenceHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockSessionsService.applyRecurrence).not.toHaveBeenCalled();
    });

    it("should return 401 when not authenticated", async () => {
      mockRequest.user = undefined;
      mockRequest.params = { id: sessionId };
      mockRequest.body = { occurrences: 3, offset_days: 7 };

      await sessionsController.applyRecurrenceHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockSessionsService.applyRecurrence).not.toHaveBeenCalled();
    });
  });

  describe("deleteSessionHandler", () => {
    it("should delete session successfully", async () => {
      mockRequest.params = { id: sessionId };
      mockSessionsService.cancelOne.mockResolvedValue(undefined);

      await sessionsController.deleteSessionHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockResponse.send).toHaveBeenCalled();
      expect(mockSessionsService.cancelOne).toHaveBeenCalledWith(userId, sessionId);
    });

    it("should return 401 when not authenticated", async () => {
      mockRequest.user = undefined;
      mockRequest.params = { id: sessionId };

      await sessionsController.deleteSessionHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockSessionsService.cancelOne).not.toHaveBeenCalled();
    });
  });
});
