import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const API_VERSION = process.env.API_VERSION ?? "1.0.0";

const info = {
  title: "FitVibe API",
  version: API_VERSION,
  description:
    "OpenAPI specification for the FitVibe REST API. Generated from documentation anchors until automated zod-to-openapi wiring is complete.",
  contact: {
    name: "FitVibe Engineering",
    url: "https://fitvibe.app",
    email: "engineering@fitvibe.app",
  },
  license: {
    name: "MIT",
    url: "https://opensource.org/licenses/MIT",
  },
};

const jsonContent = (schemaRef) => ({
  content: {
    "application/json": {
      schema: {
        $ref: schemaRef,
      },
    },
  },
});

const bearerAuth = {
  bearerAuth: [],
};

const sessionIdParameter = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
};

// Mirrors the zod schemas in sessions.controller.ts; tests/backend/contract checks them.
const nullable = (schema) => ({ ...schema, nullable: true });
const intervalString = nullable({
  type: "string",
  description: "ISO-8601 duration (e.g. PT90S) or HH:MM[:SS].",
});
const plannedAttributes = {
  sets: nullable({ type: "integer", minimum: 0 }),
  reps: nullable({ type: "integer", minimum: 0 }),
  load: nullable({ type: "number", minimum: 0 }),
  distance: nullable({ type: "number", minimum: 0 }),
  duration: intervalString,
  rpe: nullable({ type: "integer", minimum: 1, maximum: 10 }),
  rest: intervalString,
  extras: { type: "object", additionalProperties: true },
};
// ADR-042: a set's prescription; the top-level set fields hold performed values.
const plannedSetValuesObject = nullable({
  type: "object",
  description: "The set's prescription (targets). Performed values are the top-level set fields.",
  properties: {
    reps: nullable({ type: "integer", minimum: 0 }),
    weight_kg: nullable({ type: "number", minimum: 0 }),
    distance_m: nullable({ type: "number", minimum: 0 }),
    duration_sec: nullable({ type: "integer", minimum: 0 }),
    rpe: nullable({ type: "integer", minimum: 1, maximum: 10 }),
    rest_sec: nullable({ type: "integer", minimum: 0 }),
  },
  additionalProperties: false,
});
const setStatusSchema = {
  type: "string",
  enum: ["planned", "completed", "skipped"],
  description: "Only completed sets are performed work and count for scoring (ADR-042).",
};
const setSourceSchema = {
  type: "string",
  enum: ["prescribed", "added"],
  description: "prescribed: part of the plan; added: added while training.",
};
const completionOutcomeSchema = {
  type: "string",
  enum: ["completed", "stopped_early"],
  description: "How a completed session ended. Neither outcome counts as failure.",
};

const plannedAttributesObject = nullable({
  type: "object",
  properties: plannedAttributes,
  additionalProperties: false,
});
const actualAttributesObject = nullable({
  type: "object",
  properties: {
    ...plannedAttributes,
    recorded_at: nullable({ type: "string", format: "date-time" }),
  },
  additionalProperties: false,
});

