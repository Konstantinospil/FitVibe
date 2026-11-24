/**
 * The backoffice calls these admin routes (#649). Authentication runs before route
 * matching, so an HTTP 401 cannot prove a route exists; inspect the router table instead.
 */
import { adminRouter } from "../../../../apps/backend/src/modules/admin/admin.routes.js";

interface RouterLayer {
  route?: { path: string; methods: Record<string, boolean> };
}

const mountedRoutes = (adminRouter.stack as RouterLayer[])
  .filter((layer) => layer.route)
  .flatMap((layer) =>
    Object.keys(layer.route!.methods).map(
      (method) => `${method.toUpperCase()} ${layer.route!.path}`,
    ),
  );

describe("admin routes used by the backoffice", () => {
  it.each([
    "GET /ops/status",
    "POST /users/:userId/role",
    "POST /users/:userId/send-verification-email",
    "POST /users/:userId/send-password-reset",
    "DELETE /users/:userId/avatar",
    "DELETE /users/:userId/display-name",
  ])("mounts %s", (route) => {
    expect(mountedRoutes).toContain(route);
  });
});
