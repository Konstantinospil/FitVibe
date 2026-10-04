import MockAdapter from "axios-mock-adapter";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  apiClient,
  rawHttpClient,
  getHealthStatus,
  login,
  register,
  verify2FALogin,
  forgotPassword,
  resetPassword,
  getFeed,
  likeFeedItem,
  unlikeFeedItem,
  cloneSessionFromFeed,
  getProgressSummary,
  getProgressTrends,
  getExerciseBreakdown,
  exportProgress,
  listExercises,
  getExercise,
  createExercise,
  updateExercise,
  deleteExercise,
  listSessions,
  getSession,
  createSession,
  updateSession,
  deleteSession,
  cloneSession,
  getSystemReadOnlyStatus,
  enableReadOnlyMode,
  disableReadOnlyMode,
  getFeedReports,
  moderateContent,
  searchUsers,
  suspendUser,
  banUser,
  activateUser,
  deleteUser,
  setup2FA,
  verify2FA,
  disable2FA,
  get2FAStatus,
  getDashboardAnalytics,
  submitContact,
  getCurrentUser,
  updateProfile,
  acceptTerms,
  revokeTerms,
  acceptPrivacyPolicy,
  revokePrivacyPolicy,
  getLegalDocumentsStatus,
  getLegalDocumentVersions,
  resendVerificationEmail,
  logout,
  listAuthSessions,
  revokeAuthSessions,
  bookmarkFeedItem,
  unbookmarkFeedItem,
  followUser,
  unfollowUser,
  getVibePoints,
  unsuspendUser,
  getPointsBalance,
  getPointsHistory,
  getUserBadges,
  getBadgeCatalog,
  getLeaderboard,
  changePassword,
  getPrivacySettings,
  updatePrivacySettings,
  getUserPreferences,
  updateUserPreferences,
  deleteAccount,
  exportUserData,
  getFeedItemComments,
  addComment,
  deleteComment,
  createShareLink,
  revokeShareLink,
} from "../../src/services/api";

