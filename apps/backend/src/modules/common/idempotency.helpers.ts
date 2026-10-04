import type { Request, Response } from "express";
import { HttpError } from "../../utils/http.js";
import { resolveIdempotency, persistIdempotencyResult } from "./idempotency.service.js";

/**
 * Extract and validate the Idempotency-Key header from request
 * @param req - Express request object
 * @returns Idempotency key or null if not provided
 * @throws HttpError if key is invalid
 */
export function getIdempotencyKey(req: Request): string | null {
  const header = req.get("Idempotency-Key");
  if (!header) {
    return null;
  }
  const key = header.trim();
  if (!key) {
    throw new HttpError(400, "E.IDEMPOTENCY.INVALID", "Idempotency key cannot be empty");
  }
  if (key.length > 200) {
    throw new HttpError(
      400,
      "E.IDEMPOTENCY.INVALID",
      "Idempotency-Key header must be 200 characters or fewer",
    );
  }
  return key;
}

/**
 * Get the route template from the request for idempotency scoping
 * @param req - Express request object
 * @returns Route template (e.g., "/api/v1/users/:id")
 * @throws HttpError if route template is invalid or suspicious
 */
export function getRouteTemplate(req: Request): string {
  const base = req.baseUrl ?? "";
  const routeInfo = req.route as unknown;
  let path = "";
  if (routeInfo && typeof routeInfo === "object" && "path" in routeInfo) {
    const candidate = (routeInfo as { path?: unknown }).path;
    if (typeof candidate === "string") {
      path = candidate;
    }
  }
  const combined = `${base}${path}`.replace(/\/{2,}/g, "/");
  const trimmed =
    combined.length > 1 && combined.endsWith("/") ? combined.slice(0, -1) : combined || "/";
  const route = trimmed || "/";

  // Validate route template to prevent manipulation
  // Route should start with / and contain only valid characters
  if (!route.startsWith("/")) {
    throw new HttpError(400, "E.ROUTE.INVALID", "Invalid route template");
  }
  // Check for control characters or suspicious patterns
  // eslint-disable-next-line no-control-regex -- Security check: detect control characters in route
  if (/[\x00-\x1F\x7F]/.test(route)) {
    throw new HttpError(400, "E.ROUTE.INVALID", "Route template contains invalid characters");
  }
  // Limit length to prevent abuse
  if (route.length > 500) {
    throw new HttpError(400, "E.ROUTE.INVALID", "Route template too long");
  }

  return route;
}

/**
 * Get authenticated user ID from request
 * @param req - Express request object
 * @param _res - Express response object (unused)
 * @returns User ID
 * @throws HttpError if not authenticated
 */
export function requireAuthenticatedUser(req: Request, _res: Response): string {
  const candidate = req.user;
  if (candidate && typeof candidate === "object" && "sub" in candidate) {
    const sub = (candidate as { sub?: unknown }).sub;
    if (typeof sub === "string") {
      return sub;
    }
  }
  throw new HttpError(401, "E.AUTH.REQUIRED", "Authentication required");
}

/**
 * Handle idempotent request execution
 * Wraps the handler function with idempotency checking and result persistence
 *
 * @param req - Express request
 * @param res - Express response
 * @param userId - Authenticated user ID
 * @param payload - Request payload to hash
 * @param handler - Async function that executes the actual operation
 * @returns True if handled (either replayed or executed), false if no idempotency key
 */
export async function handleIdempotentRequest<T>(
  req: Request,
  res: Response,
  userId: string,
  payload: unknown,
  handler: () => Promise<{ status: number; body: T }>,
): Promise<boolean> {
  const key = getIdempotencyKey(req);
  if (!key) {
    return false; // No idempotency key, proceed normally
  }

  const route = getRouteTemplate(req);
  const method = req.method;

  let recordId: string | null = null;

  // Check if this is a replay or new request
  const resolution = await resolveIdempotency(
    {
      userId,
      method,
      route,
      key,
    },
    payload,
  );

  if (resolution.type === "replay") {
    // Replay previous response
    res.set("Idempotency-Key", key);
    res.set("Idempotent-Replayed", "true");
    if (resolution.status === 204) {
      res.status(204).send();
    } else {
      res.status(resolution.status).json(resolution.body);
    }
    return true;
  }

  if (resolution.type === "pending") {
    throw new HttpError(
      409,
      "E.IDEMPOTENCY.IN_PROGRESS",
      "A request with this idempotency key is already in progress",
    );
  }

  recordId = resolution.recordId;

  // Execute the handler
  const result = await handler();

  // Persist the result
  if (recordId) {
    await persistIdempotencyResult(recordId, result.status, result.body);
  }

  // Send response
  res.set("Idempotency-Key", key);
  if (result.status === 204) {
    res.status(204).send();
  } else {
    res.status(result.status).json(result.body);
  }
  return true;
}
