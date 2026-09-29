/**
 * Contact controller - Request/response handling
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { HttpError } from "../../utils/http.js";
import {
  submitContactMessage,
  getContactMessagesList,
  getContactMessage,
  markMessageAsRead,
  markMessageAsResponded,
  saveMessageResponse,
} from "./contact.service.js";
import { z } from "zod";

const submitContactSchema = z.object({
  email: z.string().email().max(255),
  topic: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
});

/**
 * Submit a contact form message
 * Public endpoint - no authentication required
 */
export const submitContactHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const body = submitContactSchema.parse(req.body);
    const userId = req.user?.sub || null;

    const message = await submitContactMessage({
      userId,
      email: body.email,
      topic: body.topic,
      message: body.message,
    });

    res.status(201).json({
      success: true,
      data: {
        id: message.id,
        createdAt: message.createdAt,
      },
    });
  },
);

/**
 * List contact messages (admin only)
 */
export const listContactMessagesHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const limit =
      req.query.limit && typeof req.query.limit === "string"
        ? Number.parseInt(req.query.limit, 10)
        : 50;
    const offset =
      req.query.offset && typeof req.query.offset === "string"
        ? Number.parseInt(req.query.offset, 10)
        : 0;
    const unreadOnly = req.query.unreadOnly === "true";
    const openOnly = req.query.openOnly === "true";

    const messages = await getContactMessagesList({
      limit: Math.min(limit, 100),
      offset,
      unreadOnly,
      openOnly,
    });

    res.json({
      success: true,
      data: messages,
    });
  },
);

/**
 * Get a contact message by ID (admin only)
 */
export const getContactMessageHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = readRouteParam(req.params.id, "id");
    const message = await getContactMessage(id);

    res.json({
      success: true,
      data: message,
    });
  },
);

/**
 * Mark a contact message as read (admin only)
 */
export const markMessageAsReadHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = readRouteParam(req.params.id, "id");
    const userId = req.user?.sub;
    if (!userId) {
      throw new HttpError(401, "UNAUTHENTICATED", "User not authenticated");
    }

    const message = await markMessageAsRead(id, userId);

    res.json({
      success: true,
      data: message,
    });
  },
);

/**
 * Mark a contact message as responded (admin only)
 */
export const markMessageAsRespondedHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = readRouteParam(req.params.id, "id");
    const userId = req.user?.sub;
    if (!userId) {
      throw new HttpError(401, "UNAUTHENTICATED", "User not authenticated");
    }

    const message = await markMessageAsResponded(id, userId);

    res.json({
      success: true,
      data: message,
    });
  },
);

const saveResponseSchema = z.object({
  response: z.string().min(1).max(5000),
});

/**
 * Save response text for a contact message (admin only)
 */
export const saveMessageResponseHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = readRouteParam(req.params.id, "id");
    const userId = req.user?.sub;
    if (!userId) {
      throw new HttpError(401, "UNAUTHENTICATED", "User not authenticated");
    }

    const body = saveResponseSchema.parse(req.body);
    const message = await saveMessageResponse(id, userId, body.response);

    res.json({
      success: true,
      data: message,
    });
  },
);
