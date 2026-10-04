import * as auditUtil from "../../../../apps/backend/src/modules/common/audit.util.js";
import { db } from "../../../../apps/backend/src/db/connection.js";
import { logger } from "../../../../apps/backend/src/config/logger.js";
import crypto from "crypto";
import {
  flushAuditOutbox,
  persistAuditOutbox,
} from "../../../../apps/backend/src/modules/common/audit-outbox.service.js";

jest.mock("../../../../apps/backend/src/db/connection.js");
jest.mock("../../../../apps/backend/src/config/logger.js", () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));
jest.mock("../../../../apps/backend/src/modules/common/audit-outbox.service.js", () => ({
  flushAuditOutbox: jest.fn().mockResolvedValue(0),
  persistAuditOutbox: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("crypto", () => {
  const actualCrypto = jest.requireActual<typeof import("crypto")>("crypto");

  return {
    ...actualCrypto,
    randomUUID: jest.fn(() => "uuid-123"),
  };
});

const mockedDb = db as jest.MockedFunction<typeof db>;
const mockedLogger = logger as jest.Mocked<typeof logger>;
const mockedFlushAuditOutbox = jest.mocked(flushAuditOutbox);
const mockedPersistAuditOutbox = jest.mocked(persistAuditOutbox);

describe("audit.util", () => {
  let mockQueryBuilder: {
    insert: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockQueryBuilder = {
      insert: jest.fn().mockResolvedValue([{ id: "uuid-123" }]),
    };

    mockedDb.mockReturnValue(mockQueryBuilder as never);
  });

  describe("insertAudit", () => {
    it("should insert audit log", async () => {
      const payload = {
        actorUserId: "11111111-1111-4111-8111-111111111111",
        entityType: "session",
        action: "create",
        entityId: "session-123",
        outcome: "success",
        requestId: "req-123",
        metadata: { key: "value" },
      };

      await auditUtil.insertAudit(payload);

      expect(mockedDb).toHaveBeenCalledWith("audit_log");
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_user_id: "11111111-1111-4111-8111-111111111111",
          entity_type: "session",
          action: "create",
          entity_id: "session-123",
          outcome: "success",
          request_id: "req-123",
          metadata: { key: "value" },
          created_at: expect.any(String),
        }),
      );
      expect(mockedFlushAuditOutbox).toHaveBeenCalledWith(25);
    });

    it("should normalize invalid actor IDs to null", async () => {
      await auditUtil.insertAudit({
        actorUserId: "not-a-uuid",
        entityType: "session",
        action: "create",
      });

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_user_id: null,
          entity_type: "session",
        }),
      );
    });

    it("should use default values", async () => {
      const payload = {
        action: "create",
        entityType: "session",
      };

      await auditUtil.insertAudit(payload);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_user_id: null,
          entity_id: null,
          outcome: "success",
          request_id: null,
          metadata: {},
        }),
      );
    });

    it("should handle insert errors", async () => {
      const payload = {
        action: "create",
        entityType: "session",
      };

      const error = new Error("Database error");
      mockQueryBuilder.insert.mockRejectedValue(error);

      await auditUtil.insertAudit(payload);

      expect(mockedLogger.error).toHaveBeenCalledWith(
        { err: error, action: "create" },
        "[AUDIT] insert failed; persisting to outbox",
      );
      expect(mockedPersistAuditOutbox).toHaveBeenCalledWith(
        expect.objectContaining({
          entity_type: "session",
          action: "create",
        }),
        error,
      );
    });
  });

  describe("logAudit", () => {
    it("should normalize an invalid actor ID while logging all fields", async () => {
      const payload = {
        action: "update",
        entityType: "user",
        entityId: "11111111-1111-4111-8111-111111111111",
        userId: "actor-123",
        outcome: "success",
        requestId: "req-123",
        metadata: { key: "value" },
      };

      await auditUtil.logAudit(payload);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_user_id: null,
          entity_type: "user",
          action: "update",
          entity_id: "11111111-1111-4111-8111-111111111111",
          outcome: "success",
          request_id: "req-123",
          metadata: { key: "value" },
        }),
      );
    });

    it("should use default values", async () => {
      const payload = {
        action: "delete",
        entityType: "session",
      };

      await auditUtil.logAudit(payload);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_user_id: null,
          entity_id: null,
          outcome: "success",
          request_id: null,
          metadata: {},
        }),
      );
    });

    it("should handle null values", async () => {
      const payload = {
        action: "view",
        entityType: "session",
        entityId: null,
        userId: null,
        requestId: null,
      };

      await auditUtil.logAudit(payload);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_user_id: null,
          entity_id: null,
          request_id: null,
        }),
      );
    });
  });
});
