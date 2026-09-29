import { Router } from "express";
import { requireAccessToken } from "../auth/auth.middleware.js";
import { requireRole } from "../common/rbac.middleware.js";
import { rateLimit, rateLimitByIPAndEmail } from "../common/rateLimiter.js";
import {
  submitContactHandler,
  listContactMessagesHandler,
  getContactMessageHandler,
  markMessageAsReadHandler,
  markMessageAsRespondedHandler,
  saveMessageResponseHandler,
} from "./contact.controller.js";

export const contactRouter = Router();

// Public endpoint - submit contact form
// Rate limit: 5 messages per hour per IP and per email address
contactRouter.post(
  "/",
  rateLimitByIPAndEmail("contact_submit"), // 5 requests per hour per IP and per email
  submitContactHandler,
);

// Admin endpoints - require authentication and admin role
contactRouter.get(
  "/messages",
  requireAccessToken,
  requireRole("admin"),
  rateLimit("contact_list"),
  listContactMessagesHandler,
);

contactRouter.get(
  "/messages/:id",
  requireAccessToken,
  requireRole("admin"),
  rateLimit("contact_get"),
  getContactMessageHandler,
);

contactRouter.post(
  "/messages/:id/read",
  requireAccessToken,
  requireRole("admin"),
  rateLimit("contact_mark_read"),
  markMessageAsReadHandler,
);

contactRouter.post(
  "/messages/:id/responded",
  requireAccessToken,
  requireRole("admin"),
  rateLimit("contact_mark_responded"),
  markMessageAsRespondedHandler,
);

contactRouter.post(
  "/messages/:id/response",
  requireAccessToken,
  requireRole("admin"),
  rateLimit("contact_save_response"),
  saveMessageResponseHandler,
);
