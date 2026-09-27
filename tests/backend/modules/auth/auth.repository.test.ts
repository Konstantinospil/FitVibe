import { db } from "../../../../apps/backend/src/db/connection.js";
import * as authRepository from "../../../../apps/backend/src/modules/auth/auth.repository.js";
import type { AuthUserRecord } from "../../../../apps/backend/src/modules/auth/auth.repository.js";

// Mock db
const queryBuilders: Record<string, any> = {};

function createMockQueryBuilder(defaultValue: unknown = null) {
  const builder = Object.assign(Promise.resolve(defaultValue), {
    where: jest.fn().mockReturnThis(),
    whereRaw: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    whereNot: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    andWhereNot: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(1),
    delete: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
    count: jest.fn().mockReturnThis(),
    transacting: jest.fn().mockReturnThis(),
    forUpdate: jest.fn().mockReturnThis(),
    raw: jest.fn().mockReturnValue({}),
  });
  (builder as any).raw = jest.fn().mockReturnValue({});
  return builder;
}

jest.mock("../../../../apps/backend/src/db/connection.js", () => {
  const mockDbFunction = jest.fn((table: string) => {
    if (!queryBuilders[table]) {
      queryBuilders[table] = createMockQueryBuilder();
    }
    return queryBuilders[table];
  }) as jest.Mock & {
    raw: jest.Mock;
    transaction: jest.Mock;
  };

  mockDbFunction.raw = jest.fn().mockReturnValue({});
  mockDbFunction.transaction = jest.fn((callback) => {
    const mockTrx = ((table: string) => {
      if (!queryBuilders[table]) {
        queryBuilders[table] = createMockQueryBuilder();
      }
      return queryBuilders[table];
    }) as any;
    return Promise.resolve(callback(mockTrx));
  });

  return {
    db: mockDbFunction,
  };

  describe("atomic auth state", () => {
    it("creates session and initial refresh token in one transaction", async () => {
      const session = {
        jti: "session-atomic",
        user_id: userId,
        user_agent: null,
        ip: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      };
      const refresh = {
        id: "refresh-atomic",
        user_id: userId,
        token_hash: "hash-atomic",
        session_jti: session.jti,
        created_at: session.created_at,
        expires_at: session.expires_at,
      };

      await authRepository.createSessionWithRefresh(session, refresh);

      expect(queryBuilders.auth_sessions.insert).toHaveBeenCalledWith(session);
      expect(queryBuilders.refresh_tokens.insert).toHaveBeenCalledWith(refresh);
    });

    it("returns false without writes when refresh rotation has already been claimed", async () => {
      const refreshBuilder = createMockQueryBuilder();
      refreshBuilder.first.mockResolvedValue({ revoked_at: new Date().toISOString() });
      queryBuilders.refresh_tokens = refreshBuilder;

      const rotated = await authRepository.rotateRefreshAtomic(
        "old-hash",
        "session-1",
        {
          id: "replacement",
          user_id: userId,
          token_hash: "new-hash",
          session_jti: "session-1",
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          created_at: new Date().toISOString(),
        },
        { expires_at: new Date(Date.now() + 60_000).toISOString() },
      );

      expect(rotated).toBe(false);
      expect(refreshBuilder.insert).not.toHaveBeenCalled();
    });

    it("locks a reset token before applying password reset", async () => {
      const tokenBuilder = createMockQueryBuilder();
      tokenBuilder.first.mockResolvedValue({ id: "reset-1" });
      queryBuilders.auth_tokens = tokenBuilder;
      queryBuilders.users = createMockQueryBuilder();
      queryBuilders.refresh_tokens = createMockQueryBuilder();
      queryBuilders.auth_sessions = createMockQueryBuilder();

      await expect(
        authRepository.resetPasswordAtomic(userId, "new-hash", "reset-1", "password_reset"),
      ).resolves.toBe(true);

      expect(tokenBuilder.forUpdate).toHaveBeenCalled();
      expect(queryBuilders.users.update).toHaveBeenCalledWith(
        expect.objectContaining({ password_hash: "new-hash" }),
      );
      expect(queryBuilders.auth_sessions.update).toHaveBeenCalled();
    });
  });

});
jest.mock("crypto", () => ({
  randomUUID: jest.fn(() => "uuid-123"),
}));

