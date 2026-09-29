import type { Request, Response } from "express";
import { readRouteParam } from "../../utils/http.js";
import { z } from "zod";
import {
  getMe,
  listAll,
  updateProfile,
  updatePassword,
  requestAccountDeletion,
  collectUserData,
  listContacts,
  updatePrimaryEmail,
  updatePhoneNumber,
  verifyContact,
  requestContactVerification,
  removeContact,
  changeStatus,
  createUser,
  getPrivacySettings,
  updatePrivacySettings,
  getUserPreferences,
  updateUserPreferences,
} from "./users.service.js";
import { getContactById, getUserMetrics } from "./users.repository.js";
import { passwordPolicy } from "../auth/auth.schemas.js";
import { handleIdempotentRequest } from "../common/idempotency.helpers.js";
import { writeUserDataArchive } from "./user-data-archive.service.js";

const usernameSchema = z
  .string()
  .min(3)
  .max(50)
  .regex(
    /^[a-zA-Z0-9_.-]+$/,
    "Username may only contain letters, numbers, underscores, dots, or dashes",
  );

const updateProfileSchema = z.object({
  username: usernameSchema.optional(),
  displayName: z.string().min(1).max(120).optional(),
  bio: z.string().max(500).optional(),
  alias: z
    .string()
    .min(3)
    .max(50)
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      "Alias may only contain letters, numbers, underscores, dots, or dashes",
    )
    .optional(),
  weight: z
    .number()
    .positive()
    .min(20)
    .max(500)
    .refine(
      (val) => {
        // Check that weight has at most 2 decimal places
        const decimalPart = val.toString().split(".")[1];
        return !decimalPart || decimalPart.length <= 2;
      },
      { message: "Weight must have at most 2 decimal places" },
    )
    .optional(),
  weightUnit: z.enum(["kg", "lb"]).optional(),
  fitnessLevel: z.enum(["beginner", "intermediate", "advanced", "elite"]).optional(),
  trainingFrequency: z
    .enum(["rarely", "1_2_per_week", "3_4_per_week", "5_plus_per_week"])
    .optional(),
});

export const UpdateProfileSchema = updateProfileSchema;

const updatePreferencesSchema = z
  .object({
    language: z.enum(["en", "de", "fr", "es", "el"]).optional(),
    measurementSystem: z.enum(["metric", "imperial"]).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one preference field is required",
  });

export const UpdatePreferencesSchema = updatePreferencesSchema;

const changePasswordSchema = z.object({
  currentPassword: z.string().min(12).max(128),
  newPassword: passwordPolicy,
});

const privacyPatchSchema = z
  .object({
    defaultVisibility: z.enum(["private", "public", "link", "followers"]).optional(),
    allowFollowers: z.boolean().optional(),
    showEmail: z.boolean().optional(),
    showWeight: z.boolean().optional(),
    showFitnessLevel: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one privacy field is required",
  });

const emailSchema = z.object({
  email: z.string().email().max(254),
});

const phoneSchema = z.object({
  phone: z.string().min(5).max(32),
  isRecovery: z.boolean().optional(),
});

const contactIdSchema = z.object({
  contactId: z.string().uuid(),
});

const verifyContactBodySchema = z.object({
  token: z.string().min(10).max(256),
});

const createUserSchema = z.object({
  username: usernameSchema,
  displayName: z.string().min(1).max(120),
  email: z.string().email().max(254),
  password: passwordPolicy,
  role: z.string().min(1).max(50),
  locale: z.string().max(10).optional(),
  preferredLang: z.enum(["en", "de", "fr", "es", "el"]).optional(),
  status: z.enum(["pending_verification", "active", "suspended"]).optional(),
});

export const CreateUserSchema = createUserSchema;

const statusSchema = z.object({
  status: z.enum(["pending_verification", "active", "suspended", "banned", "pending_deletion"]),
});

const deleteAccountSchema = z.object({
  password: z.string().min(12).max(128),
});

