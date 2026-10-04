import { z } from "zod";

export const passwordPolicy = z
  .string()
  .min(12, "passwordMinLength")
  .max(128)
  .regex(/(?=.*[a-z])/, "passwordLowercase")
  .regex(/(?=.*[A-Z])/, "passwordUppercase")
  .regex(/(?=.*\d)/, "passwordDigit")
  .regex(/(?=.*[^\w\s])/, "passwordSymbol");

const aliasSchema = z
  .string()
  .min(3)
  .max(50)
  .regex(/^[a-zA-Z0-9_\-.]+$/, "usernameFormat");

const registerProfileSchema = z
  .object({
    display_name: z.string().min(1).max(100).optional(),
    sex: z.enum(["man", "woman", "diverse", "prefer_not_to_say"]).optional(),
    weight_kg: z.number().min(20).max(500).optional(),
    fitness_level: z.enum(["beginner", "intermediate", "advanced", "elite", "rehab"]).optional(),
    date_of_birth: z.string().date().optional(),
    /** @deprecated Send date_of_birth instead. */
    age: z.number().int().min(13).max(120).optional(),
  })
  .refine((profile) => !(profile.date_of_birth && profile.age !== undefined), {
    message: "DATE_OF_BIRTH_AGE_CONFLICT",
    path: ["date_of_birth"],
  });

export const RegisterSchema = z
  .object({
    email: z.string().email(),
    alias: aliasSchema.optional(),
    username: aliasSchema.optional(),
    password: passwordPolicy,
    profile: registerProfileSchema.optional(),
    terms_accepted: z.boolean(),
  })
  .refine((data) => Boolean((data.alias ?? data.username)?.trim()), {
    message: "ALIAS_REQUIRED",
    path: ["alias"],
  })
  .refine((data) => data.terms_accepted === true, {
    message: "TERMS_ACCEPTANCE_REQUIRED",
    path: ["terms_accepted"],
  });

export const LoginSchema = z.object({
  // Field name stays "email" for API compatibility, but login accepts either
  // the primary email address or the profile alias (for example "admin").
  email: z.string().trim().min(1).max(254),
  password: z.string().min(1),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordPolicy,
});

export const RevokeSessionsSchema = z
  .object({
    sessionId: z.string().uuid().optional(),
    revokeAll: z.boolean().optional(),
    revokeOthers: z.boolean().optional(),
  })
  .refine((data) => Boolean(data.sessionId || data.revokeAll || data.revokeOthers), {
    message: "sessionIdRequired",
    path: ["sessionId"],
  })
  .refine((data) => !(data.revokeAll && data.revokeOthers), {
    message: "revokeConflict",
    path: ["revokeAll"],
  });

const TWO_FACTOR_CODE_REGEX = /^(?:\d{6}|[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4})$/i;

export const Verify2FALoginSchema = z.object({
  pendingSessionId: z.string().uuid(),
  code: z
    .string()
    .trim()
    .regex(TWO_FACTOR_CODE_REGEX, "Code must be a 6-digit TOTP or XXXX-XXXX backup code"),
});

export const AcceptTermsSchema = z
  .object({
    terms_accepted: z.boolean(),
  })
  .refine((data) => data.terms_accepted === true, {
    message: "TERMS_ACCEPTANCE_REQUIRED",
    path: ["terms_accepted"],
  });

export const AcceptPrivacyPolicySchema = z
  .object({
    privacy_policy_accepted: z.boolean(),
  })
  .refine((data) => data.privacy_policy_accepted === true, {
    message: "PRIVACY_ACCEPTANCE_REQUIRED",
    path: ["privacy_policy_accepted"],
  });

export const ResendVerificationSchema = z.object({
  email: z.string().email(),
});