describe("Auth Repository", () => {
  const userId = "user-123";
  const email = "test@example.com";

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(queryBuilders).forEach((key) => delete queryBuilders[key]);
  });

  describe("findUserByEmail", () => {
    it("should find user by email", async () => {
      const mockUser: AuthUserRecord = {
        id: userId,
        username: "testuser",
        display_name: "Test User",
        locale: "en",
        preferred_lang: "en",
        status: "active",
        role_code: "athlete",
        password_hash: "hashed",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        primary_email: email,
        email_verified: true,
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
        terms_version: "1.0.0",
      };

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("users as u");
      if (queryBuilders["users as u"]) {
        queryBuilders["users as u"].first = jest.fn().mockResolvedValue(mockUser);
      }

      const result = await authRepository.findUserByEmail(email);

      expect(result).toEqual(mockUser);
    });

    it("should return undefined when user not found", async () => {
      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      const builder = dbFn("users as u");
      if (queryBuilders["users as u"]) {
        queryBuilders["users as u"].first = jest.fn().mockResolvedValue(undefined);
        Object.assign(builder, Promise.resolve(undefined));
      }

      const result = await authRepository.findUserByEmail("nonexistent@example.com");

      expect(result).toBeUndefined();
    });
  });

  describe("findUserById", () => {
    it("should find user by id", async () => {
      const mockUser: AuthUserRecord = {
        id: userId,
        username: "testuser",
        display_name: "Test User",
        locale: "en",
        preferred_lang: "en",
        status: "active",
        role_code: "athlete",
        password_hash: "hashed",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        primary_email: email,
        email_verified: true,
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
        terms_version: "1.0.0",
      };

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      const builder = dbFn("users as u");
      if (queryBuilders["users as u"]) {
        queryBuilders["users as u"].first = jest.fn().mockResolvedValue(mockUser);
        Object.assign(builder, Promise.resolve(mockUser));
      }

      const result = await authRepository.findUserById(userId);

      expect(result).toEqual(mockUser);
    });
  });

  describe("findUserByUsername", () => {
    it("should find user by username", async () => {
      const mockUser: AuthUserRecord = {
        id: userId,
        username: "testuser",
        display_name: "Test User",
        locale: "en",
        preferred_lang: "en",
        status: "active",
        role_code: "athlete",
        password_hash: "hashed",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        primary_email: email,
        email_verified: true,
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
        terms_version: "1.0.0",
      };

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      const builder = dbFn("users as u");
      if (queryBuilders["users as u"]) {
        queryBuilders["users as u"].first = jest.fn().mockResolvedValue(mockUser);
        Object.assign(builder, Promise.resolve(mockUser));
      }

      const result = await authRepository.findUserByUsername("testuser");

      expect(result).toEqual(mockUser);
    });
  });

  describe("createUser", () => {
    it("should create user", async () => {
      const mockUser: AuthUserRecord = {
        id: userId,
        username: "newuser",
        display_name: "New User",
        locale: "en-US",
        preferred_lang: "en",
        status: "active",
        role_code: "athlete",
        password_hash: "hashed",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        primary_email: email,
        email_verified: false,
        terms_accepted: false,
        terms_accepted_at: null,
        terms_version: null,
      };

      const newBuilder = createMockQueryBuilder();
      queryBuilders["users"] = newBuilder;
      queryBuilders["user_contacts"] = newBuilder;
      queryBuilders["profiles"] = newBuilder;
      queryBuilders["user_domain_vibe_levels"] = newBuilder;
      queryBuilders["users as u"] = newBuilder;
      newBuilder.returning.mockResolvedValueOnce([]); // contacts insert
      newBuilder.first.mockResolvedValue(mockUser); // user query

      const result = await authRepository.createUser({
        id: userId,
        username: "newuser",
        display_name: "New User",
        status: "active",
        role_code: "athlete",
        password_hash: "hashed",
        primaryEmail: email,
        gender_code: "woman",
        fitness_level_code: "intermediate",
        date_of_birth: "1990-06-15",
      });

      expect(result).toEqual(mockUser);
      expect(newBuilder.insert).toHaveBeenCalled();
      expect(newBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          alias: "newuser",
          gender_code: "woman",
          fitness_level_code: "intermediate",
          date_of_birth: "1990-06-15",
        }),
      );
      expect(newBuilder.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            user_id: userId,
            domain_code: "strength",
            vibe_level: 1000,
            rating_deviation: 350,
            volatility: 0.06,
          }),
          expect.objectContaining({ domain_code: "regeneration" }),
        ]),
      );
      const vibeInsert = newBuilder.insert.mock.calls.find(
        (call: unknown[]) => Array.isArray(call[0]) && (call[0] as unknown[]).length === 6,
      );
      expect(vibeInsert).toBeDefined();
      expect(
        (vibeInsert![0] as unknown[]).map((row: { domain_code: string }) => row.domain_code),
      ).toEqual([
        "strength",
        "agility",
        "endurance",
        "explosivity",
        "intelligence",
        "regeneration",
      ]);
      expect((db as unknown as jest.Mock).mock.calls.flat()).not.toContain(
        "user_vibeform_preferences",
      );
    });

    it("should store registration weight in the existing bio attribute history", async () => {
      const attributeBuilder = createMockQueryBuilder();
      attributeBuilder.first.mockResolvedValue({ id: "weight-attribute-id" });
      queryBuilders["bio_attributes"] = attributeBuilder;
      const valueBuilder = createMockQueryBuilder();
      queryBuilders["bio_attribute_values"] = valueBuilder;
      const userBuilder = createMockQueryBuilder();
      queryBuilders["users as u"] = userBuilder;

      await authRepository.createUser({
        id: userId,
        username: "newuser",
        display_name: "New User",
        status: "active",
        role_code: "athlete",
        password_hash: "hashed",
        primaryEmail: email,
        weight_kg: 82.5,
      });

      expect(attributeBuilder.where).toHaveBeenCalledWith({ key: "weight_kg" });
      expect(valueBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          attribute_id: "weight-attribute-id",
          value_number: 82.5,
        }),
      );
    });

    it("should reject createUser when alias and username are missing", async () => {
      await expect(
        authRepository.createUser({
          id: userId,
          display_name: "New User",
          status: "active",
          role_code: "athlete",
          password_hash: "hashed",
          primaryEmail: email,
        }),
      ).rejects.toThrow("createUser requires a non-empty alias");
    });
  });

  describe("updateUserStatus", () => {
    it("should update user status", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["users"] = newBuilder;
      newBuilder.update.mockResolvedValue(1);

      await authRepository.updateUserStatus(userId, "suspended");

      expect(newBuilder.where).toHaveBeenCalledWith({ id: userId });
      expect(newBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "suspended",
          updated_at: expect.any(String),
        }),
      );
    });
  });

  describe("updateUserPassword", () => {
    it("should update user password", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["users"] = newBuilder;
      newBuilder.update.mockResolvedValue(1);

      await authRepository.updateUserPassword(userId, "new-hash");

      expect(newBuilder.where).toHaveBeenCalledWith({ id: userId });
      expect(newBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          password_hash: "new-hash",
          updated_at: expect.any(String),
        }),
      );
    });
  });

  describe("insertRefreshToken", () => {
    it("should insert refresh token", async () => {
      const tokenRow = {
        id: "token-123",
        user_id: userId,
        token_hash: "hash",
        session_jti: "session-123",
        expires_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        revoked_at: null,
      };

      const newBuilder = createMockQueryBuilder();
      queryBuilders["refresh_tokens"] = newBuilder;
      newBuilder.returning.mockResolvedValue([tokenRow]);

      const result = await authRepository.insertRefreshToken(tokenRow);

      expect(result).toEqual([tokenRow]);
      expect(newBuilder.insert).toHaveBeenCalledWith(tokenRow);
    });
  });

  describe("revokeRefreshByHash", () => {
    it("should revoke refresh token by hash", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["refresh_tokens"] = newBuilder;
      newBuilder.update.mockResolvedValue(1);

      await authRepository.revokeRefreshByHash("token-hash");

      expect(newBuilder.where).toHaveBeenCalledWith({ token_hash: "token-hash" });
      expect(newBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          revoked_at: expect.any(String),
        }),
      );
    });
  });

  describe("getRefreshByHash", () => {
    it("should get refresh token by hash", async () => {
      const mockToken = {
        id: "token-123",
        user_id: userId,
        token_hash: "hash",
        session_jti: "session-123",
        expires_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        revoked_at: null,
      };

      const newBuilder = createMockQueryBuilder();
      queryBuilders["refresh_tokens"] = newBuilder;
      newBuilder.first.mockResolvedValue(mockToken);

      const result = await authRepository.getRefreshByHash("token-hash");

      expect(result).toEqual(mockToken);
      expect(newBuilder.where).toHaveBeenCalledWith({ token_hash: "token-hash" });
      expect(newBuilder.whereNull).toHaveBeenCalledWith("revoked_at");
    });

    it("should return undefined when token not found", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["refresh_tokens"] = newBuilder;
      newBuilder.first.mockResolvedValue(undefined);

      const result = await authRepository.getRefreshByHash("token-hash");

      expect(result).toBeUndefined();
    });
  });

  describe("revokeRefreshByUserId", () => {
    it("should revoke refresh tokens by user id", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["refresh_tokens"] = newBuilder;
      newBuilder.update.mockResolvedValue(3);

      await authRepository.revokeRefreshByUserId(userId);

      expect(newBuilder.where).toHaveBeenCalledWith({ user_id: userId });
      expect(newBuilder.update).toHaveBeenCalled();
    });
  });

  describe("revokeRefreshBySession", () => {
    it("should revoke refresh token by session", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["refresh_tokens"] = newBuilder;
      newBuilder.update.mockResolvedValue(1);

      await authRepository.revokeRefreshBySession("session-123");

      expect(newBuilder.where).toHaveBeenCalledWith({ session_jti: "session-123" });
      expect(newBuilder.update).toHaveBeenCalled();
    });
  });

  describe("revokeRefreshByUserExceptSession", () => {
    it("should revoke refresh tokens by user except session", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["refresh_tokens"] = newBuilder;
      newBuilder.update.mockResolvedValue(2);

      await authRepository.revokeRefreshByUserExceptSession(userId, "session-123");

      expect(newBuilder.where).toHaveBeenCalledWith({ user_id: userId });
      expect(newBuilder.whereNot).toHaveBeenCalledWith({ session_jti: "session-123" });
      expect(newBuilder.update).toHaveBeenCalled();
    });
  });

  describe("findRefreshTokenRaw", () => {
    it("should find refresh token raw", async () => {
      const mockToken = {
        id: "token-123",
        user_id: userId,
        token_hash: "hash",
        session_jti: "session-123",
        expires_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        revoked_at: null,
      };

      const newBuilder = createMockQueryBuilder();
      queryBuilders["refresh_tokens"] = newBuilder;
      newBuilder.first.mockResolvedValue(mockToken);

      const result = await authRepository.findRefreshTokenRaw("token-hash");

      expect(result).toEqual(mockToken);
      expect(newBuilder.where).toHaveBeenCalledWith({ token_hash: "token-hash" });
    });
  });

  describe("createAuthToken", () => {
    it("should create auth token", async () => {
      const tokenRow = {
        id: "token-123",
        user_id: userId,
        token_type: "email_verification",
        token_hash: "hash",
        expires_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        consumed_at: null,
      };

      const newBuilder = createMockQueryBuilder();
      queryBuilders["auth_tokens"] = newBuilder;
      newBuilder.returning.mockResolvedValue([tokenRow]);

      const result = await authRepository.createAuthToken(tokenRow);

      expect(result).toEqual([tokenRow]);
      expect(newBuilder.insert).toHaveBeenCalledWith(tokenRow);
    });
  });

  describe("deleteAuthTokensByType", () => {
    it("should delete auth tokens by type", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["auth_tokens"] = newBuilder;
      newBuilder.del.mockResolvedValue(5);

      const result = await authRepository.deleteAuthTokensByType(userId, "email_verification");

      expect(result).toBe(5);
      expect(newBuilder.where).toHaveBeenCalledWith({
        user_id: userId,
        token_type: "email_verification",
      });
      expect(newBuilder.del).toHaveBeenCalled();
    });
  });

  describe("findAuthToken", () => {
    it("should find auth token", async () => {
      const mockToken = {
        id: "token-123",
        user_id: userId,
        token_type: "email_verification",
        token_hash: "hash",
        expires_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        consumed_at: null,
      };

      const newBuilder = createMockQueryBuilder();
      queryBuilders["auth_tokens"] = newBuilder;
      newBuilder.first.mockResolvedValue(mockToken);

      const result = await authRepository.findAuthToken("email_verification", "hash");

      expect(result).toEqual(mockToken);
      expect(newBuilder.where).toHaveBeenCalledWith({
        token_type: "email_verification",
        token_hash: "hash",
      });
      expect(newBuilder.whereNull).toHaveBeenCalledWith("consumed_at");
    });
  });

  describe("consumeAuthToken", () => {
    it("should consume auth token", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["auth_tokens"] = newBuilder;
      newBuilder.update.mockResolvedValue(1);

      await authRepository.consumeAuthToken("token-123");

      expect(newBuilder.where).toHaveBeenCalledWith({ id: "token-123" });
      expect(newBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          consumed_at: expect.any(String),
        }),
      );
    });
  });

  describe("markAuthTokensConsumed", () => {
    it("should mark auth tokens as consumed", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["auth_tokens"] = newBuilder;
      newBuilder.update.mockResolvedValue(3);

      await authRepository.markAuthTokensConsumed(userId, "email_verification");

      expect(newBuilder.where).toHaveBeenCalledWith({
        user_id: userId,
        token_type: "email_verification",
      });
      expect(newBuilder.whereNull).toHaveBeenCalledWith("consumed_at");
      expect(newBuilder.update).toHaveBeenCalled();
    });
  });

  describe("countAuthTokensSince", () => {
    it("should count auth tokens since date", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["auth_tokens"] = newBuilder;
      newBuilder.first.mockResolvedValue({ count: "5" });

      const since = new Date("2024-01-01");
      const result = await authRepository.countAuthTokensSince(userId, "email_verification", since);

      expect(result).toBe(5);
      expect(newBuilder.where).toHaveBeenCalledWith({
        user_id: userId,
        token_type: "email_verification",
      });
      expect(newBuilder.where).toHaveBeenCalledWith("created_at", ">=", since.toISOString());
    });

    it("should handle null result", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["auth_tokens"] = newBuilder;
      newBuilder.first.mockResolvedValue(null);

      const since = new Date("2024-01-01");
      const result = await authRepository.countAuthTokensSince(userId, "email_verification", since);

      expect(result).toBe(0);
    });
  });

  describe("purgeAuthTokensOlderThan", () => {
    it("should purge auth tokens older than date", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["auth_tokens"] = newBuilder;
      newBuilder.del.mockResolvedValue(10);

      const olderThan = new Date("2024-01-01");
      const result = await authRepository.purgeAuthTokensOlderThan("email_verification", olderThan);

      expect(result).toBe(10);
      expect(newBuilder.where).toHaveBeenCalledWith({ token_type: "email_verification" });
      expect(newBuilder.andWhere).toHaveBeenCalledWith("created_at", "<", olderThan.toISOString());
    });
  });

  describe("createAuthSession", () => {
    it("should create auth session", async () => {
      const sessionRow = {
        jti: "session-123",
        user_id: userId,
        expires_at: new Date().toISOString(),
        user_agent: "Mozilla/5.0",
        ip: "192.168.1.1",
        created_at: new Date().toISOString(),
        revoked_at: null,
      };

      const newBuilder = createMockQueryBuilder();
      queryBuilders["auth_sessions"] = newBuilder;
      newBuilder.returning.mockResolvedValue([sessionRow]);

      const result = await authRepository.createAuthSession(sessionRow);

      expect(result).toEqual([sessionRow]);
      expect(newBuilder.insert).toHaveBeenCalledWith(sessionRow);
    });
  });

  describe("findSessionById", () => {
    it("should find session by id", async () => {
      const mockSession = {
        jti: "session-123",
        user_id: userId,
        expires_at: new Date().toISOString(),
        user_agent: "Mozilla/5.0",
        ip: "192.168.1.1",
        created_at: new Date().toISOString(),
        revoked_at: null,
      };

      const newBuilder = createMockQueryBuilder();
      queryBuilders["auth_sessions"] = newBuilder;
      newBuilder.first.mockResolvedValue(mockSession);

      const result = await authRepository.findSessionById("session-123");

      expect(result).toEqual(mockSession);
      expect(newBuilder.where).toHaveBeenCalledWith({ jti: "session-123" });
    });
  });

  describe("listSessionsByUserId", () => {
    it("should list sessions by user id", async () => {
      const mockSessions = [
        {
          jti: "session-1",
          user_id: userId,
          expires_at: new Date().toISOString(),
          user_agent: "Mozilla/5.0",
          ip: "192.168.1.1",
          created_at: new Date().toISOString(),
          revoked_at: null,
        },
        {
          jti: "session-2",
          user_id: userId,
          expires_at: new Date().toISOString(),
          user_agent: "Mozilla/5.0",
          ip: "192.168.1.2",
          created_at: new Date().toISOString(),
          revoked_at: null,
        },
      ];

      const newBuilder = createMockQueryBuilder(mockSessions);
      queryBuilders["auth_sessions"] = newBuilder;

      const result = await authRepository.listSessionsByUserId(userId);

      expect(result).toEqual(mockSessions);
      expect(newBuilder.where).toHaveBeenCalledWith({ user_id: userId });
      expect(newBuilder.orderBy).toHaveBeenCalledWith("created_at", "desc");
    });
  });

  describe("updateSession", () => {
    it("should update session", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["auth_sessions"] = newBuilder;
      newBuilder.update.mockResolvedValue(1);

      await authRepository.updateSession("session-123", {
        expires_at: new Date().toISOString(),
        user_agent: "Mozilla/5.0",
        ip: "192.168.1.1",
      });

      expect(newBuilder.where).toHaveBeenCalledWith({ jti: "session-123" });
      expect(newBuilder.update).toHaveBeenCalledWith({
        expires_at: expect.any(String),
        user_agent: "Mozilla/5.0",
        ip: "192.168.1.1",
      });
    });
  });

  describe("revokeSessionById", () => {
    it("should revoke session by id", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["auth_sessions"] = newBuilder;
      newBuilder.update.mockResolvedValue(1);

      await authRepository.revokeSessionById("session-123");

      expect(newBuilder.where).toHaveBeenCalledWith({ jti: "session-123" });
      expect(newBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          revoked_at: expect.any(String),
        }),
      );
    });
  });

  describe("revokeSessionsByUserId", () => {
    it("should revoke sessions by user id", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["auth_sessions"] = newBuilder;
      newBuilder.update.mockResolvedValue(3);

      await authRepository.revokeSessionsByUserId(userId);

      expect(newBuilder.where).toHaveBeenCalledWith({ user_id: userId });
      expect(newBuilder.whereNull).toHaveBeenCalledWith("revoked_at");
      expect(newBuilder.update).toHaveBeenCalled();
    });

    it("should exclude session when excludeJti provided", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["auth_sessions"] = newBuilder;
      newBuilder.update.mockResolvedValue(2);

      await authRepository.revokeSessionsByUserId(userId, "session-123");

      expect(newBuilder.andWhereNot).toHaveBeenCalledWith({ jti: "session-123" });
    });
  });

  describe("purgeExpiredSessions", () => {
    it("should purge expired sessions", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["auth_sessions"] = newBuilder;
      newBuilder.del.mockResolvedValue(5);

      const olderThan = new Date("2024-01-01");
      const result = await authRepository.purgeExpiredSessions(olderThan);

      expect(result).toBe(5);
      expect(newBuilder.where).toHaveBeenCalledWith("expires_at", "<", olderThan.toISOString());
      expect(newBuilder.del).toHaveBeenCalled();
    });
  });

  describe("markEmailVerified", () => {
    it("should mark email as verified", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["user_contacts"] = newBuilder;
      newBuilder.update.mockResolvedValue(1);

      const result = await authRepository.markEmailVerified(userId, email);

      expect(result).toBe(1);
      expect(newBuilder.where).toHaveBeenCalled();
      expect(newBuilder.whereRaw).toHaveBeenCalled();
      expect(newBuilder.update).toHaveBeenCalled();
    });
  });
});