export async function me(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = await getMe(userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
  return;
}

export async function list(req: Request, res: Response): Promise<void> {
  const limit = Number.parseInt(req.query.limit as string, 10) || 50;
  const offset = Number.parseInt(req.query.offset as string, 10) || 0;
  const users = await listAll(limit, offset);
  res.json(users);
  return;
}

export async function adminCreateUser(req: Request, res: Response): Promise<void> {
  const actorId = req.user?.sub ?? null;
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const scopeUserId = actorId ?? "system";
  const handled = await handleIdempotentRequest(req, res, scopeUserId, parsed.data, async () => {
    const body = await createUser(actorId, parsed.data);
    return { status: 201, body };
  });

  if (!handled) {
    const body = await createUser(actorId, parsed.data);
    res.status(201).json(body);
  }
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const handled = await handleIdempotentRequest(req, res, userId, parsed.data, async () => {
    const body = await updateProfile(userId, parsed.data);
    return { status: 200, body };
  });

  if (!handled) {
    const body = await updateProfile(userId, parsed.data);
    res.json(body);
  }
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const handled = await handleIdempotentRequest(req, res, userId, {}, async () => {
    await updatePassword(userId, parsed.data);
    return { status: 204, body: null };
  });

  if (!handled) {
    await updatePassword(userId, parsed.data);
    res.status(204).send();
  }
}

export async function deleteAccount(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = deleteAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const execute = async () => {
    const schedule = await requestAccountDeletion(userId, parsed.data.password);
    return {
      status: "pending_deletion",
      scheduledAt: schedule.scheduledAt,
      purgeDueAt: schedule.purgeDueAt,
      backupPurgeDueAt: schedule.backupPurgeDueAt,
    };
  };

  const handled = await handleIdempotentRequest(req, res, userId, {}, async () => ({
    status: 202,
    body: await execute(),
  }));

  if (!handled) {
    res.status(202).json(await execute());
  }
}

export async function exportData(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const data = await collectUserData(userId);
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", 'attachment; filename="fitvibe_user_export.zip"');

  await writeUserDataArchive(res, data);
}

export async function getPreferences(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const preferences = await getUserPreferences(userId);
  res.json(preferences);
}

export async function updatePreferences(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = updatePreferencesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const preferences = await updateUserPreferences(userId, parsed.data);
  res.json(preferences);
}

export async function getPrivacy(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const settings = await getPrivacySettings(userId);
  res.json(settings);
}

export async function updatePrivacy(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = privacyPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const settings = await updatePrivacySettings(userId, parsed.data);
  res.json(settings);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const id = readRouteParam(req.params.id, "id");
  const user = await getMe(id);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
  return;
}

export async function listUserContacts(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const contacts = await listContacts(userId);
  res.json(contacts);
  return;
}

export async function requestContactVerificationHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsedParams = contactIdSchema.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: parsedParams.error.flatten() });
    return;
  }

  const handled = await handleIdempotentRequest(
    req,
    res,
    userId,
    { contactId: parsedParams.data.contactId },
    async () => {
      const body = await requestContactVerification(userId, parsedParams.data.contactId);
      return { status: 201, body };
    },
  );

  if (!handled) {
    const body = await requestContactVerification(userId, parsedParams.data.contactId);
    res.status(201).json(body);
  }
}

export async function updateEmail(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = emailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const handled = await handleIdempotentRequest(req, res, userId, parsed.data, async () => {
    const body = await updatePrimaryEmail(userId, parsed.data.email);
    return { status: 200, body };
  });

  if (!handled) {
    const body = await updatePrimaryEmail(userId, parsed.data.email);
    res.json(body);
  }
}

export async function updatePhone(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = phoneSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const execute = () =>
    updatePhoneNumber(userId, parsed.data.phone, parsed.data.isRecovery ?? true);

  const handled = await handleIdempotentRequest(req, res, userId, parsed.data, async () => ({
    status: 200,
    body: await execute(),
  }));

  if (!handled) {
    res.json(await execute());
  }
}

export async function verifyContactHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsedParams = contactIdSchema.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: parsedParams.error.flatten() });
    return;
  }
  const parsedBody = verifyContactBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: parsedBody.error.flatten() });
    return;
  }

  const existingContact = await getContactById(parsedParams.data.contactId);
  if (!existingContact || existingContact.user_id !== userId) {
    res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Contact not found or access denied",
      },
    });
    return;
  }

  const verificationToken = parsedBody.data.token;
  if (!/^[A-Za-z0-9_-]+$/.test(verificationToken)) {
    res.status(400).json({
      error: {
        code: "INVALID_TOKEN",
        message: "Token format invalid",
      },
    });
    return;
  }

  const handled = await handleIdempotentRequest(
    req,
    res,
    userId,
    { contactId: parsedParams.data.contactId, token: verificationToken },
    async () => {
      const body = await verifyContact(userId, parsedParams.data.contactId, verificationToken);
      return { status: 200, body };
    },
  );

  if (!handled) {
    const body = await verifyContact(userId, parsedParams.data.contactId, verificationToken);
    res.json(body);
  }
}

export async function removeContactHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = contactIdSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const handled = await handleIdempotentRequest(
    req,
    res,
    userId,
    { contactId: parsed.data.contactId },
    async () => {
      await removeContact(userId, parsed.data.contactId);
      return { status: 204, body: null };
    },
  );

  if (!handled) {
    await removeContact(userId, parsed.data.contactId);
    res.status(204).send();
  }
}

export async function adminChangeStatus(req: Request, res: Response): Promise<void> {
  const actorId = req.user?.sub ?? null;
  const id = readRouteParam(req.params.id, "id");
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const scopeUserId = actorId ?? "system";
  const handled = await handleIdempotentRequest(
    req,
    res,
    scopeUserId,
    { targetUserId: id, ...parsed.data },
    async () => {
      const body = await changeStatus(actorId, id, parsed.data.status);
      return { status: 200, body };
    },
  );

  if (!handled) {
    const body = await changeStatus(actorId, id, parsed.data.status);
    res.json(body);
  }
}

export async function getMetrics(req: Request, res: Response): Promise<void> {
  const targetUserId = readRouteParam(req.params.userId, "userId") || req.user?.sub;
  const requestingUserId = req.user?.sub;
  const requestingUserRole = req.user?.role;

  if (!targetUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // IDOR Protection (AC-1.7): Only allow access to own metrics or admin access
  const isOwnMetrics = targetUserId === requestingUserId;
  const isAdmin = requestingUserRole === "admin";

  if (!isOwnMetrics && !isAdmin) {
    res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "You can only access your own metrics",
      },
    });
    return;
  }

  const metrics = await getUserMetrics(targetUserId);
  res.json(metrics);
  return;
}
