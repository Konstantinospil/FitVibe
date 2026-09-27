import request from "supertest";
import app from "../../../apps/backend/src/app.js";
import { env } from "../../../apps/backend/src/config/env.js";
import { APP_SETTINGS_REGISTRY } from "../../../apps/backend/src/modules/system/app-settings.registry.js";

const mutableEnv = env as {
  readOnlyMode: boolean;
  maintenanceMessage: string;
};

describe("app entrypoint integration", () => {
  afterEach(() => {
    mutableEnv.readOnlyMode = false;
    mutableEnv.maintenanceMessage = "System is temporarily in read-only mode for maintenance";
  });

  it("attaches a request id to 404 responses", async () => {
    const response = await request(app).get("/totally-missing-route");

    expect(response.status).toBe(404);
    const requestId = response.body.error?.requestId;
    expect(typeof requestId).toBe("string");
    expect(response.headers["x-request-id"]).toBe(requestId);
  });

  it("blocks mutation endpoints when read-only mode is enabled", async () => {
    mutableEnv.readOnlyMode = true;
    mutableEnv.maintenanceMessage = "Maintenance window";

    const response = await request(app).post("/api/v1/users");

    expect(response.status).toBe(503);
    expect(response.body.error).toMatchObject({
      code: "E.SYSTEM.READ_ONLY",
      message: APP_SETTINGS_REGISTRY["system.maintenance_message"].defaultValue,
      details: {
        readOnlyMode: true,
        path: "/api/v1/users",
      },
    });
    expect(response.headers["x-request-id"]).toBeDefined();
  });
});
