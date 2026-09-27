import type { Page, Route } from "@playwright/test";

const NOW_ISO = "2025-10-01T12:00:00.000Z";

const corsHeaders = (route: Route): Record<string, string> => {
  const origin = route.request().headers()["origin"] ?? "http://127.0.0.1:4173";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    vary: "Origin",
  };
};

const fulfillJson = (route: Route, data: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders(route),
    body: JSON.stringify(data),
  });

const DEFAULT_SYSTEM_CONFIG = {
  readOnlyMode: false,
  maintenanceMode: false,
  maintenanceMessage: null,
  features: {
    socialFeed: true,
    coachDashboard: false,
    insights: true,
  },
  timestamp: NOW_ISO,
};

const DEFAULT_USER = {
  id: "user-123",
  username: "ava",
  displayName: "Ava Stone",
  primaryEmail: "ava@example.com",
  role: "athlete",
  email: "ava@example.com",
  roleCode: "athlete",
  status: "active",
  profile: {
    alias: "ava-stone",
    bio: "Training for balance, strength, and joy.",
    weight: 72.5,
    weightUnit: "kg",
    fitnessLevel: "intermediate",
    trainingFrequency: "3_4_per_week",
  },
  avatar: {
    url: "https://example.com/avatar.png",
    mimeType: "image/png",
    bytes: 20480,
    updatedAt: NOW_ISO,
  },
  locale: "en",
  preferredLang: "en",
  defaultVisibility: "followers",
  units: "metric",
};

type UserAttributeValueType = "number" | "text" | "date";

type MockAttributeInput = {
  key: string;
  label: string;
  valueType: UserAttributeValueType;
  valueNumber?: number;
  valueText?: string;
  valueDate?: string;
  unit?: string | null;
};

const buildAttribute = ({
  key,
  label,
  valueType,
  valueNumber,
  valueText,
  valueDate,
  unit = null,
}: MockAttributeInput) => {
  const id = `attr-${key}`;
  return {
    id,
    key,
    label,
    unit,
    valueType,
    minValue: null,
    maxValue: null,
    minLength: null,
    maxLength: null,
    minDate: null,
    maxDate: null,
    createdAt: NOW_ISO,
    latestValue: {
      attributeId: id,
      valueNumber: valueType === "number" ? (valueNumber ?? null) : null,
      valueText: valueType === "text" ? (valueText ?? null) : null,
      valueDate: valueType === "date" ? (valueDate ?? null) : null,
      createdAt: NOW_ISO,
    },
  };
};

