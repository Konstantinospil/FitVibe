import type { Request, Response } from "express";
import { z } from "zod";

import { getPointsHistory, getPointsSummary } from "./points.service.js";
import type { PointsHistoryQuery } from "./points.types.js";
import { getBadgeCatalog, getUserBadges } from "./points.repository.js";
import { ensureGamificationProjectionFresh } from "./gamification-projection.service.js";

const historyQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

function requireUser(req: Request, res: Response): string | null {
  const user = req.user as { sub?: string } | undefined;
  if (!user?.sub) {
    res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "Missing authenticated user context",
        requestId: res.locals.requestId,
      },
    });
    return null;
  }
  return user.sub;
}

export async function getPointsSummaryHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) {
    return;
  }
  await ensureGamificationProjectionFresh(userId);
  const summary = await getPointsSummary(userId);
  res.json(summary);
}

export async function getPointsHistoryHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) {
    return;
  }

  const parsed = historyQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  await ensureGamificationProjectionFresh(userId);
  const history = await getPointsHistory(userId, parsed.data as PointsHistoryQuery);
  res.json(history);
}

export async function getBadgeCatalogHandler(_req: Request, res: Response): Promise<void> {
  const catalog = await getBadgeCatalog();
  const badges = Array.from(catalog.values());
  res.json({ badges });
}

export async function getUserBadgesHandler(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req, res);
  if (!userId) {
    return;
  }

  await ensureGamificationProjectionFresh(userId);
  const badges = await getUserBadges(userId);
  res.json({ badges, total: badges.length });
}
