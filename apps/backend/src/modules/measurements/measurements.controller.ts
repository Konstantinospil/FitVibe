import type { Request, Response } from "express";
import { z } from "zod";
import {
  addMeasurementValue,
  createMeasurementAttribute,
  listMeasurementAttributesForUser,
  updateMeasurementVisibility,
} from "./measurements.service.js";

const listQuerySchema = z.object({
  q: z.string().optional(),
  lang: z.string().min(2).max(10).optional(),
  includeHidden: z
    .string()
    .transform((value) => value === "true")
    .optional(),
});

const createAttributeSchema = z.object({
  key: z.string().min(1).max(80).optional(),
  label: z.string().min(1).max(120),
  description: z.string().max(240).optional(),
  unitType: z.enum(["length", "weight", "volume", "ratio", "count", "time", "power", "percentage"]),
  granularity: z.string().min(1).max(32),
  measurementSystem: z.enum(["metric", "imperial"]),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  derivedFromAId: z.string().uuid().optional(),
  derivedFromBId: z.string().uuid().optional(),
  derivedOperator: z.enum(["ratio"]).optional(),
});

const valueSchema = z.object({
  valueNumber: z.number(),
  measuredAt: z.string().optional(),
});

const visibilitySchema = z.object({
  isVisible: z.boolean(),
});

async function listAttributes(category: "bio" | "perf", req: Request, res: Response) {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const attributes = await listMeasurementAttributesForUser(category, userId, {
    q: parsed.data.q,
    lang: parsed.data.lang,
    includeHidden: parsed.data.includeHidden,
  });
  res.json({ attributes });
}

async function createAttribute(category: "bio" | "perf", req: Request, res: Response) {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = createAttributeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const attribute = await createMeasurementAttribute(category, userId, {
    key: parsed.data.key,
    label: parsed.data.label,
    description: parsed.data.description ?? null,
    unitType: parsed.data.unitType,
    granularity: parsed.data.granularity,
    measurementSystem: parsed.data.measurementSystem,
    minValue: parsed.data.minValue,
    maxValue: parsed.data.maxValue,
    derivedFromAId: parsed.data.derivedFromAId,
    derivedFromBId: parsed.data.derivedFromBId,
    derivedOperator: parsed.data.derivedOperator,
  });
  res.status(201).json({ attribute });
}

async function addValue(category: "bio" | "perf", req: Request, res: Response) {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const attributeId = readRouteParam(req.params.attributeId, "attributeId");
  if (!attributeId) {
    res.status(400).json({ error: "Attribute ID is required" });
    return;
  }
  const parsed = valueSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const latestValue = await addMeasurementValue(
    category,
    userId,
    attributeId,
    parsed.data.valueNumber,
    parsed.data.measuredAt,
  );
  res.status(201).json({ latestValue });
}

async function updateVisibility(category: "bio" | "perf", req: Request, res: Response) {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const attributeId = readRouteParam(req.params.attributeId, "attributeId");
  if (!attributeId) {
    res.status(400).json({ error: "Attribute ID is required" });
    return;
  }
  const parsed = visibilitySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  await updateMeasurementVisibility(category, userId, attributeId, parsed.data.isVisible);
  res.status(204).send();
}

export async function listBioAttributes(req: Request, res: Response): Promise<void> {
  await listAttributes("bio", req, res);
}

export async function listPerfAttributes(req: Request, res: Response): Promise<void> {
  await listAttributes("perf", req, res);
}

export async function createBioAttribute(req: Request, res: Response): Promise<void> {
  await createAttribute("bio", req, res);
}

export async function createPerfAttribute(req: Request, res: Response): Promise<void> {
  await createAttribute("perf", req, res);
}

export async function addBioValue(req: Request, res: Response): Promise<void> {
  await addValue("bio", req, res);
}

export async function addPerfValue(req: Request, res: Response): Promise<void> {
  await addValue("perf", req, res);
}

export async function updateBioVisibility(req: Request, res: Response): Promise<void> {
  await updateVisibility("bio", req, res);
}

export async function updatePerfVisibility(req: Request, res: Response): Promise<void> {
  await updateVisibility("perf", req, res);
}
