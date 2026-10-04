import { z, type ZodTypeAny } from "zod";
import {
  RegisterSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  ResendVerificationSchema,
  Verify2FALoginSchema,
} from "../../../apps/backend/src/modules/auth/auth.schemas.js";
import { CreateSessionSchema } from "../../../apps/backend/src/modules/sessions/sessions.controller.js";
import { ReportFeedItemSchema } from "../../../apps/backend/src/modules/feed/feed.schemas.js";
import {
  UpdateProfileSchema,
  UpdatePreferencesSchema,
  CreateUserSchema,
} from "../../../apps/backend/src/modules/users/users.controller.js";
import { CreateExerciseTypeSchema } from "../../../apps/backend/src/modules/exercise-types/exerciseTypes.controller.js";
import { UpdateVibeformPreferencesSchema } from "../../../apps/backend/src/modules/vibeforms/vibeforms.schemas.js";
import openApiSpec from "../../../apps/backend/openapi/openapi.json";

type SchemaMapEntry = {
  name: string;
  schema: ZodTypeAny;
};

const CONTRACT_SCHEMAS: SchemaMapEntry[] = [
  { name: "RegisterRequest", schema: RegisterSchema },
  { name: "LoginRequest", schema: LoginSchema },
  { name: "ForgotPasswordRequest", schema: ForgotPasswordSchema },
  { name: "ResetPasswordRequest", schema: ResetPasswordSchema },
  { name: "ResendVerificationRequest", schema: ResendVerificationSchema },
  { name: "Verify2FALoginRequest", schema: Verify2FALoginSchema },
  { name: "SessionCreateRequest", schema: CreateSessionSchema },
  { name: "ReportFeedItemRequest", schema: ReportFeedItemSchema },
  { name: "UpdateProfileRequest", schema: UpdateProfileSchema },
  { name: "UpdatePreferencesRequest", schema: UpdatePreferencesSchema },
  { name: "CreateUserRequest", schema: CreateUserSchema },
  { name: "CreateExerciseTypeRequest", schema: CreateExerciseTypeSchema },
  { name: "UpdateVibeformPreferencesRequest", schema: UpdateVibeformPreferencesSchema },
];

type JsonSchemaObject = {
  properties?: Record<string, any>;
  required?: string[];
};

function extractSchemaFromZod(entry: SchemaMapEntry): JsonSchemaObject {
  const result = z.toJSONSchema(entry.schema, {
    target: "openapi-3.0",
    io: "input",
    unrepresentable: "any",
  }) as JsonSchemaObject;

  return {
    properties: result.properties ?? {},
    required: result.required ?? [],
  };
}
function extractSchemaFromOpenApi(name: string): JsonSchemaObject {
  const schema = (openApiSpec as any).components?.schemas?.[name];
  if (!schema) {
    throw new Error(`OpenAPI schema "${name}" is not defined`);
  }
  return {
    properties: schema.properties ?? {},
    required: schema.required ?? [],
  };
}

describe("OpenAPI contract alignment", () => {
  for (const entry of CONTRACT_SCHEMAS) {
    it(`matches OpenAPI schema for ${entry.name}`, () => {
      const zodSchema = extractSchemaFromZod(entry);
      const openApiSchema = extractSchemaFromOpenApi(entry.name);

      const zodKeys = Object.keys(zodSchema.properties ?? {}).sort();
      const openApiKeys = Object.keys(openApiSchema.properties ?? {}).sort();

      expect(openApiKeys).toEqual(zodKeys);

      const zodRequired = [...(zodSchema.required ?? [])].sort();
      const openApiRequired = [...(openApiSchema.required ?? [])].sort();

      expect(openApiRequired).toEqual(zodRequired);

      for (const key of zodKeys) {
        const expected = zodSchema.properties?.[key] ?? {};
        const received = openApiSchema.properties?.[key] ?? {};

        if (expected?.type) {
          expect(received?.type).toBe(expected.type);
        }
        if (expected?.format) {
          expect(received?.format).toBe(expected.format);
        }
        if (Array.isArray(expected?.enum)) {
          expect(received?.enum).toEqual(expected.enum);
        }
        if (expected?.items?.type && !received?.items?.$ref) {
          expect(received?.items?.type).toBe(expected.items.type);
        }
        if (expected?.properties) {
          expect(Object.keys(received?.properties ?? {}).sort()).toEqual(
            Object.keys(expected.properties).sort(),
          );
        }
      }
    });
  }

  it("keeps calculated Vibeform fields read-only on the preference update operation", () => {
    const operation = (openApiSpec as any).paths?.["/vibeforms/me/preferences"]?.put;
    const requestReference =
      operation?.requestBody?.content?.["application/json"]?.schema?.$ref;
    const requestSchema = (openApiSpec as any).components.schemas.UpdateVibeformPreferencesRequest;

    expect(requestReference).toBe("#/components/schemas/UpdateVibeformPreferencesRequest");
    expect(Object.keys(requestSchema.properties).sort()).toEqual(
      ["bodyProfile", "motionEnabled", "templateCode"].sort(),
    );
    expect(requestSchema.additionalProperties).toBe(false);
    expect(requestSchema.properties).not.toHaveProperty("metrics");
    expect(requestSchema.properties).not.toHaveProperty("calculationVersion");
  });
});