const DEFAULT_ATTRIBUTES = [
  buildAttribute({
    key: "display_name",
    label: "Display name",
    valueType: "text",
    valueText: "Ava Stone",
  }),
  buildAttribute({ key: "full_name", label: "Full name", valueType: "text", valueText: "Ava A." }),
  buildAttribute({
    key: "date_of_birth",
    label: "Date of birth",
    valueType: "date",
    valueDate: "1992-08-16",
  }),
  buildAttribute({
    key: "motto",
    label: "Motto",
    valueType: "text",
    valueText: "Consistency beats intensity.",
  }),
  buildAttribute({
    key: "biography",
    label: "Biography",
    valueType: "text",
    valueText: "Coach, climber, and strength enthusiast.",
  }),
  buildAttribute({
    key: "weight_kg",
    label: "Weight",
    unit: "kg",
    valueType: "number",
    valueNumber: 72.5,
  }),
  buildAttribute({
    key: "body_fat_pct",
    label: "Body fat",
    unit: "%",
    valueType: "number",
    valueNumber: 14.2,
  }),
  buildAttribute({
    key: "bone_weight_kg",
    label: "Bone weight",
    unit: "kg",
    valueType: "number",
    valueNumber: 3.1,
  }),
  buildAttribute({
    key: "body_water_pct",
    label: "Body water",
    unit: "%",
    valueType: "number",
    valueNumber: 55.3,
  }),
  buildAttribute({
    key: "height_cm",
    label: "Height",
    unit: "cm",
    valueType: "number",
    valueNumber: 178,
  }),
  buildAttribute({
    key: "chest_circumference_cm",
    label: "Chest",
    unit: "cm",
    valueType: "number",
    valueNumber: 101,
  }),
  buildAttribute({
    key: "waist_circumference_cm",
    label: "Waist",
    unit: "cm",
    valueType: "number",
    valueNumber: 82,
  }),
  buildAttribute({
    key: "hip_circumference_cm",
    label: "Hip",
    unit: "cm",
    valueType: "number",
    valueNumber: 97,
  }),
  buildAttribute({
    key: "bicep_circumference_cm",
    label: "Bicep",
    unit: "cm",
    valueType: "number",
    valueNumber: 36,
  }),
  buildAttribute({
    key: "thigh_circumference_cm",
    label: "Thigh",
    unit: "cm",
    valueType: "number",
    valueNumber: 58,
  }),
  buildAttribute({
    key: "calf_circumference_cm",
    label: "Calf",
    unit: "cm",
    valueType: "number",
    valueNumber: 38,
  }),
  buildAttribute({
    key: "vo2_max",
    label: "VO2 max",
    unit: "ml/kg/min",
    valueType: "number",
    valueNumber: 49,
  }),
  buildAttribute({
    key: "ftp_watts",
    label: "FTP",
    unit: "W",
    valueType: "number",
    valueNumber: 215,
  }),
  buildAttribute({
    key: "run_12min_m",
    label: "12 min run",
    unit: "m",
    valueType: "number",
    valueNumber: 2850,
  }),
  buildAttribute({
    key: "dash_100m_sec",
    label: "100m dash",
    unit: "sec",
    valueType: "number",
    valueNumber: 14.1,
  }),
  buildAttribute({
    key: "pushups_1min",
    label: "Pushups",
    unit: "reps",
    valueType: "number",
    valueNumber: 42,
  }),
  buildAttribute({
    key: "chest_press_1rm_kg",
    label: "Chest press 1RM",
    unit: "kg",
    valueType: "number",
    valueNumber: 92,
  }),
  buildAttribute({
    key: "squat_1rm_kg",
    label: "Squat 1RM",
    unit: "kg",
    valueType: "number",
    valueNumber: 150,
  }),
  buildAttribute({
    key: "deadlift_1rm_kg",
    label: "Deadlift 1RM",
    unit: "kg",
    valueType: "number",
    valueNumber: 170,
  }),
  buildAttribute({
    key: "shoulder_press_1rm_kg",
    label: "Shoulder press 1RM",
    unit: "kg",
    valueType: "number",
    valueNumber: 60,
  }),
  buildAttribute({
    key: "vertical_jump_cm",
    label: "Vertical jump",
    unit: "cm",
    valueType: "number",
    valueNumber: 48,
  }),
  buildAttribute({
    key: "horizontal_jump_cm",
    label: "Horizontal jump",
    unit: "cm",
    valueType: "number",
    valueNumber: 210,
  }),
  buildAttribute({
    key: "sit_and_reach_cm",
    label: "Sit & reach",
    unit: "cm",
    valueType: "number",
    valueNumber: 32,
  }),
];

export async function mockSystemConfig(
  page: Page,
  overrides?: Partial<typeof DEFAULT_SYSTEM_CONFIG>,
) {
  await page.route("**/api/v1/system/config", async (route) => {
    if (route.request().method() !== "GET") {
      return route.fallback();
    }
    const merged = {
      ...DEFAULT_SYSTEM_CONFIG,
      ...overrides,
      features: {
        ...DEFAULT_SYSTEM_CONFIG.features,
        ...(overrides?.features ?? {}),
      },
    };
    return fulfillJson(route, merged);
  });
}

export async function mockCurrentUser(page: Page, overrides?: Partial<typeof DEFAULT_USER>) {
  await page.route("**/api/v1/users/me", async (route) => {
    if (route.request().method() !== "GET") {
      return route.fallback();
    }
    return fulfillJson(route, { ...DEFAULT_USER, ...overrides });
  });
}

const DEFAULT_BIO_MEASUREMENTS = [
  {
    id: "bio-weight",
    key: "weight",
    normalizedKey: "weight",
    label: "Weight",
    description: "Body weight",
    unitType: "weight",
    granularity: "kg",
    measurementSystem: "metric",
    minValueMetric: 20,
    maxValueMetric: 400,
    minValueImperial: 44.09,
    maxValueImperial: 881.85,
    isDefault: true,
    derivedFromAId: null,
    derivedFromBId: null,
    derivedOperator: null,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    latestValue: {
      attributeId: "bio-weight",
      valueNumber: 72.5,
      measuredAt: NOW_ISO,
    },
    isVisible: true,
  },
];