describe("API Service Functions", () => {
  let apiMock: MockAdapter;
  let rawMock: MockAdapter;

  beforeEach(() => {
    apiMock = new MockAdapter(apiClient);
    rawMock = new MockAdapter(rawHttpClient);
    rawMock.onGet("/api/v1/csrf-token").reply(200, { csrfToken: "test-csrf-token" });
  });

  afterEach(() => {
    apiMock.restore();
    rawMock.restore();
    vi.restoreAllMocks();
  });

  describe("getHealthStatus", () => {
    it("should fetch health status", async () => {
      const mockResponse = { status: "ok", uptime: 3600, version: "1.0.0" };
      apiMock.onGet("/health").reply(200, mockResponse);

      const result = await getHealthStatus();

      expect(result).toEqual(mockResponse);
    });
  });

  describe("login", () => {
    it("should login successfully", async () => {
      const mockResponse = {
        requires2FA: false,
        user: { id: "1", username: "test", email: "test@example.com" },
        session: { id: "session-1" },
      };
      // login uses rawHttpClient, not apiClient
      rawMock.onPost("/api/v1/auth/login").reply(200, mockResponse);

      const result = await login({ email: "test@example.com", password: "password123" });

      expect(result).toEqual(mockResponse);
    });
  });

  describe("register", () => {
    it("should register successfully", async () => {
      const mockResponse = {
        user: { id: "1", username: "test", email: "test@example.com" },
        session: { id: "session-1" },
      };
      // register uses rawHttpClient
      rawMock.onPost("/api/v1/auth/register").reply(200, mockResponse);

      const result = await register({
        email: "test@example.com",
        password: "password123",
        username: "test",
        terms_accepted: true,
      });

      expect(result).toEqual(mockResponse);
    });
  });

  describe("verify2FALogin", () => {
    it("should verify 2FA login", async () => {
      const mockResponse = {
        user: { id: "1", username: "test", email: "test@example.com" },
        session: { id: "session-1" },
      };
      // verify2FALogin uses rawHttpClient
      rawMock.onPost("/api/v1/auth/login/verify-2fa").reply(200, mockResponse);

      const result = await verify2FALogin({ pendingSessionId: "session-1", code: "123456" });

      expect(result).toEqual(mockResponse);
    });
  });

  describe("forgotPassword", () => {
    it("should send forgot password request", async () => {
      const mockResponse = { message: "Password reset email sent" };
      // forgotPassword uses rawHttpClient
      rawMock.onPost("/api/v1/auth/password/forgot").reply(200, mockResponse);

      const result = await forgotPassword({ email: "test@example.com" });

      expect(result).toEqual(mockResponse);
    });
  });

  describe("resetPassword", () => {
    it("should reset password", async () => {
      const mockResponse = { message: "Password reset successfully" };
      // resetPassword uses rawHttpClient
      rawMock.onPost("/api/v1/auth/password/reset").reply(200, mockResponse);

      const result = await resetPassword({ token: "token-123", newPassword: "newpass123" });

      expect(result).toEqual(mockResponse);
    });
  });

  describe("getFeed", () => {
    it("should fetch feed items", async () => {
      const mockResponse = { items: [], total: 0 };
      apiMock.onGet("/api/v1/feed").reply(200, mockResponse);

      const result = await getFeed();

      expect(result).toEqual(mockResponse);
    });

    it("should fetch feed with params", async () => {
      const mockResponse = { items: [], total: 0 };
      apiMock.onGet("/api/v1/feed").reply(200, mockResponse);

      const result = await getFeed({ scope: "public", limit: 10, offset: 0 });

      expect(result).toEqual(mockResponse);
    });

    it("maps items with sessions, missing titles, and empty sessions", async () => {
      apiMock.onGet("/api/v1/feed").reply(200, {
        items: [
          {
            feedItemId: "f1",
            ownerId: "u1",
            ownerUsername: "alex",
            ownerDisplayName: "Alex",
            visibility: "public",
            publishedAt: "2025-01-01T00:00:00.000Z",
            session: {
              id: "s1",
              title: "Lift",
              completedAt: "2025-01-01T01:00:00.000Z",
              points: 10,
            },
            stats: { likes: 1, comments: 2, viewerHasLiked: true, viewerHasBookmarked: false },
          },
          {
            feedItemId: "f2",
            ownerId: "u2",
            ownerUsername: "sam",
            ownerDisplayName: "",
            visibility: "private",
            publishedAt: null,
            session: {
              id: "s2",
              title: null,
              completedAt: null,
              points: null,
            },
            stats: { likes: 0, comments: 0, viewerHasLiked: false, viewerHasBookmarked: true },
          },
          {
            feedItemId: "f3",
            ownerId: "u3",
            ownerUsername: "pat",
            ownerDisplayName: "",
            visibility: "followers",
            publishedAt: null,
            session: null,
            stats: { likes: 0, comments: 0, viewerHasLiked: false, viewerHasBookmarked: false },
          },
        ],
        total: 3,
        limit: 20,
        offset: 0,
      });

      const result = await getFeed();

      expect(result.items[0]).toMatchObject({
        id: "f1",
        user: { displayName: "Alex" },
        session: { id: "s1", title: "Lift", completedAt: "2025-01-01T01:00:00.000Z" },
        isLiked: true,
        isBookmarked: false,
      });
      expect(result.items[1].user.displayName).toBeUndefined();
      expect(result.items[1].session.title).toBeUndefined();
      expect(result.items[1].session.completedAt).toBeUndefined();
      expect(result.items[2].session.id).toBe("");
      expect(result.items[2].session.exerciseCount).toBe(0);
    });
  });

  describe("likeFeedItem", () => {
    it("should like a feed item", async () => {
      apiMock.onPost("/api/v1/feed/item/item-1/like").reply(200);

      await likeFeedItem("item-1");

      expect(apiMock.history.post[0]?.url).toBe("/api/v1/feed/item/item-1/like");
    });
  });

  describe("unlikeFeedItem", () => {
    it("should unlike a feed item", async () => {
      apiMock.onDelete("/api/v1/feed/item/item-1/like").reply(200);

      await unlikeFeedItem("item-1");

      expect(apiMock.history.delete[0]?.url).toBe("/api/v1/feed/item/item-1/like");
    });
  });

  describe("cloneSessionFromFeed", () => {
    it("should clone session from feed", async () => {
      const mockResponse = { sessionId: "session-2" };
      apiMock.onPost("/api/v1/feed/session/session-1/clone").reply(200, mockResponse);

      const result = await cloneSessionFromFeed("session-1");

      expect(result).toEqual(mockResponse);
    });
  });

  describe("getProgressSummary", () => {
    it("should fetch progress summary", async () => {
      const mockResponse = {
        totalSessions: 10,
        totalVolume: 1000,
        currentStreak: 5,
      };
      apiMock.onGet("/api/v1/progress/summary").reply(200, mockResponse);

      const result = await getProgressSummary(30);

      expect(result).toEqual(mockResponse);
    });
  });

  describe("getProgressTrends", () => {
    it("should fetch progress trends", async () => {
      const mockResponse = [
        { label: "Week 1", date: "2025-01-01", volume: 100, sessions: 3, avgIntensity: 7 },
      ];
      apiMock.onGet("/api/v1/progress/trends").reply(200, mockResponse);

      const result = await getProgressTrends({ period: 30, group_by: "week" });

      expect(result).toEqual(mockResponse);
    });
  });

  describe("getExerciseBreakdown", () => {
    it("should fetch exercise breakdown", async () => {
      const mockResponse = {
        exercises: [],
        period: 30,
      };
      apiMock.onGet("/api/v1/progress/exercises").reply(200, mockResponse);

      const result = await getExerciseBreakdown({ period: 30 });

      expect(result).toEqual(mockResponse);
    });
  });

  describe("exportProgress", () => {
    it("should export progress data", async () => {
      const mockBlob = new Blob(["test data"], { type: "application/json" });
      apiMock.onGet("/api/v1/progress/export").reply(200, mockBlob);

      const result = await exportProgress();

      expect(result).toBeInstanceOf(Blob);
    });
  });

  describe("listExercises", () => {
    it("should list exercises", async () => {
      const mockResponse = {
        data: [],
        total: 0,
        limit: 10,
        offset: 0,
      };
      apiMock.onGet("/api/v1/exercises").reply(200, mockResponse);

      const result = await listExercises();

      expect(result).toEqual(mockResponse);
    });

    it("should list exercises with query params", async () => {
      const mockResponse = {
        data: [],
        total: 0,
        limit: 10,
        offset: 0,
      };
      apiMock.onGet("/api/v1/exercises").reply(200, mockResponse);

      const result = await listExercises({ q: "bench", type_code: "strength" });

      expect(result).toEqual(mockResponse);
    });
  });

  describe("getExercise", () => {
    it("should get exercise by id", async () => {
      const mockResponse = {
        id: "exercise-1",
        name: "Bench Press",
        type_code: "strength",
        owner_id: null,
        muscle_group: "chest",
        equipment: "barbell",
        tags: [],
        is_public: true,
        description_en: null,
        description_de: null,
      };
      apiMock.onGet("/api/v1/exercises/exercise-1").reply(200, mockResponse);

      const result = await getExercise("exercise-1");

      expect(result).toEqual(mockResponse);
    });
  });

  describe("createExercise", () => {
    it("should create exercise", async () => {
      const mockResponse = {
        id: "exercise-1",
        name: "Bench Press",
        type_code: "strength",
        owner_id: null,
        muscle_group: "chest",
        equipment: "barbell",
        tags: [],
        is_public: true,
        description_en: null,
        description_de: null,
      };
      apiMock.onPost("/api/v1/exercises").reply(200, mockResponse);

      const result = await createExercise({
        name: "Bench Press",
        type_code: "strength",
        muscle_group: "chest",
        equipment: "barbell",
      });

      expect(result).toEqual(mockResponse);
    });
  });

  describe("updateExercise", () => {
    it("should update exercise", async () => {
      const mockResponse = {
        id: "exercise-1",
        name: "Updated Bench Press",
        type_code: "strength",
        owner_id: null,
        muscle_group: "chest",
        equipment: "barbell",
        tags: [],
        is_public: true,
        description_en: null,
        description_de: null,
      };
      apiMock.onPut("/api/v1/exercises/exercise-1").reply(200, mockResponse);

      const result = await updateExercise("exercise-1", { name: "Updated Bench Press" });

      expect(result).toEqual(mockResponse);
    });
  });

  describe("deleteExercise", () => {
    it("should delete exercise", async () => {
      apiMock.onDelete("/api/v1/exercises/exercise-1").reply(200);

      await deleteExercise("exercise-1");

      expect(apiMock.history.delete[0]?.url).toBe("/api/v1/exercises/exercise-1");
    });
  });

  describe("listSessions", () => {
    it("should list sessions", async () => {
      const mockResponse = {
        data: [],
        total: 0,
        limit: 10,
        offset: 0,
      };
      apiMock.onGet("/api/v1/sessions").reply(200, mockResponse);

      const result = await listSessions();

      expect(result).toEqual(mockResponse);
    });
  });

  describe("getSession", () => {
    it("should get session by id", async () => {
      const mockResponse = {
        id: "session-1",
        owner_id: "user-1",
        planned_at: "2025-01-01T00:00:00Z",
        status: "planned",
        visibility: "private",
        exercises: [],
      };
      apiMock.onGet("/api/v1/sessions/session-1").reply(200, mockResponse);

      const result = await getSession("session-1");

      expect(result).toEqual(mockResponse);
    });
  });

  describe("createSession", () => {
    it("should create session", async () => {
      const mockResponse = {
        id: "session-1",
        owner_id: "user-1",
        planned_at: "2025-01-01T00:00:00Z",
        status: "planned",
        visibility: "private",
        exercises: [],
      };
      apiMock.onPost("/api/v1/sessions").reply(200, mockResponse);

      const result = await createSession({
        planned_at: "2025-01-01T00:00:00Z",
        visibility: "private",
      });

      expect(result).toEqual(mockResponse);
    });
  });

  describe("updateSession", () => {
    it("should update session", async () => {
      const mockResponse = {
        id: "session-1",
        owner_id: "user-1",
        planned_at: "2025-01-01T00:00:00Z",
        status: "completed",
        visibility: "private",
        exercises: [],
      };
      apiMock.onPatch("/api/v1/sessions/session-1").reply(200, mockResponse);

      const result = await updateSession("session-1", { status: "completed" });

      expect(result).toEqual(mockResponse);
    });
  });

  describe("deleteSession", () => {
    it("should delete session", async () => {
      apiMock.onDelete("/api/v1/sessions/session-1").reply(200);

      await deleteSession("session-1");

      expect(apiMock.history.delete[0]?.url).toBe("/api/v1/sessions/session-1");
    });
  });

  describe("cloneSession", () => {
    it("should clone session", async () => {
      const mockResponse = {
        id: "session-2",
        owner_id: "user-1",
        planned_at: "2025-01-02T00:00:00Z",
        status: "planned",
        visibility: "private",
        exercises: [],
      };
      apiMock.onPost("/api/v1/sessions/session-1/clone").reply(200, mockResponse);

      const result = await cloneSession("session-1");

      expect(result).toEqual(mockResponse);
    });
  });

  describe("getSystemReadOnlyStatus", () => {
    it("should get system read-only status", async () => {
      const mockResponse = {
        readOnlyMode: false,
        message: null,
        timestamp: "2025-01-01T00:00:00Z",
      };
      apiMock.onGet("/api/v1/system/read-only/status").reply(200, mockResponse);

      const result = await getSystemReadOnlyStatus();

      expect(result).toEqual(mockResponse);
    });
  });

  describe("enableReadOnlyMode", () => {
    it("should enable read-only mode", async () => {
      const mockResponse = { success: true, message: "Read-only mode enabled" };
      apiMock.onPost("/api/v1/system/read-only/enable").reply(200, mockResponse);

      const result = await enableReadOnlyMode({ reason: "Maintenance" });

      expect(result).toEqual(mockResponse);
    });
  });

  describe("disableReadOnlyMode", () => {
    it("should disable read-only mode", async () => {
      const mockResponse = { success: true, message: "Read-only mode disabled" };
      apiMock.onPost("/api/v1/system/read-only/disable").reply(200, mockResponse);

      const result = await disableReadOnlyMode({ notes: "Maintenance complete" });

      expect(result).toEqual(mockResponse);
    });
  });

  describe("getFeedReports", () => {
    it("should get feed reports", async () => {
      const mockResponse = {
        data: [],
        total: 0,
        limit: 10,
        offset: 0,
      };
      apiMock.onGet("/api/v1/admin/reports").reply(200, mockResponse);

      const result = await getFeedReports();

      expect(result).toEqual(mockResponse);
    });
  });

  describe("moderateContent", () => {
    it("should moderate content", async () => {
      const mockResponse = { success: true, message: "Content moderated" };
      apiMock.onPost("/api/v1/admin/reports/report-1/moderate").reply(200, mockResponse);

      const result = await moderateContent("report-1", { action: "hide" });

      expect(result).toEqual(mockResponse);
    });
  });

  describe("searchUsers", () => {
    it("should search users", async () => {
      const mockResponse = {
        data: [],
        total: 0,
        limit: 10,
        offset: 0,
      };
      apiMock.onGet("/api/v1/admin/users/search").reply(200, mockResponse);

      const result = await searchUsers({ q: "test" });

      expect(result).toEqual(mockResponse);
    });
  });

  describe("suspendUser", () => {
    it("should suspend user", async () => {
      const mockResponse = { success: true, message: "User suspended" };
      apiMock.onPost("/api/v1/admin/users/user-1/suspend").reply(200, mockResponse);

      const result = await suspendUser("user-1");

      expect(result).toEqual(mockResponse);
    });
  });

  describe("banUser", () => {
    it("should ban user", async () => {
      const mockResponse = { success: true, message: "User banned" };
      apiMock.onPost("/api/v1/admin/users/user-1/ban").reply(200, mockResponse);

      const result = await banUser("user-1");

      expect(result).toEqual(mockResponse);
    });
  });

  describe("activateUser", () => {
    it("should activate user", async () => {
      const mockResponse = { success: true, message: "User activated" };
      apiMock.onPost("/api/v1/admin/users/user-1/activate").reply(200, mockResponse);

      const result = await activateUser("user-1");

      expect(result).toEqual(mockResponse);
    });
  });

  describe("deleteUser", () => {
    it("should delete user", async () => {
      const mockResponse = { success: true, message: "User deleted" };
      apiMock.onDelete("/api/v1/admin/users/user-1").reply(200, mockResponse);

      const result = await deleteUser("user-1");

      expect(result).toEqual(mockResponse);
    });
  });

  describe("setup2FA", () => {
    it("should setup 2FA", async () => {
      const mockResponse = {
        secret: "secret",
        qrCode: "data:image/png;base64,...",
        backupCodes: ["code1", "code2"],
        message: "2FA setup complete",
      };
      apiMock.onGet("/api/v1/auth/2fa/setup").reply(200, mockResponse);

      const result = await setup2FA();

      expect(result).toEqual(mockResponse);
    });
  });

  describe("verify2FA", () => {
    it("should verify 2FA code", async () => {
      const mockResponse = { success: true, message: "2FA verified" };
      apiMock.onPost("/api/v1/auth/2fa/verify").reply(200, mockResponse);

      const result = await verify2FA("123456");

      expect(result).toEqual(mockResponse);
    });
  });

  describe("disable2FA", () => {
    it("should disable 2FA", async () => {
      const mockResponse = { success: true, message: "2FA disabled" };
      apiMock.onPost("/api/v1/auth/2fa/disable").reply(200, mockResponse);

      const result = await disable2FA({ password: "password123", code: "123456" });

      expect(result).toEqual(mockResponse);
    });
  });

  describe("get2FAStatus", () => {
    it("should get 2FA status", async () => {
      const mockResponse = { enabled: true, backupCodesRemaining: 5 };
      apiMock.onGet("/api/v1/auth/2fa/status").reply(200, mockResponse);

      const result = await get2FAStatus();

      expect(result).toEqual(mockResponse);
    });
  });

  describe("getDashboardAnalytics", () => {
    it("should get dashboard analytics", async () => {
      const summaryResponse = {
        totalSessions: 10,
        totalVolume: 1000,
        currentStreak: 5,
      };
      const trendsResponse = [
        { label: "Week 1", date: "2025-01-01", volume: 100, sessions: 3, avgIntensity: 7 },
      ];

      apiMock
        .onGet("/api/v1/progress/summary", { params: { period: 30 } })
        .reply(200, summaryResponse);
      apiMock
        .onGet("/api/v1/progress/trends", { params: { period: 30, group_by: "week" } })
        .reply(200, trendsResponse);

      const result = await getDashboardAnalytics({ range: "4w", grain: "weekly" });

      expect(result).toHaveProperty("summary");
      expect(result).toHaveProperty("aggregates");
      expect(result).toHaveProperty("meta");
    });

    it("should handle 8w range with monthly grain", async () => {
      const summaryResponse = {
        totalSessions: 20,
        totalVolume: 2000,
        currentStreak: 10,
      };
      const trendsResponse = [
        { label: "Month 1", date: "2025-01-01", volume: 200, sessions: 6, avgIntensity: 8 },
      ];

      apiMock
        .onGet("/api/v1/progress/summary", { params: { period: 60 } })
        .reply(200, summaryResponse);
      apiMock
        .onGet("/api/v1/progress/trends", { params: { period: 60, group_by: "day" } })
        .reply(200, trendsResponse);

      const result = await getDashboardAnalytics({ range: "8w", grain: "monthly" });

      expect(result.meta.range).toBe("8w");
      expect(result.meta.grain).toBe("monthly");
    });

    it("should handle null/undefined summary values", async () => {
      const summaryResponse = {
        totalSessions: null,
        totalVolume: null,
        currentStreak: null,
        streakChange: null,
        sessionsChange: null,
        volumeChange: null,
        personalRecords: null,
      };
      const trendsResponse: unknown[] = null;

      apiMock
        .onGet("/api/v1/progress/summary", { params: { period: 30 } })
        .reply(200, summaryResponse);
      apiMock
        .onGet("/api/v1/progress/trends", { params: { period: 30, group_by: "week" } })
        .reply(200, trendsResponse);

      const result = await getDashboardAnalytics({ range: "4w", grain: "weekly" });

      expect(result.summary[0].value).toBe("0 days");
      expect(result.summary[1].value).toBe("0");
      expect(result.summary[2].value).toBe("0 kg");
      expect(result.personalRecords).toEqual([]);
      expect(result.aggregates).toEqual([]);
      expect(result.meta.totalRows).toBe(0);
      expect(result.meta.truncated).toBe(false);
    });

    it("should handle negative streakChange and sessionsChange", async () => {
      const summaryResponse = {
        totalSessions: 10,
        totalVolume: 1000,
        currentStreak: 5,
        streakChange: -2,
        sessionsChange: -3,
        volumeChange: -500,
      };
      const trendsResponse: unknown[] = [];

      apiMock
        .onGet("/api/v1/progress/summary", { params: { period: 30 } })
        .reply(200, summaryResponse);
      apiMock
        .onGet("/api/v1/progress/trends", { params: { period: 30, group_by: "week" } })
        .reply(200, trendsResponse);

      const result = await getDashboardAnalytics({ range: "4w", grain: "weekly" });

      expect(result.summary[0].trend).toContain("-2 vs last period");
      expect(result.summary[1].trend).toContain("-3 vs last period");
      expect(result.summary[2].trend).toContain("-0.5k kg vs last period");
    });

    it("should handle personal records with missing fields", async () => {
      const summaryResponse = {
        totalSessions: 10,
        totalVolume: 1000,
        currentStreak: 5,
        personalRecords: [
          { exerciseName: null, value: null, unit: null, achievedAt: null, visibility: null },
          { exerciseName: "Bench Press", value: 100, unit: "kg", achievedAt: "2025-01-01" },
        ],
      };
      const trendsResponse: unknown[] = [];

      apiMock
        .onGet("/api/v1/progress/summary", { params: { period: 30 } })
        .reply(200, summaryResponse);
      apiMock
        .onGet("/api/v1/progress/trends", { params: { period: 30, group_by: "week" } })
        .reply(200, trendsResponse);

      const result = await getDashboardAnalytics({ range: "4w", grain: "weekly" });

      expect(result.personalRecords[0].lift).toBe("Unknown");
      expect(result.personalRecords[0].value).toBe("-");
      expect(result.personalRecords[0].achieved).toBe("Unknown");
      expect(result.personalRecords[0].visibility).toBe("private");
      expect(result.personalRecords[1].lift).toBe("Bench Press");
      expect(result.personalRecords[1].value).toBe("100 kg");
    });

    it("formats positive change trends and missing PR units", async () => {
      const summaryResponse = {
        totalSessions: 10,
        totalVolume: 2500,
        currentStreak: 5,
        streakChange: 2,
        sessionsChange: 4,
        volumeChange: 1500,
        personalRecords: [
          { exerciseName: "Squat", value: 140, unit: null, achievedAt: "2025-02-01" },
        ],
      };
      const trendsResponse: unknown[] = [];

      apiMock
        .onGet("/api/v1/progress/summary", { params: { period: 30 } })
        .reply(200, summaryResponse);
      apiMock
        .onGet("/api/v1/progress/trends", { params: { period: 30, group_by: "week" } })
        .reply(200, trendsResponse);

      const result = await getDashboardAnalytics({ range: "4w", grain: "weekly" });

      expect(result.summary[0].trend).toContain("+2 vs last period");
      expect(result.summary[1].trend).toContain("+4 vs last period");
      expect(result.summary[2].trend).toContain("+1.5k kg vs last period");
      expect(result.personalRecords[0].value).toBe("140 kg");
    });

    it("should truncate trends when exceeding MAX_ANALYTIC_ROWS", async () => {
      const summaryResponse = {
        totalSessions: 10,
        totalVolume: 1000,
        currentStreak: 5,
      };
      const trendsResponse = Array.from({ length: 10 }, (_, i) => ({
        label: `Week ${i + 1}`,
        date: `2025-01-${i + 1}`,
        volume: 100,
        sessions: 3,
        avgIntensity: 7,
      }));

      apiMock
        .onGet("/api/v1/progress/summary", { params: { period: 30 } })
        .reply(200, summaryResponse);
      apiMock
        .onGet("/api/v1/progress/trends", { params: { period: 30, group_by: "week" } })
        .reply(200, trendsResponse);

      const result = await getDashboardAnalytics({ range: "4w", grain: "weekly" });

      expect(result.aggregates).toHaveLength(5); // MAX_ANALYTIC_ROWS
      expect(result.meta.truncated).toBe(true);
      expect(result.meta.totalRows).toBe(10);
    });

    it("should handle trends with missing labels", async () => {
      const summaryResponse = {
        totalSessions: 10,
        totalVolume: 1000,
        currentStreak: 5,
      };
      const trendsResponse = [
        { label: null, date: "2025-01-01", volume: 100, sessions: 3, avgIntensity: 7 },
        { date: "2025-01-02", volume: 200, sessions: 4, avgIntensity: 8 },
      ];

      apiMock
        .onGet("/api/v1/progress/summary", { params: { period: 30 } })
        .reply(200, summaryResponse);
      apiMock
        .onGet("/api/v1/progress/trends", { params: { period: 30, group_by: "week" } })
        .reply(200, trendsResponse);

      const result = await getDashboardAnalytics({ range: "4w", grain: "weekly" });

      expect(result.aggregates[0].period).toBe("Week 1");
      expect(result.aggregates[1].period).toBe("Week 2");
    });
  });

  const userDetail = {
    id: "u1",
    username: "alex",
    displayName: "Alex",
    locale: "en",
    preferredLang: "en",
    defaultVisibility: "private",
    units: "metric",
    role: "athlete",
    status: "active",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-02T00:00:00.000Z",
    primaryEmail: "alex@example.com",
    profile: {
      alias: "A",
      bio: "lifter",
      weight: 80,
      weightUnit: "kg",
      fitnessLevel: "intermediate",
      trainingFrequency: "3_4_per_week",
    },
  };

  describe("profile and legal endpoints", () => {
    it("maps the current user with and without profile fields", async () => {
      apiMock.onGet("/api/v1/users/me").replyOnce(200, userDetail);
      await expect(getCurrentUser()).resolves.toMatchObject({
        id: "u1",
        email: "alex@example.com",
        bio: "lifter",
        alias: "A",
        weight: 80,
      });

      apiMock.onGet("/api/v1/users/me").replyOnce(200, {
        ...userDetail,
        primaryEmail: null,
        profile: undefined,
      });
      await expect(getCurrentUser()).resolves.toMatchObject({
        email: undefined,
        bio: null,
        alias: null,
        weight: null,
        weightUnit: null,
        fitnessLevel: null,
        trainingFrequency: null,
      });
    });

    it("updates the profile via PUT and maps the response", async () => {
      apiMock.onPatch("/api/v1/users/me").replyOnce(200, userDetail);
      await expect(updateProfile({ displayName: "Alex" })).resolves.toMatchObject({
        displayName: "Alex",
        email: "alex@example.com",
      });

      apiMock.onPatch("/api/v1/users/me").replyOnce(200, {
        ...userDetail,
        primaryEmail: "",
        profile: undefined,
      });
      await expect(updateProfile({ displayName: "Alex" })).resolves.toMatchObject({
        email: undefined,
        bio: null,
      });
    });

    it("gets and updates user preferences", async () => {
      const preferences = { language: "de" as const, measurementSystem: "metric" as const };
      apiMock.onGet("/api/v1/users/me/preferences").replyOnce(200, preferences);
      await expect(getUserPreferences()).resolves.toEqual(preferences);

      const updated = { language: "de" as const, measurementSystem: "imperial" as const };
      apiMock.onPatch("/api/v1/users/me/preferences").replyOnce(200, updated);
      await expect(updateUserPreferences({ measurementSystem: "imperial" })).resolves.toEqual(
        updated,
      );
    });

    it("covers contact, terms, privacy, and legal document calls", async () => {
      rawMock.onPost("/api/v1/contact").reply(200, {
        success: true,
        data: { id: "c1", createdAt: "2025-01-01T00:00:00.000Z" },
      });
      await expect(
        submitContact({ email: "a@b.c", topic: "help", message: "hi" }),
      ).resolves.toMatchObject({ success: true });

      apiMock.onPost("/api/v1/auth/terms/accept").reply(200, { message: "ok" });
      await expect(acceptTerms({ terms_accepted: true })).resolves.toEqual({ message: "ok" });
      apiMock.onPost("/api/v1/auth/terms/revoke").reply(200, { message: "ok" });
      await expect(revokeTerms()).resolves.toEqual({ message: "ok" });
      apiMock.onPost("/api/v1/auth/privacy/accept").reply(200, { message: "ok" });
      await expect(acceptPrivacyPolicy({ privacy_policy_accepted: true })).resolves.toEqual({
        message: "ok",
      });
      apiMock.onPost("/api/v1/auth/privacy/revoke").reply(200, { message: "ok" });
      await expect(revokePrivacyPolicy()).resolves.toEqual({ message: "ok" });

      apiMock.onGet("/api/v1/auth/legal-documents/status").reply(200, { terms: {}, privacy: {} });
      await expect(getLegalDocumentsStatus()).resolves.toEqual({ terms: {}, privacy: {} });
      apiMock
        .onGet("/api/v1/auth/legal-documents/versions")
        .reply(200, { terms: "1", privacy: "1", cookie: "1" });
      await expect(getLegalDocumentVersions()).resolves.toEqual({
        terms: "1",
        privacy: "1",
        cookie: "1",
      });

      rawMock.onPost("/api/v1/auth/verify/resend").reply(200, { message: "sent" });
      await expect(resendVerificationEmail({ email: "a@b.c" })).resolves.toEqual({
        message: "sent",
      });
      rawMock.onPost("/api/v1/auth/logout").reply(204);
      await expect(logout()).resolves.toBeUndefined();
    });
  });

  describe("sessions, social, and account endpoints", () => {
    it("lists and revokes auth sessions", async () => {
      apiMock.onGet("/api/v1/auth/sessions").reply(200, { sessions: [] });
      await expect(listAuthSessions()).resolves.toEqual({ sessions: [] });
      apiMock.onPost("/api/v1/auth/sessions/revoke").reply(200, { revoked: 1 });
      await expect(revokeAuthSessions({ sessionId: "s1" })).resolves.toEqual({ revoked: 1 });
    });

    it("bookmarks, follows, and clones with optional payloads", async () => {
      apiMock.onPost("/api/v1/feed/item/f1/bookmark").reply(204);
      await expect(bookmarkFeedItem("f1")).resolves.toBeUndefined();
      apiMock.onDelete("/api/v1/feed/item/f1/bookmark").reply(204);
      await expect(unbookmarkFeedItem("f1")).resolves.toBeUndefined();
      apiMock.onPost("/api/v1/users/u1/follow").reply(204);
      await expect(followUser("u1")).resolves.toBeUndefined();
      apiMock.onDelete("/api/v1/users/u1/follow").reply(204);
      await expect(unfollowUser("u1")).resolves.toBeUndefined();

      apiMock.onPost("/api/v1/sessions/session-1/clone").reply(200, { id: "session-2" });
      await expect(
        cloneSession("session-1", { planned_at: "2025-01-03T00:00:00Z" }),
      ).resolves.toEqual({
        id: "session-2",
      });

      apiMock
        .onPost("/api/v1/admin/users/user-1/suspend")
        .reply(200, { success: true, message: "ok" });
      await expect(suspendUser("user-1", { reason: "spam" })).resolves.toEqual({
        success: true,
        message: "ok",
      });
      apiMock.onPost("/api/v1/admin/users/user-1/ban").reply(200, { success: true, message: "ok" });
      await expect(banUser("user-1", { reason: "abuse" })).resolves.toEqual({
        success: true,
        message: "ok",
      });
      apiMock
        .onPost("/api/v1/admin/users/user-1/activate")
        .reply(200, { success: true, message: "ok" });
      await expect(activateUser("user-1", { reason: "appeal" })).resolves.toEqual({
        success: true,
        message: "ok",
      });
    });

    it("covers points, badges, privacy, comments, and share links", async () => {
      apiMock
        .onGet("/api/v1/progress/vibes")
        .reply(200, { period_months: 12, months: [], overall: {}, vibes: [] });
      await expect(getVibePoints()).resolves.toMatchObject({ period_months: 12 });
      await expect(getVibePoints(6)).resolves.toMatchObject({ period_months: 12 });

      apiMock
        .onPost("/api/v1/admin/users/u1/unsuspend")
        .reply(200, { success: true, message: "ok" });
      await expect(unsuspendUser("u1")).resolves.toEqual({ success: true, message: "ok" });
      await expect(unsuspendUser("u1", { reason: "appeal" })).resolves.toEqual({
        success: true,
        message: "ok",
      });

      apiMock.onGet("/api/v1/points").reply(200, { balance: 10 });
      await expect(getPointsBalance()).resolves.toEqual({ balance: 10 });
      apiMock
        .onGet("/api/v1/points/history")
        .reply(200, { entries: [], total: 0, limit: 20, offset: 0 });
      await expect(getPointsHistory({ limit: 10 })).resolves.toMatchObject({ entries: [] });
      await expect(getPointsHistory()).resolves.toMatchObject({ entries: [] });

      apiMock.onGet("/api/v1/points/badges/earned").reply(200, { badges: [], total: 0 });
      await expect(getUserBadges()).resolves.toEqual({ badges: [], total: 0 });
      apiMock.onGet("/api/v1/points/badges").reply(200, { badges: [], total: 0 });
      await expect(getBadgeCatalog()).resolves.toEqual({ badges: [], total: 0 });
      apiMock.onGet("/api/v1/leaderboards").reply(200, { entries: [], total: 0 });
      await expect(getLeaderboard({ type: "global", period: "week" })).resolves.toMatchObject({
        entries: [],
      });

      apiMock.onPost("/api/v1/users/change-password").reply(204);
      await expect(
        changePassword({ currentPassword: "a", newPassword: "b" }),
      ).resolves.toBeUndefined();
      apiMock.onGet("/api/v1/users/me/privacy").reply(200, {
        defaultVisibility: "private",
        allowFollowers: true,
        showEmail: false,
        showWeight: false,
        showFitnessLevel: false,
      });
      await expect(getPrivacySettings()).resolves.toMatchObject({ allowFollowers: true });
      apiMock.onPatch("/api/v1/users/me/privacy").reply(200, {
        defaultVisibility: "private",
        allowFollowers: false,
        showEmail: false,
        showWeight: false,
        showFitnessLevel: false,
      });
      await expect(updatePrivacySettings({ allowFollowers: false })).resolves.toMatchObject({
        allowFollowers: false,
      });
      apiMock.onDelete("/api/v1/users/me").reply(200, {
        status: "pending_deletion",
        scheduledAt: "2025-01-01T00:00:00.000Z",
        purgeDueAt: "2025-01-31T00:00:00.000Z",
        backupPurgeDueAt: "2025-02-28T00:00:00.000Z",
      });
      await expect(deleteAccount({ password: "x" })).resolves.toMatchObject({
        status: "pending_deletion",
      });
      apiMock.onGet("/api/v1/users/me/export").reply(200, new Blob(["data"]));
      await expect(exportUserData()).resolves.toBeInstanceOf(Blob);

      apiMock.onGet("/api/v1/feed/f1/comments").reply(200, { comments: [] });
      await expect(getFeedItemComments("f1", { limit: 10 })).resolves.toEqual({ comments: [] });
      await expect(getFeedItemComments("f1")).resolves.toEqual({ comments: [] });
      apiMock.onPost("/api/v1/feed/f1/comments").reply(200, { comment: { id: "c1" } });
      await expect(addComment("f1", { body: "nice" })).resolves.toEqual({ comment: { id: "c1" } });
      apiMock.onDelete("/api/v1/feed/comments/c1").reply(204);
      await expect(deleteComment("c1")).resolves.toBeUndefined();
      apiMock
        .onPost("/api/v1/sessions/s1/share")
        .reply(200, { url: "https://x", token: "t", shareLink: "l" });
      await expect(createShareLink("s1")).resolves.toMatchObject({ token: "t" });
      apiMock.onDelete("/api/v1/sessions/s1/share").reply(204);
      await expect(revokeShareLink("s1")).resolves.toBeUndefined();
    });
  });
});