const paths = {
  "/auth/register/options": {
    get: {
      summary: "Get registration reference options",
      tags: ["Auth"],
      responses: {
        200: jsonContent("#/components/schemas/RegistrationOptions"),
        500: jsonContent("#/components/schemas/ErrorResponse"),
      },
    },
  },
  "/auth/register": {
    post: {
      summary: "Start email-first registration (ADR-039)",
      description:
        "Step 1. Accepts only an address and always answers 202 with the same body. The outcome is delivered by email: a continue link for a new address, a notice for an existing account.",
      tags: ["Auth"],
      requestBody: jsonContent("#/components/schemas/StartRegistrationRequest"),
      responses: {
        202: jsonContent("#/components/schemas/RegistrationStartedResponse"),
        400: jsonContent("#/components/schemas/ErrorResponse"),
        429: jsonContent("#/components/schemas/ErrorResponse"),
      },
    },
  },
  "/auth/register/intent": {
    post: {
      summary: "Look up the address an emailed registration link belongs to",
      tags: ["Auth"],
      requestBody: jsonContent("#/components/schemas/RegistrationIntentRequest"),
      responses: {
        200: jsonContent("#/components/schemas/RegistrationIntentResponse"),
        400: jsonContent("#/components/schemas/ErrorResponse"),
        410: jsonContent("#/components/schemas/ErrorResponse"),
      },
    },
  },
  "/auth/register/complete": {
    post: {
      summary: "Finish registration for the holder of an emailed link",
      description:
        "Step 2. Creates an active, verified account and consumes the link. A taken username is reported because the caller has proved mailbox ownership.",
      tags: ["Auth"],
      requestBody: {
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CompleteRegistrationRequest" },
          },
          "multipart/form-data": {
            schema: {
              type: "object",
              properties: {
                payload: {
                  type: "string",
                  description: "JSON-encoded CompleteRegistrationRequest payload",
                },
                avatar: {
                  type: "string",
                  format: "binary",
                  description: "Optional JPEG, PNG, or WebP profile photo up to 5 MB",
                },
              },
              required: ["payload"],
            },
          },
        },
      },
      responses: {
        201: jsonContent("#/components/schemas/RegistrationCompletedResponse"),
        400: jsonContent("#/components/schemas/ErrorResponse"),
        409: jsonContent("#/components/schemas/ErrorResponse"),
        410: jsonContent("#/components/schemas/ErrorResponse"),
        422: jsonContent("#/components/schemas/ErrorResponse"),
      },
    },
  },
  "/auth/login": {
    post: {
      summary: "Login with credentials",
      tags: ["Auth"],
      requestBody: jsonContent("#/components/schemas/LoginRequest"),
      responses: {
        200: jsonContent("#/components/schemas/AuthSuccessResponse"),
        401: jsonContent("#/components/schemas/ErrorResponse"),
      },
    },
  },
  "/auth/refresh": {
    post: {
      summary: "Refresh access token",
      tags: ["Auth"],
      security: [bearerAuth],
      requestBody: jsonContent("#/components/schemas/RefreshRequest"),
      responses: {
        200: jsonContent("#/components/schemas/AuthSuccessResponse"),
        401: jsonContent("#/components/schemas/ErrorResponse"),
      },
    },
  },
  "/auth/logout": {
    post: {
      summary: "Logout current session",
      tags: ["Auth"],
      security: [bearerAuth],
      responses: {
        204: { description: "Logged out" },
        401: jsonContent("#/components/schemas/ErrorResponse"),
      },
    },
  },
  "/users/me": {
    get: {
      summary: "Get current user profile",
      tags: ["Users"],
      security: [bearerAuth],
      responses: {
        200: jsonContent("#/components/schemas/UserProfile"),
        401: jsonContent("#/components/schemas/ErrorResponse"),
      },
    },
    patch: {
      summary: "Update profile",
      tags: ["Users"],
      security: [bearerAuth],
      requestBody: jsonContent("#/components/schemas/UpdateProfileRequest"),
      responses: {
        200: jsonContent("#/components/schemas/UserProfile"),
        401: jsonContent("#/components/schemas/ErrorResponse"),
        403: jsonContent("#/components/schemas/ErrorResponse"),
        422: jsonContent("#/components/schemas/ErrorResponse"),
      },
    },
  },
  "/users/me/preferences": {
    get: {
      summary: "Get user preferences",
      tags: ["Users"],
      security: [bearerAuth],
      responses: {
        200: jsonContent("#/components/schemas/UserPreferences"),
        401: jsonContent("#/components/schemas/ErrorResponse"),
      },
    },
    patch: {
      summary: "Update user preferences",
      tags: ["Users"],
      security: [bearerAuth],
      requestBody: jsonContent("#/components/schemas/UpdatePreferencesRequest"),
      responses: {
        200: jsonContent("#/components/schemas/UserPreferences"),
        400: jsonContent("#/components/schemas/ErrorResponse"),
        401: jsonContent("#/components/schemas/ErrorResponse"),
      },
    },
  },
  "/users/{alias}": {
    get: {
      summary: "Get public profile by alias",
      tags: ["Users"],
      parameters: [
        {
          name: "alias",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      ],
      responses: {
        200: jsonContent("#/components/schemas/PublicProfile"),
        404: jsonContent("#/components/schemas/ErrorResponse"),
      },
    },
  },
  "/exercises": {
    get: {
      summary: "List exercises",
      tags: ["Exercises"],
      security: [bearerAuth],
      parameters: [
        {
          name: "page",
          in: "query",
          schema: { type: "integer", minimum: 1, default: 1 },
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        },
      ],
      responses: {
        200: jsonContent("#/components/schemas/ExerciseListResponse"),
      },
    },
    post: {
      summary: "Create exercise",
      tags: ["Exercises"],
      security: [bearerAuth],
      requestBody: jsonContent("#/components/schemas/ExerciseUpsertRequest"),
      responses: {
        201: jsonContent("#/components/schemas/Exercise"),
        400: jsonContent("#/components/schemas/ErrorResponse"),
      },
    },
  },
  "/exercises/{id}": {
    put: {
      summary: "Update exercise",
      tags: ["Exercises"],
      security: [bearerAuth],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      requestBody: jsonContent("#/components/schemas/ExerciseUpsertRequest"),
      responses: {
        200: jsonContent("#/components/schemas/Exercise"),
        404: jsonContent("#/components/schemas/ErrorResponse"),
      },
    },
    delete: {
      summary: "Archive exercise",
      tags: ["Exercises"],
      security: [bearerAuth],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        204: { description: "Archived" },
        404: jsonContent("#/components/schemas/ErrorResponse"),
      },
    },
  },
  "/sessions": {
    get: {
      summary: "List sessions",
      tags: ["Sessions"],
      security: [bearerAuth],
      parameters: [
        {
          name: "status",
          in: "query",
          schema: { $ref: "#/components/schemas/SessionStatus" },
        },
      ],
      responses: {
        200: jsonContent("#/components/schemas/SessionListResponse"),
      },
    },
    post: {
      summary: "Create session",
      tags: ["Sessions"],
      security: [bearerAuth],
      requestBody: jsonContent("#/components/schemas/SessionCreateRequest"),
      responses: {
        201: jsonContent("#/components/schemas/Session"),
        400: jsonContent("#/components/schemas/ErrorResponse"),
      },
    },
  },
  "/sessions/{id}": {
    patch: {
      summary: "Update a session (details, schedule, status, exercises)",
      description: [
        "Partial update: only the fields sent change. There is no ETag or If-Match check; the last write wins.",
        "",
        "Scheduling: a session occupies [planned_at, planned_at + planned_duration_min). A change of `planned_at` or `planned_duration_min` that overlaps another active session of the same user is refused with 422 `E.SESSION.SCHEDULE_CONFLICT`, listing the blocking sessions in `error.details.conflictingSessionIds`. Back-to-back sessions do not conflict; canceled sessions occupy no time; a session being canceled is not checked.",
        "",
        "Status: allowed transitions are planned → in_progress | completed | canceled and in_progress → completed | canceled. `started_at` and `completed_at` default to the time of the change. Changing a completed session's plan, schedule, timestamps, calories or exercises requires reopening it first (409 `E.SESSION.REOPEN_REQUIRED`).",
        "",
        "Sending `exercises` replaces the session's exercises and sets.",
      ].join("\n"),
      tags: ["Sessions"],
      security: [bearerAuth],
      parameters: [sessionIdParameter],
      requestBody: jsonContent("#/components/schemas/SessionUpdateRequest"),
      responses: {
        200: {
          description: "The updated session with its exercises.",
          ...jsonContent("#/components/schemas/SessionWithExercises"),
        },
        400: {
          description:
            "Invalid body (`error` is the zod field report), an invalid status transition (`E.SESSION.INVALID_STATUS`) or a plan the user does not own (`E.SESSION.INVALID_PLAN`).",
          content: {
            "application/json": {
              schema: {
                oneOf: [
                  { $ref: "#/components/schemas/ErrorResponse" },
                  { $ref: "#/components/schemas/ValidationErrorResponse" },
                ],
              },
            },
          },
        },
        401: {
          description: "Missing or invalid access token.",
          ...jsonContent("#/components/schemas/ErrorResponse"),
        },
        403: {
          description: "CSRF check failed.",
          ...jsonContent("#/components/schemas/ErrorResponse"),
        },
        404: {
          description: "`E.SESSION.NOT_FOUND`.",
          ...jsonContent("#/components/schemas/ErrorResponse"),
        },
        409: {
          description:
            "`E.SESSION.REOPEN_REQUIRED`: reopen the completed session before correcting it.",
          ...jsonContent("#/components/schemas/ErrorResponse"),
        },
        422: {
          description: "`E.SESSION.SCHEDULE_CONFLICT`: the new time overlaps other sessions.",
          ...jsonContent("#/components/schemas/ScheduleConflictResponse"),
        },
        429: {
          description: "`RATE_LIMITED`; see `Retry-After`.",
          ...jsonContent("#/components/schemas/ErrorResponse"),
        },
      },
    },
  },
  "/sessions/{id}/estimate": {
    get: {
      summary: "Estimate planned session duration and intensity",
      tags: ["Sessions"],
      security: [bearerAuth],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        200: jsonContent("#/components/schemas/SessionEstimate"),
        404: jsonContent("#/components/schemas/ErrorResponse"),
      },
    },
  },
  "/sessions/{id}/reopen": {
    post: {
      summary: "Reopen a completed session for correction",
      tags: ["Sessions"],
      security: [bearerAuth],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        200: jsonContent("#/components/schemas/Session"),
        404: jsonContent("#/components/schemas/ErrorResponse"),
        409: jsonContent("#/components/schemas/ErrorResponse"),
      },
    },
  },
  "/sessions/{id}/complete": {
    patch: {
      summary: "Mark session complete",
      tags: ["Sessions"],
      security: [bearerAuth],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      requestBody: jsonContent("#/components/schemas/SessionCompleteRequest"),
      responses: {
        200: jsonContent("#/components/schemas/Session"),
        404: jsonContent("#/components/schemas/ErrorResponse"),
      },
    },
  },
  "/vibeforms/me": {
    get: {
      summary: "Get the current user's normalized Vibeform",
      tags: ["Vibeforms"],
      security: [bearerAuth],
      responses: {
        200: jsonContent("#/components/schemas/VibeformProfile"),
        401: jsonContent("#/components/schemas/ErrorResponse"),
      },
    },
  },
  "/vibeforms/me/preferences": {
    put: {
      summary: "Update the current user's Vibeform preferences",
      tags: ["Vibeforms"],
      security: [bearerAuth],
      requestBody: jsonContent("#/components/schemas/UpdateVibeformPreferencesRequest"),
      responses: {
        200: jsonContent("#/components/schemas/VibeformPreferences"),
        400: jsonContent("#/components/schemas/ErrorResponse"),
        401: jsonContent("#/components/schemas/ErrorResponse"),
      },
    },
  },
  "/client-errors": {
    post: {
      summary: "Report a browser error (ADR-040)",
      description:
        "Public, CSRF-protected and rate-limited. Reports carry no identity; the server strips query strings, fragments and email addresses before logging.",
      tags: ["System"],
      requestBody: jsonContent("#/components/schemas/ClientErrorReportRequest"),
      responses: {
        204: { description: "Report recorded" },
        400: jsonContent("#/components/schemas/ErrorResponse"),
        403: jsonContent("#/components/schemas/ErrorResponse"),
        429: jsonContent("#/components/schemas/ErrorResponse"),
      },
    },
  },
  "/health": {
    get: {
      summary: "Liveness probe",
      tags: ["System"],
      responses: {
        200: {
          description: "Service healthy",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", example: "ok" },
                },
              },
            },
          },
        },
      },
    },
  },
  "/metrics": {
    get: {
      summary: "Prometheus metrics",
      tags: ["System"],
      responses: {
        200: {
          description: "Prometheus exposition format",
          content: {
            "text/plain": {
              schema: { type: "string" },
            },
          },
        },
      },
    },
  },
};