const DEFAULT_PERFORMANCE_MEASUREMENTS = [
  {
    id: "perf-vo2-max",
    key: "vo2_max",
    normalizedKey: "vo2 max",
    label: "VO2 max",
    description: "Maximum oxygen uptake",
    unitType: "ratio",
    granularity: "ml/kg/min",
    measurementSystem: "metric",
    minValueMetric: 10,
    maxValueMetric: 100,
    minValueImperial: 10,
    maxValueImperial: 100,
    isDefault: true,
    derivedFromAId: null,
    derivedFromBId: null,
    derivedOperator: null,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    latestValue: {
      attributeId: "perf-vo2-max",
      valueNumber: 49,
      measuredAt: NOW_ISO,
    },
    isVisible: true,
  },
];

export async function mockMeasurements(page: Page) {
  const installCategory = async (
    category: "biometrics" | "performance",
    defaults: typeof DEFAULT_BIO_MEASUREMENTS,
  ) => {
    await page.route(`**/api/v1/measurements/${category}/attributes**`, async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        return fulfillJson(route, { attributes: defaults });
      }
      if (method === "POST") {
        return fulfillJson(route, { attribute: defaults[0] }, 201);
      }
      return route.fallback();
    });

    await page.route(
      new RegExp(`/api/v1/measurements/${category}/attributes/[^/]+/visibilityimport type { Page, Route } from "@playwright/test";

const NOW_ISO = "2025-10-01T12:00:00.000Z";

const corsHeaders = (route: Route): Record<string, string> => {
  const origin = route.request().headers()["origin"] ?? "http://127.0.0.1:4173";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    vary: "Origin",
  };
};

const fulfillJson = (route: Route, data: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders(route),
    body: JSON.stringify(data),
  });

const DEFAULT_SYSTEM_CONFIG = {
  readOnlyMode: false,
  maintenanceMode: false,
  maintenanceMessage: null,
  features: {
    socialFeed: true,
    coachDashboard: false,
    insights: true,
  },
  timestamp: NOW_ISO,
};

const DEFAULT_USER = {
  id: "user-123",
  username: "ava",
  displayName: "Ava Stone",
  primaryEmail: "ava@example.com",
  role: "athlete",
  email: "ava@example.com",
  roleCode: "athlete",
  status: "active",
  profile: {
    alias: "ava-stone",
    bio: "Training for balance, strength, and joy.",
    weight: 72.5,
    weightUnit: "kg",
    fitnessLevel: "intermediate",
    trainingFrequency: "3_4_per_week",
  },
  avatar: {
    url: "https://example.com/avatar.png",
    mimeType: "image/png",
    bytes: 20480,
    updatedAt: NOW_ISO,
  },
  locale: "en",
  preferredLang: "en",
  defaultVisibility: "followers",
  units: "metric",
};

type UserAttributeValueType = "number" | "text" | "date";

type MockAttributeInput = {
  key: string;
  label: string;
  valueType: UserAttributeValueType;
  valueNumber?: number;
  valueText?: string;
  valueDate?: string;
  unit?: string | null;
};

const buildAttribute = ({
  key,
  label,
  valueType,
  valueNumber,
  valueText,
  valueDate,
  unit = null,
}: MockAttributeInput) => {
  const id = `attr-${key}`;
  return {
    id,
    key,
    label,
    unit,
    valueType,
    minValue: null,
    maxValue: null,
    minLength: null,
    maxLength: null,
    minDate: null,
    maxDate: null,
    createdAt: NOW_ISO,
    latestValue: {
      attributeId: id,
      valueNumber: valueType === "number" ? (valueNumber ?? null) : null,
      valueText: valueType === "text" ? (valueText ?? null) : null,
      valueDate: valueType === "date" ? (valueDate ?? null) : null,
      createdAt: NOW_ISO,
    },
  };
};

const DEFAULT_ATTRIBUTES = [
  buildAttribute({
    key: "display_name",
    label: "Display name",
    valueType: "text",
    valueText: "Ava Stone",
  }),
  buildAttribute({ key: "full_name", label: "Full name", valueType: "text", valueText: "Ava A." }),
  buildAttribute({
    key: "date_of_birth",
    label: "Date of birth",
    valueType: "date",
    valueDate: "1992-08-16",
  }),
  buildAttribute({
    key: "motto",
    label: "Motto",
    valueType: "text",
    valueText: "Consistency beats intensity.",
  }),
  buildAttribute({
    key: "biography",
    label: "Biography",
    valueType: "text",
    valueText: "Coach, climber, and strength enthusiast.",
  }),
  buildAttribute({
    key: "weight_kg",
    label: "Weight",
    unit: "kg",
    valueType: "number",
    valueNumber: 72.5,
  }),
  buildAttribute({
    key: "body_fat_pct",
    label: "Body fat",
    unit: "%",
    valueType: "number",
    valueNumber: 14.2,
  }),
  buildAttribute({
    key: "bone_weight_kg",
    label: "Bone weight",
    unit: "kg",
    valueType: "number",
    valueNumber: 3.1,
  }),
  buildAttribute({
    key: "body_water_pct",
    label: "Body water",
    unit: "%",
    valueType: "number",
    valueNumber: 55.3,
  }),
  buildAttribute({
    key: "height_cm",
    label: "Height",
    unit: "cm",
    valueType: "number",
    valueNumber: 178,
  }),
  buildAttribute({
    key: "chest_circumference_cm",
    label: "Chest",
    unit: "cm",
    valueType: "number",
    valueNumber: 101,
  }),
  buildAttribute({
    key: "waist_circumference_cm",
    label: "Waist",
    unit: "cm",
    valueType: "number",
    valueNumber: 82,
  }),
  buildAttribute({
    key: "hip_circumference_cm",
    label: "Hip",
    unit: "cm",
    valueType: "number",
    valueNumber: 97,
  }),
  buildAttribute({
    key: "bicep_circumference_cm",
    label: "Bicep",
    unit: "cm",
    valueType: "number",
    valueNumber: 36,
  }),
  buildAttribute({
    key: "thigh_circumference_cm",
    label: "Thigh",
    unit: "cm",
    valueType: "number",
    valueNumber: 58,
  }),
  buildAttribute({
    key: "calf_circumference_cm",
    label: "Calf",
    unit: "cm",
    valueType: "number",
    valueNumber: 38,
  }),
  buildAttribute({
    key: "vo2_max",
    label: "VO2 max",
    unit: "ml/kg/min",
    valueType: "number",
    valueNumber: 49,
  }),
  buildAttribute({
    key: "ftp_watts",
    label: "FTP",
    unit: "W",
    valueType: "number",
    valueNumber: 215,
  }),
  buildAttribute({
    key: "run_12min_m",
    label: "12 min run",
    unit: "m",
    valueType: "number",
    valueNumber: 2850,
  }),
  buildAttribute({
    key: "dash_100m_sec",
    label: "100m dash",
    unit: "sec",
    valueType: "number",
    valueNumber: 14.1,
  }),
  buildAttribute({
    key: "pushups_1min",
    label: "Pushups",
    unit: "reps",
    valueType: "number",
    valueNumber: 42,
  }),
  buildAttribute({
    key: "chest_press_1rm_kg",
    label: "Chest press 1RM",
    unit: "kg",
    valueType: "number",
    valueNumber: 92,
  }),
  buildAttribute({
    key: "squat_1rm_kg",
    label: "Squat 1RM",
    unit: "kg",
    valueType: "number",
    valueNumber: 150,
  }),
  buildAttribute({
    key: "deadlift_1rm_kg",
    label: "Deadlift 1RM",
    unit: "kg",
    valueType: "number",
    valueNumber: 170,
  }),
  buildAttribute({
    key: "shoulder_press_1rm_kg",
    label: "Shoulder press 1RM",
    unit: "kg",
    valueType: "number",
    valueNumber: 60,
  }),
  buildAttribute({
    key: "vertical_jump_cm",
    label: "Vertical jump",
    unit: "cm",
    valueType: "number",
    valueNumber: 48,
  }),
  buildAttribute({
    key: "horizontal_jump_cm",
    label: "Horizontal jump",
    unit: "cm",
    valueType: "number",
    valueNumber: 210,
  }),
  buildAttribute({
    key: "sit_and_reach_cm",
    label: "Sit & reach",
    unit: "cm",
    valueType: "number",
    valueNumber: 32,
  }),
];

export async function mockSystemConfig(
  page: Page,
  overrides?: Partial<typeof DEFAULT_SYSTEM_CONFIG>,
) {
  await page.route("**/api/v1/system/config", async (route) => {
    if (route.request().method() !== "GET") {
      return route.fallback();
    }
    const merged = {
      ...DEFAULT_SYSTEM_CONFIG,
      ...overrides,
      features: {
        ...DEFAULT_SYSTEM_CONFIG.features,
        ...(overrides?.features ?? {}),
      },
    };
    return fulfillJson(route, merged);
  });
}

export async function mockCurrentUser(page: Page, overrides?: Partial<typeof DEFAULT_USER>) {
  await page.route("**/api/v1/users/me", async (route) => {
    if (route.request().method() !== "GET") {
      return route.fallback();
    }
    return fulfillJson(route, { ...DEFAULT_USER, ...overrides });
  });
}

),
      async (route) => {
        if (route.request().method() !== "PUT") {
          return route.fallback();
        }
        return route.fulfill({
          status: 204,
          headers: corsHeaders(route),
        });
      },
    );
  };

  await installCategory("biometrics", DEFAULT_BIO_MEASUREMENTS);
  await installCategory("performance", DEFAULT_PERFORMANCE_MEASUREMENTS);
}

export async function mockUserAttributes(
  page: Page,
  overrides?: { attributes?: typeof DEFAULT_ATTRIBUTES },
) {
  await page.route("**/api/v1/users/me/attributes", async (route) => {
    if (route.request().method() !== "GET") {
      return route.fallback();
    }
    return fulfillJson(route, { attributes: overrides?.attributes ?? DEFAULT_ATTRIBUTES });
  });

  await page.route(/\/api\/v1\/users\/me\/attributes\/[^/]+$/, async (route) => {
    if (route.request().method() !== "POST") {
      return route.fallback();
    }
    const attributeId = route.request().url().split("/").pop() ?? "attr-unknown";
    return fulfillJson(route, {
      latestValue: {
        attributeId,
        valueNumber: null,
        valueText: null,
        valueDate: null,
        createdAt: NOW_ISO,
      },
    });
  });
}

export async function mockAuthSessions(page: Page) {
  await page.route("**/api/v1/auth/sessions", async (route) => {
    if (route.request().method() !== "GET") {
      return route.fallback();
    }
    return fulfillJson(route, {
      sessions: [
        {
          id: "session-current",
          userAgent: "Chrome on macOS",
          ip: "10.0.0.12",
          createdAt: "2025-09-20T09:12:00.000Z",
          expiresAt: "2025-12-20T09:12:00.000Z",
          revokedAt: null,
          isCurrent: true,
        },
        {
          id: "session-other",
          userAgent: "Safari on iPhone",
          ip: "10.0.0.24",
          createdAt: "2025-09-08T18:25:00.000Z",
          expiresAt: "2025-12-08T18:25:00.000Z",
          revokedAt: null,
          isCurrent: false,
        },
      ],
    });
  });
}

export async function mock2FAStatus(page: Page, enabled = false) {
  await page.route("**/api/v1/auth/2fa/status", async (route) => {
    if (route.request().method() !== "GET") {
      return route.fallback();
    }
    return fulfillJson(route, { enabled });
  });
}

const DEFAULT_PRIVACY_SETTINGS = {
  defaultVisibility: "followers",
  allowFollowers: true,
  showEmail: false,
  showWeight: false,
  showFitnessLevel: false,
} as const;

export async function mockPrivacySettings(
  page: Page,
  overrides?: Partial<typeof DEFAULT_PRIVACY_SETTINGS>,
) {
  await page.route("**/api/v1/users/me/privacy", async (route) => {
    const method = route.request().method();
    if (method !== "GET" && method !== "PATCH") {
      return route.fallback();
    }
    return fulfillJson(route, { ...DEFAULT_PRIVACY_SETTINGS, ...overrides });
  });
}

export async function mockLegalDocumentsStatus(page: Page) {
  await page.route("**/api/v1/auth/legal-documents/status", async (route) => {
    if (route.request().method() !== "GET") {
      return route.fallback();
    }
    return fulfillJson(route, {
      terms: {
        accepted: true,
        acceptedAt: "2025-10-01T12:00:00.000Z",
        acceptedVersion: "2025-10-01.1",
        currentVersion: "2025-10-01.1",
        requiredVersion: "2025-10-01.1",
        requiredAction: "accept",
        needsAcceptance: false,
      },
      privacy: {
        accepted: true,
        acceptedAt: "2025-10-01T12:00:00.000Z",
        acceptedVersion: "2025-10-01.1",
        currentVersion: "2025-10-01.1",
        requiredVersion: null,
        requiredAction: "none",
        needsAcceptance: false,
      },
    });
  });
}

export async function mockCookieConsent(page: Page) {
  await page.route("**/api/v1/consent/cookie-status", async (route) => {
    if (route.request().method() !== "GET") {
      return route.fallback();
    }
    return fulfillJson(route, {
      success: true,
      data: {
        hasConsent: true,
        consent: {
          essential: true,
          preferences: true,
          analytics: false,
          marketing: false,
          version: "2025-01",
          updatedAt: NOW_ISO,
        },
      },
    });
  });

  await page.route("**/api/v1/consent/cookie-preferences", async (route) => {
    if (route.request().method() !== "POST") {
      return route.fallback();
    }
    return fulfillJson(route, {
      success: true,
      data: {
        essential: true,
        preferences: true,
        analytics: false,
        marketing: false,
        version: "2025-01",
        updatedAt: NOW_ISO,
      },
    });
  });
}

export async function mockFeed(page: Page) {
  await page.route(/\/api\/v1\/feed(\?|$)/, async (route) => {
    if (route.request().method() !== "GET") {
      return route.fallback();
    }
    return fulfillJson(route, {
      items: [
        {
          feedItemId: "feed-1",
          ownerId: "user-maya",
          ownerUsername: "maya",
          ownerDisplayName: "Maya Rivers",
          visibility: "public",
          publishedAt: "2025-09-30T08:15:00.000Z",
          session: {
            id: "session-201",
            title: "Tempo Run",
            completedAt: "2025-09-30T08:15:00.000Z",
            points: 120,
          },
          stats: {
            likes: 18,
            comments: 3,
            viewerHasLiked: false,
            viewerHasBookmarked: false,
          },
        },
        {
          feedItemId: "feed-2",
          ownerId: "user-noah",
          ownerUsername: "noah",
          ownerDisplayName: "Noah Lee",
          visibility: "public",
          publishedAt: "2025-09-28T16:42:00.000Z",
          session: {
            id: "session-202",
            title: "Upper Strength",
            completedAt: "2025-09-28T16:42:00.000Z",
            points: 210,
          },
          stats: {
            likes: 42,
            comments: 8,
            viewerHasLiked: true,
            viewerHasBookmarked: false,
          },
        },
      ],
      total: 2,
      limit: 20,
      offset: 0,
    });
  });
}

export async function mockSession(page: Page, sessionId = "session-123") {
  const session = {
    id: sessionId,
    owner_id: "user-123",
    title: "Leg Day Circuit",
    planned_at: "2025-10-01T09:00:00.000Z",
    status: "planned" as const,
    visibility: "private" as const,
    notes: "Focus on tempo.",
    started_at: null,
    completed_at: null,
    exercises: [
      {
        id: "ex-1",
        session_id: sessionId,
        exercise_id: "exercise-squat",
        order_index: 0,
        notes: "Focus on tempo.",
        planned: { sets: 2, reps: 6, load: 95, rpe: 8, rest: "90 sec" },
        sets: [
          { id: "set-1", order_index: 0, reps: 6, weight_kg: 90, rpe: 7, notes: null },
          { id: "set-2", order_index: 1, reps: 6, weight_kg: 95, rpe: 8, notes: null },
        ],
      },
      {
        id: "ex-2",
        session_id: sessionId,
        exercise_id: "exercise-rdl",
        order_index: 1,
        notes: null,
        planned: { sets: 2, reps: 8, load: 75, rpe: 8, rest: "90 sec" },
        sets: [
          { id: "set-3", order_index: 0, reps: 8, weight_kg: 70, rpe: 7, notes: null },
          { id: "set-4", order_index: 1, reps: 8, weight_kg: 75, rpe: 8, notes: null },
        ],
      },
    ],
  };

  await page.route(new RegExp(`/api/v1/sessions/${sessionId}$`), async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      return fulfillJson(route, session);
    }
    if (method === "PATCH") {
      return fulfillJson(route, { ...session, status: "in_progress", started_at: NOW_ISO });
    }
    return route.fallback();
  });
}

export async function mockProgress(page: Page) {
  await page.route("**/api/v1/progress/summary**", async (route) => {
    if (route.request().method() !== "GET") {
      return route.fallback();
    }
    return fulfillJson(route, {
      totalSessions: 18,
      totalVolume: 32500,
      currentStreak: 8,
      personalRecords: [
        {
          exerciseName: "Back squat",
          value: 180,
          unit: "kg",
          achievedAt: "2025-08-20",
          visibility: "public",
        },
        {
          exerciseName: "Bench press",
          value: 115,
          unit: "kg",
          achievedAt: "2025-09-10",
          visibility: "public",
        },
        {
          exerciseName: "Deadlift",
          value: 210,
          unit: "kg",
          achievedAt: "2025-09-17",
          visibility: "public",
        },
      ],
      streakChange: 2,
      sessionsChange: 1,
      volumeChange: 1200,
    });
  });

  await page.route("**/api/v1/progress/trends**", async (route) => {
    if (route.request().method() !== "GET") {
      return route.fallback();
    }
    return fulfillJson(route, [
      { label: "Week 40", date: "2025-09-28", volume: 12500, sessions: 4, avgIntensity: 7 },
      { label: "Week 39", date: "2025-09-21", volume: 12010, sessions: 4, avgIntensity: 6.5 },
      { label: "Week 38", date: "2025-09-14", volume: 11840, sessions: 3, avgIntensity: 6.8 },
    ]);
  });
}

export async function mockExercises(page: Page) {
  await page.route("**/api/v1/exercises**", async (route) => {
    if (route.request().method() !== "GET") {
      return route.fallback();
    }
    return fulfillJson(route, {
      data: [
        {
          id: "exercise-squat",
          name: "Back Squat",
          type_code: "strength",
          owner_id: null,
          muscle_group: "legs",
          equipment: "barbell",
          tags: ["compound"],
          is_public: true,
          description_en: "Barbell back squat",
          description_de: null,
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });
  });
}

export async function mockSessionsList(page: Page) {
  await page.route(/\/api\/v1\/sessions(\?|$)/, async (route) => {
    if (route.request().method() !== "GET") {
      return route.fallback();
    }
    return fulfillJson(route, {
      data: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
  });
}

export async function mockLogout(page: Page) {
  await page.route("**/api/v1/auth/logout", async (route) => {
    return fulfillJson(route, { success: true });
  });
}

export async function mockAuthRefresh(page: Page) {
  await page.route("**/api/v1/auth/refresh", async (route) => {
    return fulfillJson(route, { success: true });
  });
}

/**
 * Installs a catch-all API stub, then overlays page-specific fixtures.
 * Register this before navigation so unmocked endpoints cannot hang networkidle.
 */
export async function installDefaultMocks(page: Page): Promise<void> {
  // Keep avatar rendering deterministic and independent of external network access.
  await page.route("https://example.com/avatar.png", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
        <rect width="256" height="256" fill="#167c5a"/>
        <text x="128" y="145" text-anchor="middle" font-family="Arial, sans-serif" font-size="82" font-weight="700" fill="#ffffff">AS</text>
      </svg>`,
    });
  });

  await page.route("**/api/**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: corsHeaders(route),
      });
    }
    return fulfillJson(route, {});
  });

  await mockSystemConfig(page);
  await mockCurrentUser(page);
  await mockUserAttributes(page);
  await mockMeasurements(page);
  await mockAuthSessions(page);
  await mockAuthRefresh(page);
  await mock2FAStatus(page, false);
  await mockLegalDocumentsStatus(page);
  await mockPrivacySettings(page);
  await mockCookieConsent(page);
  await mockFeed(page);
  await mockSession(page);
  await mockProgress(page);
  await mockExercises(page);
  await mockSessionsList(page);
  await mockLogout(page);
}
