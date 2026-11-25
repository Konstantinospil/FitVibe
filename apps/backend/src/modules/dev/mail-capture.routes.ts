import { Router } from "express";
import { clearCapturedMail, listCapturedMail } from "../../services/mail-capture.service.js";

/**
 * Non-production test mailbox (ADR-039). app.ts mounts this router only when
 * isMailCaptureEnabled() is true, which env.ts makes impossible in production.
 */
export const mailCaptureRouter = Router();

mailCaptureRouter.get("/mail", (req, res) => {
  const to = typeof req.query.to === "string" ? req.query.to : undefined;
  res.json({ messages: listCapturedMail(to) });
});

mailCaptureRouter.delete("/mail", (_req, res) => {
  clearCapturedMail();
  res.status(204).end();
});
