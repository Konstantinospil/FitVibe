import { Router } from "express";
import { requireAccessToken } from "../auth/auth.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as twoFactorController from "./two-factor.controller.js";

const router = Router();

/**
 * Two-Factor Authentication Routes
 * All routes require authentication
 */

// Initialize 2FA setup (get secret, QR code, backup codes)
router.get("/setup", requireAccessToken, asyncHandler(twoFactorController.setup));

// Restart or replace an existing setup after step-up authentication
router.post("/setup", requireAccessToken, asyncHandler(twoFactorController.restartSetup));

// Enable 2FA after verifying TOTP token
router.post("/enable", requireAccessToken, asyncHandler(twoFactorController.enable));

// Disable 2FA (requires password + 2FA token)
router.post("/disable", requireAccessToken, asyncHandler(twoFactorController.disable));

// Verify 2FA token (used during login flow)
router.post("/verify", requireAccessToken, asyncHandler(twoFactorController.verify));

// Regenerate backup codes
router.post(
  "/backup-codes/regenerate",
  requireAccessToken,
  asyncHandler(twoFactorController.regenerateBackups),
);

// Get 2FA status and statistics
router.get("/status", requireAccessToken, asyncHandler(twoFactorController.status));

export default router;
