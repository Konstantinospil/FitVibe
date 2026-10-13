import type { Request, Response } from "express";
import {
  listActionMappingsHandler,
  upsertActionMappingHandler,
} from "../../../../apps/backend/src/modules/admin/admin.controller.js";
import { db } from "../../../../apps/backend/src/db/index.js";
import { HttpError } from "../../../../apps/backend/src/utils/http.js";

jest.mock("../../../../apps/backend/src/db/index.js", () => ({
  db: jest.fn(),
}));

describe("Admin action mapping handlers", () => {
  const response = () => ({ json: jest.fn() }) as unknown as Response;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("lists distinct actions with their configured display names", async () => {
    const rows = [{ action: "user_login", uiName: "User login" }];
    const builder = {
      distinct: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockResolvedValue(rows),
    };
    jest.mocked(db).mockReturnValue(builder as never);
    const res = response();

    await listActionMappingsHandler({} as Request, res);

    expect(db).toHaveBeenCalledWith("audit_log as al");
    expect(builder.distinct).toHaveBeenCalledWith("al.action");
    expect(builder.leftJoin).toHaveBeenCalledWith(
      "audit_action_mappings as am",
      "am.action",
      "al.action",
    );
    expect(builder.orderBy).toHaveBeenCalledWith("al.action", "asc");
    expect(res.json).toHaveBeenCalledWith({ mappings: rows });
  });

  it("upserts a validated mapping and returns its saved value", async () => {
    const rows = [{ action: "user_login", uiName: "User login" }];
    const builder = {
      insert: jest.fn().mockReturnThis(),
      onConflict: jest.fn().mockReturnThis(),
      merge: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue(rows),
    };
    jest.mocked(db).mockReturnValue(builder as never);
    Object.assign(db, { fn: { now: jest.fn().mockReturnValue("now") } });
    const res = response();
    const req = {
      body: { action: " user_login ", uiName: " User login " },
    } as Request;

    await upsertActionMappingHandler(req, res);

    expect(builder.insert).toHaveBeenCalledWith({
      action: "user_login",
      ui_name: "User login",
      updated_at: "now",
    });
    expect(builder.onConflict).toHaveBeenCalledWith("action");
    expect(builder.merge).toHaveBeenCalledWith(["ui_name", "updated_at"]);
    expect(res.json).toHaveBeenCalledWith({ mapping: rows[0] });
  });

  it.each([
    { action: "", uiName: "Name" },
    { action: "action", uiName: " " },
    { action: 10, uiName: "Name" },
    { action: "action", uiName: 10 },
    { action: "x".repeat(256), uiName: "Name" },
    { action: "action", uiName: "x".repeat(256) },
  ])("rejects invalid mapping data: %j", async (body) => {
    const res = response();

    await expect(
      upsertActionMappingHandler({ body } as Request, res),
    ).rejects.toMatchObject({
      status: 400,
      code: "INVALID_ACTION_MAPPING",
    } satisfies Partial<HttpError>);
    expect(db).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
