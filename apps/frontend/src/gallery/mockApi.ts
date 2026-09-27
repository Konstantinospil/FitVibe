import AxiosMockAdapter from "axios-mock-adapter";
import { apiClient, rawHttpClient } from "../services/httpApi";

const mockUserDetail = {
  id: "gallery-user",
  username: "gallery",
  displayName: "Gallery Athlete",
  locale: "en",
  preferredLang: "en",
  defaultVisibility: "private",
  units: "metric",
  role: "admin",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-09-26T00:00:00.000Z",
  primaryEmail: "gallery@fitvibe.local",
  avatar: null,
  profile: {
    alias: "Gallery Athlete",
    bio: "Static preview fixture",
    weight: 82,
    weightUnit: "kg",
    fitnessLevel: "intermediate",
    trainingFrequency: "3_4_per_week",
  },
};

const exercise = {
  id: "exercise-1",
  name: "Back Squat",
  type_code: "strength",
  owner_id: null,
  muscle_group: "legs",
  equipment: "barbell",
  tags: ["compound"],
  is_public: true,
  description_en: "Barbell back squat",
  description_de: "Langhantel-Kniebeuge",
};

const session = {
  id: "session-1",
  owner_id: "gallery-user",
  plan_id: null,
  title: "Lower body strength",
  planned_at: "2026-09-26T17:00:00.000Z",
  status: "planned",
  visibility: "private",
  notes: "Gallery fixture",
  recurrence_rule: null,
  started_at: null,
  completed_at: null,
  calories: null,
  points: null,
  exercises: [],
};

const progressSummary = {
  totalSessions: 24,
  totalVolume: 52300,
  currentStreak: 6,
  streakChange: 1,
  sessionsChange: 2,
  volumeChange: 4200,
  personalRecords: [
    {
      exerciseName: "Back Squat",
      value: 150,
      unit: "kg",
      achievedAt: "2026-09-18",
      visibility: "public",
    },
  ],
};

const trends = [
  { label: "Week 36", date: "2026-09-07", volume: 12100, sessions: 4, avgIntensity: 7.4 },
  { label: "Week 37", date: "2026-09-14", volume: 13300, sessions: 5, avgIntensity: 7.7 },
  { label: "Week 38", date: "2026-09-21", volume: 14500, sessions: 5, avgIntensity: 7.8 },
];

const feed = {
  items: [
    {
      feedItemId: "feed-1",
      ownerId: "gallery-user",
      ownerUsername: "gallery",
      ownerDisplayName: "Gallery Athlete",
      visibility: "public",
      publishedAt: "2026-09-25T18:00:00.000Z",
      session: {
        id: "session-2",
        title: "Evening strength",
        completedAt: "2026-09-25T17:45:00.000Z",
        points: 120,
      },
      stats: { likes: 8, comments: 2, viewerHasLiked: false, viewerHasBookmarked: true },
    },
  ],
  total: 1,
  limit: 20,
  offset: 0,
};

const apiMock = new AxiosMockAdapter(apiClient, { delayResponse: 50 });
const rawMock = new AxiosMockAdapter(rawHttpClient, { delayResponse: 50 });

apiMock.onGet("/api/v1/users/me").reply(200, mockUserDetail);
apiMock.onGet("/api/v1/users/me/preferences").reply(200, {
  preferredLang: "en",
  defaultVisibility: "private",
  units: "metric",
});
apiMock.onGet("/api/v1/users/me/privacy").reply(200, {
  defaultVisibility: "private",
  profileVisibility: "private",
});
apiMock.onGet("/api/v1/users/me/body-progress").reply(200, { weights: [], photos: [] });
apiMock.onGet("/api/v1/auth/sessions").reply(200, { sessions: [] });
apiMock.onGet("/api/v1/auth/2fa/status").reply(200, { enabled: false, backupCodesRemaining: 0 });

apiMock.onGet("/api/v1/exercise-types").reply(200, [
  { code: "strength", name: "Strength" },
  { code: "endurance", name: "Endurance" },
]);
apiMock.onGet("/api/v1/exercises").reply(200, { data: [exercise], total: 1, limit: 20, offset: 0 });
apiMock.onGet(/\/api\/v1\/exercises\/.+/).reply(200, exercise);

apiMock.onGet("/api/v1/sessions").reply(200, { data: [session], total: 1, limit: 20, offset: 0 });
apiMock.onGet(/\/api\/v1\/sessions\/.+/).reply(200, session);

apiMock.onGet("/api/v1/feed").reply(200, feed);
apiMock.onGet(/\/api\/v1\/feed\/.+\/comments/).reply(200, { comments: [] });

apiMock.onGet("/api/v1/progress/summary").reply(200, progressSummary);
apiMock.onGet("/api/v1/progress/trends").reply(200, trends);
apiMock.onGet("/api/v1/progress/exercises").reply(200, { exercises: [], period: 30 });
apiMock.onGet("/api/v1/progress/vibes").reply(200, {
  period_months: 12,
  months: [],
  overall: { points: 0, trend: [] },
  vibes: [],
});

apiMock.onGet("/api/v1/system/read-only/status").reply(200, {
  readOnlyMode: false,
  message: null,
  timestamp: "2026-09-26T00:00:00.000Z",
});
apiMock.onGet("/health").reply(200, {
  status: "ok",
  uptime: 86400,
  version: "gallery",
  timestamp: "2026-09-26T00:00:00.000Z",
});
apiMock.onGet("/api/v1/logs/recent-activity").reply(200, { activity: [] });
apiMock.onGet("/api/v1/admin/reports").reply(200, { data: [], total: 0, limit: 20, offset: 0 });
apiMock.onGet("/api/v1/admin/users/search")
  .reply(200, { data: [], total: 0, limit: 20, offset: 0 });

apiMock.onGet("/api/v1/translations/metadata").reply(200, {
  data: { languages: ["en", "de", "fr", "es", "el"], namespaces: ["common", "auth"] },
});
apiMock.onGet("/api/v1/translations").reply(200, {
  data: [],
  pagination: { total: 0, limit: 50, offset: 0 },
});

rawMock.onGet(/\/api\/v1\/legal\/documents\/.+/).reply(200, {
  documentType: "terms",
  version: "gallery",
  changeClass: "editorial",
  userAction: "none",
  effectiveAt: "2026-01-01T00:00:00.000Z",
  publishedAt: "2026-01-01T00:00:00.000Z",
  language: "en",
  content: null,
  legacyWithoutSnapshot: true,
});

apiMock.onAny().reply(200, {});
rawMock.onAny().reply(200, {});

export { apiMock, rawMock };
