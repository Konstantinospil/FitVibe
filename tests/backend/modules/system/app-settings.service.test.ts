import { HttpError } from "../../../../apps/backend/src/utils/http.js";
import {
  enableMaintenance,
  stageSettingsRevision,
} from "../../../../apps/backend/src/modules/system/app-settings.service.js";
import {
  assertActiveSudo,
} from "../../../../apps/backend/src/modules/admin/superadmin.service.js";

jest.mock("../../../../apps/backend/src/modules/admin/superadmin.service.js", () => ({
  assertActiveSudo: jest.fn(),
  assertFreshPrivilegedTotp: jest.fn(),
}));

jest.mock("../../../../apps/backend/src/db/connection.js", () => ({
  db: jest.fn(),
}));

const sudoMock = jest.mocked(assertActiveSudo);

describe("governed application settings service validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sudoMock.mockResolvedValue(undefined);
  });

  it("requires non-blank justification before enabling maintenance", async () => {
    await expect(enableMaintenance("superadmin-1", "session-1", "   ")).rejects.toMatchObject({
      status: 400,
      code: "MAINTENANCE_REASON_REQUIRED",
    } satisfies Partial<HttpError>);

    expect(sudoMock).toHaveBeenCalledWith("superadmin-1", "session-1");
  });

  it("requires non-blank justification before staging governed settings", async () => {
    await expect(
      stageSettingsRevision({
        actorUserId: "superadmin-1",
        actorSessionJti: "session-1",
        reason: "   ",
        changes: {
          "system.maintenance_message": "Planned maintenance",
        },
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: "SETTINGS_REASON_REQUIRED",
    } satisfies Partial<HttpError>);

    expect(sudoMock).toHaveBeenCalledWith("superadmin-1", "session-1");
  });
});
