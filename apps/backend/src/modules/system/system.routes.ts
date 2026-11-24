import type { Request, Response } from "express";
import { Router } from "express";
import pkg from "../../../package.json";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  getRuntimeAppSetting,
  getRuntimeGovernanceState,
  isEffectiveReadOnly,
} from "./app-settings.runtime.js";

const router = Router();

router.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    version: pkg.version,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Public, read-only client configuration (athlete app feature flags, backoffice Settings).
 * Maintenance and read-only state come from the governed settings authority; changing
 * them is a superadmin action under /system/settings.
 */
router.get(
  "/config",
  asyncHandler((_req: Request, res: Response) => {
    const runtime = getRuntimeGovernanceState();
    const readOnlyMode = isEffectiveReadOnly();
    res.status(200).json({
      readOnlyMode,
      maintenanceMode: runtime.maintenanceEnabled,
      maintenanceMessage: readOnlyMode
        ? getRuntimeAppSetting<string>("system.maintenance_message")
        : undefined,
      // No runtime feature flags are governed today; clients default unknown flags to off.
      features: {},
      timestamp: new Date().toISOString(),
    });
    return Promise.resolve();
  }),
);

router.get(
  "/read-only/status",
  asyncHandler((_req: Request, res: Response) => {
    const runtime = getRuntimeGovernanceState();
    const readOnlyMode = isEffectiveReadOnly();
    res.status(200).json({
      readOnlyMode,
      message: readOnlyMode ? getRuntimeAppSetting<string>("system.maintenance_message") : null,
      sources: {
        authorityUnavailable: !runtime.authorityReady,
        persistedMaintenance: runtime.maintenanceEnabled,
        emergencyOverride: runtime.emergencyReadOnly,
        activationSafety: runtime.activeRevision !== runtime.loadedRevision,
      },
      activeRevision: runtime.activeRevision,
      loadedRevision: runtime.loadedRevision,
      timestamp: new Date().toISOString(),
    });
    return Promise.resolve();
  }),
);

export default router;
