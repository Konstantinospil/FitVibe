import { runRetentionSweep } from "../../services/retention.service.js";
import { evaluateStreakBonus } from "../../modules/points/streaks.service.js";
import { evaluateSeasonalEvents } from "../../modules/points/seasonal-events.service.js";
import db from "../../db/index.js";
import { flushAuditOutbox } from "../../modules/common/audit-outbox.service.js";
import { applyVibeLevelDecay } from "./vibe-level-decay.service.js";

export const SHARED_JOB_TYPES = [
  "retention.sweep",
  "leaderboard.refresh",
  "points.streaks.evaluate",
  "points.seasonal_events.evaluate",
  "points.projection.reconcile",
  "audit.outbox.flush",
  "vibe-level.decay",
] as const;

export type SharedJobType = (typeof SHARED_JOB_TYPES)[number];

function requireSessionEvaluationPayload(payload: Record<string, unknown>): {
  userId: string;
  sessionId: string;
  completedAt: string;
} {
  const { userId, sessionId, completedAt } = payload;
  if (
    typeof userId !== "string" ||
    typeof sessionId !== "string" ||
    typeof completedAt !== "string"
  ) {
    throw new Error("Invalid session evaluation job payload");
  }
  return { userId, sessionId, completedAt };
}

export async function executeSharedJob(
  name: SharedJobType,
  payload: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "retention.sweep":
      return runRetentionSweep();
    case "leaderboard.refresh":
      await db.raw("SELECT public.refresh_session_summary(TRUE);");
      await db.raw("REFRESH MATERIALIZED VIEW mv_leaderboard;");
      return { success: true };
    case "points.streaks.evaluate": {
      const { userId, sessionId, completedAt } = requireSessionEvaluationPayload(payload);
      return evaluateStreakBonus(userId, sessionId, completedAt);
    }
    case "points.seasonal_events.evaluate": {
      const { userId, sessionId, completedAt } = requireSessionEvaluationPayload(payload);
      return evaluateSeasonalEvents(userId, sessionId, completedAt);
    }
    case "points.projection.reconcile": {
      const { userId, sessionId, forceFullRebuild } = payload;
      if (typeof userId !== "string") {
        throw new Error("Invalid gamification projection job payload");
      }
      const { reconcileGamificationProjection } =
        await import("../../modules/points/gamification-projection.service.js");
      return reconcileGamificationProjection(userId, {
        sessionId: typeof sessionId === "string" ? sessionId : undefined,
        forceFullRebuild: forceFullRebuild === true,
        reason: "queued_projection_reconciliation",
      });
    }
    case "audit.outbox.flush":
      return { flushed: await flushAuditOutbox() };
    case "vibe-level.decay":
      return applyVibeLevelDecay();
  }
}
