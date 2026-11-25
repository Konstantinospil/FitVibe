import { Router } from "express";
import { rateLimit } from "../common/rateLimiter.js";
import { reportClientError } from "./client-errors.controller.js";

export const clientErrorsRouter = Router();

// Public on purpose: errors on the login and registration pages matter too.
// CSRF and origin validation apply globally; the route limit bounds log volume.
clientErrorsRouter.post("/", rateLimit("client_errors_report"), reportClientError);
