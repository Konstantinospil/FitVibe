export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function createHttpError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): HttpError {
  return new HttpError(status, code, message, details);
}


/**
 * Read a named Express route parameter as a scalar string.
 *
 * Express 5 types allow route parameters to be string arrays for wildcard
 * captures. FitVibe's named controller parameters are scalar, so arrays are
 * rejected instead of silently coerced.
 */
export function readRouteParam(
  value: string | string[] | undefined,
  name: string,
  fallback?: string,
): string {
  if (typeof value === "string") {
    return value;
  }

  if (value === undefined && fallback !== undefined) {
    return fallback;
  }

  throw new HttpError(
    400,
    "INVALID_ROUTE_PARAMETER",
    `Route parameter '${name}' must be a single value`,
  );
}