const schemas = {
  ErrorResponse: {
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          code: { type: "string", example: "E.AUTH.INVALID_CREDENTIALS" },
          message: { type: "string" },
          details: { type: "object", additionalProperties: true },
          requestId: { type: "string", format: "uuid" },
        },
        required: ["code", "message"],
      },
    },
    required: ["error"],
  },
  VibeformPreferences: {
    type: "object",
    properties: {
      templateCode: { type: "string", enum: ["flow"] },
      templateVersion: { type: "integer", minimum: 1 },
      bodyProfile: {
        type: "string",
        enum: ["shoulder-dominant", "balanced", "hip-dominant"],
      },
      motionEnabled: { type: "boolean" },
    },
    required: ["templateCode", "templateVersion", "bodyProfile", "motionEnabled"],
    additionalProperties: false,
  },
  UpdateVibeformPreferencesRequest: {
    type: "object",
    properties: {
      templateCode: { type: "string", enum: ["flow"] },
      bodyProfile: {
        type: "string",
        enum: ["shoulder-dominant", "balanced", "hip-dominant"],
      },
      motionEnabled: { type: "boolean" },
    },
    minProperties: 1,
    additionalProperties: false,
  },
  VibeformMetrics: {
    type: "object",
    properties: {
      intelligence: { type: "number", minimum: 0, maximum: 1 },
      regeneration: { type: "number", minimum: 0, maximum: 1 },
      agility: { type: "number", minimum: 0, maximum: 1 },
      explosivity: { type: "number", minimum: 0, maximum: 1 },
      endurance: { type: "number", minimum: 0, maximum: 1 },
      strength: { type: "number", minimum: 0, maximum: 1 },
      upperBodyLoad: { type: "number", minimum: 0, maximum: 1 },
      lowerBodyLoad: { type: "number", minimum: 0, maximum: 1 },
      bmi: { type: ["number", "null"] },
      heightCm: { type: ["number", "null"] },
    },
    required: [
      "intelligence",
      "regeneration",
      "agility",
      "explosivity",
      "endurance",
      "strength",
      "upperBodyLoad",
      "lowerBodyLoad",
      "bmi",
      "heightCm",
    ],
    additionalProperties: false,
  },
  VibeformProfile: {
    type: "object",
    properties: {
      preferences: { $ref: "#/components/schemas/VibeformPreferences" },
      metrics: { $ref: "#/components/schemas/VibeformMetrics" },
      calculationVersion: { type: "string" },
      calculatedAt: { type: "string", format: "date-time" },
    },
    required: ["preferences", "metrics", "calculationVersion", "calculatedAt"],
    additionalProperties: false,
  },
  AuthSuccessResponse: {
    type: "object",
    properties: {
      accessToken: { type: "string", description: "JWT access token" },
      refreshToken: { type: "string", description: "JWT refresh token" },
      expiresIn: { type: "integer", example: 900 },
    },
    required: ["accessToken", "refreshToken", "expiresIn"],
  },
  RegistrationReferenceOption: {
    type: "object",
    properties: {
      code: { type: "string" },
      description: { type: "string" },
    },
    required: ["code", "description"],
    additionalProperties: false,
  },
  RegistrationOptions: {
    type: "object",
    properties: {
      genders: {
        type: "array",
        items: { $ref: "#/components/schemas/RegistrationReferenceOption" },
      },
      fitnessLevels: {
        type: "array",
        items: { $ref: "#/components/schemas/RegistrationReferenceOption" },
      },
      weight: {
        type: "object",
        properties: {
          minKg: { type: "number" },
          maxKg: { type: "number" },
        },
        required: ["minKg", "maxKg"],
        additionalProperties: false,
      },
    },
    required: ["genders", "fitnessLevels", "weight"],
    additionalProperties: false,
  },
  ClientErrorReportRequest: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["error", "unhandledrejection", "logger"] },
      message: { type: "string", minLength: 1, maxLength: 1000 },
      stack: { type: "string", maxLength: 4000 },
      source: { type: "string", maxLength: 500 },
      route: { type: "string", pattern: "^/", maxLength: 200 },
    },
    required: ["kind", "message", "route"],
    additionalProperties: false,
  },
  StartRegistrationRequest: {
    type: "object",
    properties: {
      email: { type: "string", format: "email", maxLength: 254 },
      locale: {
        type: "string",
        pattern: "^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$",
        description: "UI language of the request; used for the email it sends.",
      },
    },
    required: ["email"],
    additionalProperties: false,
  },
  RegistrationStartedResponse: {
    type: "object",
    properties: { message: { type: "string" } },
    required: ["message"],
    additionalProperties: false,
  },
  RegistrationIntentRequest: {
    type: "object",
    properties: {
      token: { type: "string", minLength: 20, maxLength: 128, pattern: "^[A-Za-z0-9_-]+$" },
    },
    required: ["token"],
    additionalProperties: false,
  },
  RegistrationIntentResponse: {
    type: "object",
    properties: {
      email: { type: "string", format: "email" },
      expiresAt: { type: "string", format: "date-time" },
    },
    required: ["email", "expiresAt"],
    additionalProperties: false,
  },
  RegistrationCompletedResponse: {
    type: "object",
    properties: {
      user: { type: "object", additionalProperties: true },
      passwordWarning: { type: "string", enum: ["PASSWORD_BREACHED", "BREACH_CHECK_UNAVAILABLE"] },
    },
    required: ["user"],
    additionalProperties: false,
  },
  CompleteRegistrationRequest: {
    type: "object",
    properties: {
      token: { type: "string", minLength: 20, maxLength: 128, pattern: "^[A-Za-z0-9_-]+$" },
      alias: {
        type: "string",
        minLength: 3,
        maxLength: 50,
        pattern: "^[a-zA-Z0-9_\\-.]+$",
      },
      username: {
        type: "string",
        minLength: 3,
        maxLength: 50,
        pattern: "^[a-zA-Z0-9_\\-.]+$",
      },
      password: {
        type: "string",
        minLength: 12,
        maxLength: 128,
        allOf: [
          { pattern: "(?=.*[a-z])" },
          { pattern: "(?=.*[A-Z])" },
          { pattern: "(?=.*\\d)" },
          { pattern: "(?=.*[^\\w\\s])" },
        ],
      },
      profile: {
        type: "object",
        properties: {
          display_name: { type: "string", minLength: 1, maxLength: 100 },
          sex: {
            type: "string",
            description: "Opaque reference code validated against the genders catalog.",
          },
          weight_kg: {
            type: "number",
            description: "Validated against the configured weight bio-attribute range.",
          },
          fitness_level: {
            type: "string",
            description: "Opaque reference code validated against the fitness_levels catalog.",
          },
          date_of_birth: { type: "string", format: "date" },
          age: { type: "integer", minimum: 13, maximum: 120, deprecated: true },
        },
        additionalProperties: false,
      },
      terms_accepted: { type: "boolean" },
    },
    required: ["token", "password", "terms_accepted"],
    additionalProperties: false,
  },
  LoginRequest: {
    type: "object",
    properties: {
      email: { type: "string", minLength: 1, maxLength: 254 },
      password: { type: "string", minLength: 1 },
    },
    required: ["email", "password"],
    additionalProperties: false,
  },
  ForgotPasswordRequest: {
    type: "object",
    properties: {
      email: { type: "string", format: "email" },
    },
    required: ["email"],
  },
  ResetPasswordRequest: {
    type: "object",
    properties: {
      token: { type: "string", minLength: 1 },
      newPassword: {
        type: "string",
        minLength: 12,
        maxLength: 128,
      },
    },
    required: ["token", "newPassword"],
  },
  ResendVerificationRequest: {
    type: "object",
    properties: {
      email: { type: "string", format: "email" },
    },
    required: ["email"],
  },
  Verify2FALoginRequest: {
    type: "object",
    properties: {
      pendingSessionId: { type: "string", format: "uuid" },
      code: {
        type: "string",
        minLength: 6,
        maxLength: 9,
        pattern: "^(?:\\\\d{6}|[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4})$",
      },
    },
    required: ["pendingSessionId", "code"],
  },
  ReportFeedItemRequest: {
    type: "object",
    properties: {
      reason: { type: "string", minLength: 1, maxLength: 200 },
      details: { type: "string", maxLength: 500 },
    },
    required: ["reason"],
  },
  CreateUserRequest: {
    type: "object",
    properties: {
      username: { type: "string", minLength: 3, maxLength: 50 },
      displayName: { type: "string", minLength: 1, maxLength: 120 },
      email: { type: "string", format: "email", maxLength: 254 },
      password: { type: "string", minLength: 12, maxLength: 128 },
      // Keep in sync with users.types.ts ADMIN_CREATABLE_ROLES; OpenAPI contract tests enforce this.
      role: { type: "string", enum: ["athlete", "coach", "support"] },
      locale: { type: "string", maxLength: 10 },
      preferredLang: { type: "string", enum: ["en", "de", "fr", "es", "el"] },
      status: { type: "string", enum: ["pending_verification", "active", "suspended"] },
    },
    required: ["username", "displayName", "email", "password", "role"],
  },
  CreateExerciseTypeRequest: {
    type: "object",
    properties: {
      code: { type: "string", minLength: 2, maxLength: 30 },
      name: { type: "string", minLength: 3, maxLength: 100 },
      description: { type: "string", maxLength: 255 },
    },
    required: ["code", "name"],
  },
  RefreshRequest: {
    type: "object",
    properties: {
      refreshToken: { type: "string" },
    },
    required: ["refreshToken"],
  },
  UserProfile: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      email: { type: "string", format: "email" },
      alias: { type: "string" },
      status: {
        type: "string",
        enum: [
          "pending_verification",
          "active",
          "suspended",
          "banned",
          "pending_deletion",
          "deleted",
        ],
      },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
      met_value: { type: ["number", "null"], minimum: 0.1, maximum: 30 },
      seconds_per_rep: { type: ["number", "null"], minimum: 0.1, maximum: 120 },
    },
    required: ["id", "email", "alias", "status", "createdAt"],
  },
  PublicProfile: {
    type: "object",
    properties: {
      alias: { type: "string" },
      bio: { type: "string" },
      avatarUrl: { type: "string", format: "uri" },
      stats: {
        type: "object",
        properties: {
          completedSessions: { type: "integer" },
          badges: { type: "integer" },
        },
      },
    },
    required: ["alias"],
  },
  UserPreferences: {
    type: "object",
    properties: {
      language: { type: "string", enum: ["en", "de", "fr", "es", "el"] },
      measurementSystem: { type: "string", enum: ["metric", "imperial"] },
    },
    required: ["language", "measurementSystem"],
    additionalProperties: false,
  },
  UpdateProfileRequest: {
    type: "object",
    properties: {
      username: { type: "string", minLength: 3, maxLength: 50 },
      displayName: { type: "string", minLength: 1, maxLength: 120 },
      bio: { type: "string", maxLength: 500 },
      alias: { type: "string", minLength: 3, maxLength: 32 },
      weight: {
        type: "number",
        exclusiveMinimum: 0,
        description: "Weight in weightUnit; must be within the 20–400 kg equivalent range.",
      },
      weightUnit: { type: "string", enum: ["kg", "lb"] },
      fitnessLevel: { type: "string", enum: ["beginner", "intermediate", "advanced", "elite"] },
      trainingFrequency: {
        type: "string",
        enum: ["rarely", "1_2_per_week", "3_4_per_week", "5_plus_per_week"],
      },
    },
    allOf: [
      {
        if: {
          properties: { weightUnit: { const: "lb" } },
          required: ["weightUnit"],
        },
        then: {
          properties: { weight: { minimum: 44.09, maximum: 881.85 } },
        },
        else: {
          properties: { weight: { minimum: 20, maximum: 400 } },
        },
      },
    ],
    additionalProperties: false,
  },
  UpdatePreferencesRequest: {
    type: "object",
    properties: {
      language: { type: "string", enum: ["en", "de", "fr", "es", "el"] },
      measurementSystem: { type: "string", enum: ["metric", "imperial"] },
    },
    additionalProperties: false,
  },
  Exercise: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      name: { type: "string" },
      description: { type: "string" },
      ownerId: { type: "string", format: "uuid", nullable: true },
      tags: {
        type: "array",
        items: { type: "string" },
      },
      visibility: { type: "string", enum: ["private", "public"] },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
    required: ["id", "name", "visibility", "createdAt"],
  },
  ExerciseUpsertRequest: {
    type: "object",
    properties: {
      name: { type: "string" },
      description: { type: "string" },
      visibility: { type: "string", enum: ["private", "public"] },
      tags: {
        type: "array",
        items: { type: "string" },
      },
      muscleGroups: {
        type: "array",
        items: { type: "string" },
      },
      met_value: { type: ["number", "null"], minimum: 0.1, maximum: 30 },
      seconds_per_rep: { type: ["number", "null"], minimum: 0.1, maximum: 120 },
    },
    required: ["name", "visibility"],
  },
  ExerciseListResponse: {
    type: "object",
    properties: {
      data: {
        type: "array",
        items: { $ref: "#/components/schemas/Exercise" },
      },
      meta: {
        type: "object",
        properties: {
          page: { type: "integer" },
          limit: { type: "integer" },
          total: { type: "integer" },
        },
      },
    },
    required: ["data", "meta"],
  },
  SessionStatus: {
    type: "string",
    enum: ["planned", "in_progress", "completed", "canceled"],
  },
  Session: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      planId: { type: "string", format: "uuid", nullable: true },
      status: { $ref: "#/components/schemas/SessionStatus" },
      scheduledAt: { type: "string", format: "date-time" },
      completedAt: { type: "string", format: "date-time", nullable: true },
      notes: { type: "string" },
      visibility: { type: "string", enum: ["private", "followers", "public"] },
    },
    required: ["id", "status", "scheduledAt"],
  },
  SessionCreateRequest: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["planned", "completed"],
        description:
          "completed logs a past workout in one request: started_at = planned_at, completed_at = planned_at + planned_duration_min (not later than now). planned_at must not be in the future (422 E.SESSION.LOG_IN_FUTURE).",
      },
      completion_outcome: {
        ...completionOutcomeSchema,
        description: "Only with status completed; defaults to completed.",
      },
      plan_id: { type: "string", format: "uuid", nullable: true },
      title: { type: "string", minLength: 2, maxLength: 100, nullable: true },
      planned_at: { type: "string", format: "date-time" },
      planned_duration_min: {
        type: "integer",
        minimum: 5,
        maximum: 720,
        description: "Planned length in minutes; defaults to 60.",
      },
      visibility: { type: "string", enum: ["private", "followers", "public", "link"] },
      notes: { type: "string", maxLength: 1000, nullable: true },
      recurrence_rule: { type: "string", maxLength: 255, nullable: true },
      exercises: {
        type: "array",
        items: { $ref: "#/components/schemas/SessionExerciseInput" },
      },
    },
    required: ["planned_at"],
  },
  SessionExerciseInput: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      exercise_id: nullable({ type: "string", format: "uuid" }),
      order: { type: "integer", minimum: 1 },
      notes: nullable({ type: "string", maxLength: 1000 }),
      planned: plannedAttributesObject,
      actual: actualAttributesObject,
      sets: {
        type: "array",
        maxItems: 100,
        items: { $ref: "#/components/schemas/SessionSetInput" },
      },
    },
    required: ["order"],
    additionalProperties: false,
  },
  SessionSetInput: {
    type: "object",
    description:
      "Without status, a set with recorded_at is completed and any other set is planned. For compatibility, a planned set whose targets are in the top-level fields has them moved to planned.",
    properties: {
      id: { type: "string", format: "uuid" },
      order: { type: "integer", minimum: 1 },
      status: setStatusSchema,
      source: setSourceSchema,
      planned: plannedSetValuesObject,
      reps: nullable({ type: "integer", minimum: 0 }),
      weight_kg: nullable({ type: "number", minimum: 0 }),
      distance_m: nullable({ type: "number", minimum: 0 }),
      duration_sec: nullable({ type: "integer", minimum: 0 }),
      rpe: nullable({ type: "integer", minimum: 1, maximum: 10 }),
      rest_sec: nullable({ type: "integer", minimum: 0 }),
      extras: { type: "object", additionalProperties: true },
      recorded_at: nullable({ type: "string", format: "date-time" }),
      notes: nullable({ type: "string", maxLength: 500 }),
    },
    required: ["order"],
    additionalProperties: false,
  },
  SessionUpdateRequest: {
    type: "object",
    properties: {
      plan_id: nullable({ type: "string", format: "uuid" }),
      title: nullable({ type: "string", minLength: 2, maxLength: 100 }),
      planned_at: { type: "string", format: "date-time" },
      planned_duration_min: {
        type: "integer",
        minimum: 5,
        maximum: 720,
        description: "Planned length in minutes.",
      },
      status: { type: "string", enum: ["planned", "in_progress", "completed", "canceled"] },
      completion_outcome: {
        ...completionOutcomeSchema,
        description:
          "Only when the session transitions to completed; defaults to completed (400 E.SESSION.OUTCOME_WITHOUT_COMPLETION otherwise).",
      },
      visibility: { type: "string", enum: ["private", "followers", "public", "link"] },
      notes: nullable({ type: "string", maxLength: 1000 }),
      recurrence_rule: nullable({ type: "string", maxLength: 255 }),
      started_at: { type: "string", format: "date-time" },
      completed_at: { type: "string", format: "date-time" },
      calories: nullable({ type: "integer", minimum: 0 }),
      exercises: {
        type: "array",
        maxItems: 50,
        description: "Replaces all exercises and sets of the session.",
        items: { $ref: "#/components/schemas/SessionExerciseInput" },
      },
    },
    additionalProperties: false,
  },
  SessionWithExercises: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      owner_id: { type: "string", format: "uuid" },
      plan_id: nullable({ type: "string", format: "uuid" }),
      title: nullable({ type: "string" }),
      planned_at: { type: "string", format: "date-time" },
      planned_duration_min: { type: "integer", minimum: 5, maximum: 720 },
      status: { $ref: "#/components/schemas/SessionStatus" },
      visibility: { type: "string", enum: ["private", "followers", "public", "link"] },
      notes: nullable({ type: "string" }),
      recurrence_rule: nullable({ type: "string" }),
      started_at: nullable({ type: "string", format: "date-time" }),
      completed_at: nullable({ type: "string", format: "date-time" }),
      completion_outcome: nullable(completionOutcomeSchema),
      calories: nullable({ type: "integer" }),
      points: nullable({ type: "integer", description: "Server-awarded points once completed." }),
      gamification_rebuild_required: { type: "boolean" },
      deleted_at: nullable({ type: "string", format: "date-time" }),
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
      exercises: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            session_id: { type: "string", format: "uuid" },
            exercise_id: nullable({ type: "string", format: "uuid" }),
            exercise_name: nullable({
              type: "string",
              description: "Name snapshot at planning time.",
            }),
            order_index: { type: "integer", minimum: 1 },
            notes: nullable({ type: "string" }),
            planned: plannedAttributesObject,
            actual: actualAttributesObject,
            sets: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  order_index: { type: "integer", minimum: 1 },
                  status: setStatusSchema,
                  source: setSourceSchema,
                  planned: plannedSetValuesObject,
                  reps: nullable({ type: "integer" }),
                  weight_kg: nullable({ type: "number" }),
                  distance_m: nullable({ type: "number" }),
                  duration_sec: nullable({ type: "integer" }),
                  rpe: nullable({ type: "integer" }),
                  rest_sec: nullable({ type: "integer" }),
                  extras: { type: "object", additionalProperties: true },
                  recorded_at: nullable({ type: "string", format: "date-time" }),
                  notes: nullable({ type: "string" }),
                },
                required: ["id", "order_index", "status", "source"],
              },
            },
          },
          required: ["id", "session_id", "order_index", "sets"],
        },
      },
    },
    required: [
      "id",
      "owner_id",
      "planned_at",
      "planned_duration_min",
      "status",
      "visibility",
      "exercises",
    ],
  },
  ScheduleConflictResponse: {
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          code: { type: "string", enum: ["E.SESSION.SCHEDULE_CONFLICT"] },
          message: { type: "string" },
          details: {
            type: "object",
            properties: {
              conflictingSessionIds: {
                type: "array",
                minItems: 1,
                items: { type: "string", format: "uuid" },
                description: "Active sessions whose planned time overlaps the requested one.",
              },
            },
            required: ["conflictingSessionIds"],
          },
          requestId: { type: "string" },
        },
        required: ["code", "message", "details"],
      },
    },
    required: ["error"],
  },
  ValidationErrorResponse: {
    type: "object",
    description: "Request body rejected by schema validation (zod `flatten()` output).",
    properties: {
      error: {
        type: "object",
        properties: {
          formErrors: { type: "array", items: { type: "string" } },
          fieldErrors: {
            type: "object",
            additionalProperties: { type: "array", items: { type: "string" } },
          },
        },
        required: ["formErrors", "fieldErrors"],
      },
    },
    required: ["error"],
  },
  SessionListResponse: {
    type: "object",
    properties: {
      data: {
        type: "array",
        items: { $ref: "#/components/schemas/Session" },
      },
      meta: {
        type: "object",
        properties: {
          page: { type: "integer" },
          limit: { type: "integer" },
          total: { type: "integer" },
        },
      },
    },
    required: ["data", "meta"],
  },
  SessionEstimate: {
    type: "object",
    properties: {
      activeDurationSec: { type: ["integer", "null"], minimum: 0 },
      restDurationSec: { type: "integer", minimum: 0 },
      minimumTotalDurationSec: { type: ["integer", "null"], minimum: 0 },
      normalizedMet: { type: ["number", "null"], minimum: 0 },
      estimatedKcalPerMin: { type: ["number", "null"], minimum: 0 },
      estimatedActiveKcal: { type: ["number", "null"], minimum: 0 },
      complete: { type: "boolean" },
      missingInputs: { type: "array", items: { type: "string" } },
    },
    required: [
      "activeDurationSec",
      "restDurationSec",
      "minimumTotalDurationSec",
      "normalizedMet",
      "estimatedKcalPerMin",
      "estimatedActiveKcal",
      "complete",
      "missingInputs",
    ],
    additionalProperties: false,
  },
  SessionCompleteRequest: {
    type: "object",
    properties: {
      perceivedEffort: { type: "integer", minimum: 1, maximum: 10 },
      notes: { type: "string" },
    },
  },
};

const spec = {
  openapi: "3.1.0",
  info,
  servers: [
    { url: "https://api.fitvibe.app/api/v1", description: "Production" },
    { url: "https://staging.fitvibe.app/api/v1", description: "Staging" },
    { url: "http://localhost:4100/api/v1", description: "Local" },
  ],
  tags: [
    { name: "Auth", description: "Authentication & session management" },
    { name: "Users", description: "User and profile endpoints" },
    { name: "Exercises", description: "Exercise catalog endpoints" },
    { name: "Sessions", description: "Planning and workout sessions" },
    { name: "Vibeforms", description: "Personalized Vibeform profiles and preferences" },
    { name: "System", description: "Operational endpoints" },
  ],
  paths,
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas,
  },
};

function writeSpec() {
  const outputDir = resolve(process.cwd(), "openapi");
  mkdirSync(outputDir, { recursive: true });
  const outputPath = resolve(outputDir, "openapi.json");
  writeFileSync(outputPath, JSON.stringify(spec, null, 2));
  console.log(`OpenAPI specification written to ${outputPath}`);
}

writeSpec();
