import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "../../utils/http.js";
import {
  beginTwoFactorSetup,
  disableTwoFactor,
  enableTwoFactor,
  getTwoFactorStatus,
  regenerateTwoFactorBackupCodes,
  restartTwoFactorSetup,
} from "./two-factor.service.js";

const VerificationSchema = z
  .object({
    code: z
      .string()
      .regex(/^\d{6}$/, "Code must be 6 digits")
      .optional(),
    token: z
      .string()
      .regex(/^\d{6}$/, "Token must be 6 digits")
      .optional(),
  })
  .refine((value) => Boolean(value.code ?? value.token), {
    message: "Verification code is required",
  });

const StepUpSchema = z.object({
  password: z.string().min(1),
  code: z.string().min(1),
});

const RestartSetupSchema = z.object({
  password: z.string().min(1),
  code: z.string().min(1).optional(),
});

function requireUserId(req: Request): string {
  const userId = req.user?.sub;
  if (!userId) {
    throw new HttpError(401, "E.UNAUTHENTICATED", "Authentication required");
  }
  return userId;
}

async function enableFromRequest(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const parsed = VerificationSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, "E.VALIDATION.FAILED", "Invalid input", parsed.error.flatten());
  }

  const code = parsed.data.code ?? parsed.data.token;
  if (!code) {
    throw new HttpError(400, "E.VALIDATION.FAILED", "Verification code is required");
  }

  await enableTwoFactor(userId, code);

  res.json({
    success: true,
    message: "Two-factor authentication enabled successfully",
  });
}

export async function setup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireUserId(req);
    const result = await beginTwoFactorSetup(userId);

    res.json({
      secret: result.secret,
      qrCode: result.qrCode,
      backupCodes: result.backupCodes,
      message:
        "Save your backup codes in a safe place. You will need them if you lose access " +
        "to your authenticator app.",
    });
  } catch (error) {
    next(error);
  }
}

export async function restartSetup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireUserId(req);
    const parsed = RestartSetupSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "E.VALIDATION.FAILED", "Invalid input", parsed.error.flatten());
    }
    const result = await restartTwoFactorSetup(userId, parsed.data.password, parsed.data.code);
    res.json({
      secret: result.secret,
      qrCode: result.qrCode,
      backupCodes: result.backupCodes,
      message: "Two-factor setup restarted after step-up authentication",
    });
  } catch (error) {
    next(error);
  }
}

export async function enable(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await enableFromRequest(req, res);
  } catch (error) {
    next(error);
  }
}

export async function verify(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await enableFromRequest(req, res);
  } catch (error) {
    next(error);
  }
}

export async function disable(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireUserId(req);
    const parsed = StepUpSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "E.VALIDATION.FAILED", "Invalid input", parsed.error.flatten());
    }

    await disableTwoFactor(userId, parsed.data.password, parsed.data.code);

    res.json({
      success: true,
      message: "Two-factor authentication disabled successfully",
    });
  } catch (error) {
    next(error);
  }
}

export async function regenerateBackups(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = requireUserId(req);
    const parsed = StepUpSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "E.VALIDATION.FAILED", "Invalid input", parsed.error.flatten());
    }
    const backupCodes = await regenerateTwoFactorBackupCodes(
      userId,
      parsed.data.password,
      parsed.data.code,
    );

    res.json({
      message: "Backup codes regenerated successfully",
      backupCodes,
    });
  } catch (error) {
    next(error);
  }
}

export async function status(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireUserId(req);
    const result = await getTwoFactorStatus(userId);

    res.json(result);
  } catch (error) {
    next(error);
  }
}
