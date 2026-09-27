import type { Request, Response, NextFunction, RequestHandler } from "express";

const ROLE_INHERITANCE: Record<string, readonly string[]> = {
  superadmin: ["superadmin", "admin"],
  admin: ["admin"],
  coach: ["coach"],
  athlete: ["athlete"],
  support: ["support"],
};

export function roleSatisfies(actualRole: string, requiredRole: string): boolean {
  const effectiveRoles = ROLE_INHERITANCE[actualRole] ?? [actualRole];
  return effectiveRoles.includes(requiredRole);
}

/**
 * Role-based access control middleware.
 * Superadmin inherits normal admin capability, but admin never inherits
 * superadmin capability.
 */
export function requireRole(roles: string[] | string): RequestHandler {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user || !user.role) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!allowed.some((requiredRole) => roleSatisfies(user.role, requiredRole))) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
