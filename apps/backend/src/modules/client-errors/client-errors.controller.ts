import type { Request, Response } from "express";
import { ClientErrorReportSchema } from "./client-errors.schemas.js";
import { recordClientError } from "./client-errors.service.js";

export function reportClientError(req: Request, res: Response): void {
  const parsed = ClientErrorReportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid client error report",
        requestId: res.locals.requestId,
      },
    });
    return;
  }

  recordClientError(parsed.data, res.locals.requestId as string | undefined);
  res.status(204).end();
}
