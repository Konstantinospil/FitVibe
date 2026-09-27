import type { Request, Response, NextFunction } from "express";
import type { JwtPayload } from "../../../../apps/backend/src/auth/auth.types.js";
import { requireRole, roleSatisfies } from "../../../../apps/backend/src/modules/common/rbac.middleware.js";

describe("rbac.middleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockRequest = {
      user: undefined,
    };

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe("requireRole", () => {
    it("should allow user with matching role (single role string)", () => {
      mockRequest.user = { sub: "user-123", role: "admin", sid: "session-123" };

      const middleware = requireRole("admin");
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it("should allow user with matching role (array of roles)", () => {
      mockRequest.user = { sub: "user-123", role: "coach", sid: "session-123" };

      const middleware = requireRole(["admin", "coach"]);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it("should allow admin role when multiple roles are allowed", () => {
      mockRequest.user = { sub: "user-123", role: "admin", sid: "session-123" };

      const middleware = requireRole(["admin", "coach", "support"]);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it("should allow coach role when included in allowed roles", () => {
      mockRequest.user = { sub: "user-123", role: "coach", sid: "session-123" };

      const middleware = requireRole(["admin", "coach"]);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it("should return 403 when user has different role", () => {
      mockRequest.user = { sub: "user-123", role: "athlete", sid: "session-123" };

      const middleware = requireRole("admin");
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Forbidden" });
    });

    it("should return 403 when user role not in allowed list", () => {
      mockRequest.user = { sub: "user-123", role: "athlete", sid: "session-123" };

      const middleware = requireRole(["admin", "coach"]);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Forbidden" });
    });

    it("should return 401 when user is undefined", () => {
      mockRequest.user = undefined;

      const middleware = requireRole("admin");
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Unauthorized" });
    });

    it("should return 401 when user is null", () => {
      mockRequest.user = null;

      const middleware = requireRole("admin");
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Unauthorized" });
    });

    it("should return 401 when user has no role property", () => {
      mockRequest.user = {
        sub: "user-123",
        sid: "session-123",
      } as unknown as JwtPayload;

      const middleware = requireRole("admin");
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Unauthorized" });
    });

    it("should return 401 when user role is null", () => {
      mockRequest.user = {
        sub: "user-123",
        role: null as unknown as string,
        sid: "session-123",
      } as unknown as JwtPayload;

      const middleware = requireRole("admin");
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Unauthorized" });
    });

    it("should return 401 when user role is undefined", () => {
      mockRequest.user = {
        sub: "user-123",
        role: undefined as unknown as string,
        sid: "session-123",
      } as unknown as JwtPayload;

      const middleware = requireRole("admin");
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Unauthorized" });
    });

    it("should handle single role in array format", () => {
      mockRequest.user = { sub: "user-123", role: "support", sid: "session-123" };

      const middleware = requireRole(["support"]);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it("should handle empty user object", () => {
      mockRequest.user = {} as unknown as JwtPayload;

      const middleware = requireRole("admin");
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Unauthorized" });
    });

    it("should be case sensitive for role matching", () => {
      mockRequest.user = { sub: "user-123", role: "Admin", sid: "session-123" };

      const middleware = requireRole("admin");
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Forbidden" });
    });

    it("should work with multiple different role checks", () => {
      const adminMiddleware = requireRole("admin");
      const coachMiddleware = requireRole("coach");

      mockRequest.user = { sub: "user-123", role: "admin", sid: "session-123" };
      adminMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();
      coachMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it("should allow user with role property and other properties", () => {
      mockRequest.user = {
        sub: "user-123",
        role: "admin",
        sid: "session-123",
      };

      const middleware = requireRole("admin");
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it("should reject when role is empty string", () => {
      mockRequest.user = { sub: "user-123", role: "", sid: "session-123" };

      const middleware = requireRole("admin");
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Unauthorized" });
    });

    it("should let superadmin inherit normal admin authorization", () => {
      expect(roleSatisfies("superadmin", "admin")).toBe(true);
      mockRequest.user = { sub: "user-123", role: "superadmin", sid: "session-123" };

      const middleware = requireRole("admin");
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it("should not let admin inherit superadmin authorization", () => {
      expect(roleSatisfies("admin", "superadmin")).toBe(false);
      mockRequest.user = { sub: "user-123", role: "admin", sid: "session-123" };

      const middleware = requireRole("superadmin");
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(403);
    });
  });
});
