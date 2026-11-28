import { db } from "../../../../apps/backend/src/db/connection.js";
import * as repository from "../../../../apps/backend/src/modules/sessions/sessions.repository.js";
import { insertAudit } from "../../../../apps/backend/src/modules/common/audit.util.js";
import {
  INTAKE_LIMITS,
  addIntakeEntry,
  deleteIntakeEntry,
  insertLoggedIntake,
  intakeMaxAmount,
} from "../../../../apps/backend/src/modules/sessions/sessions.intake.service.js";

jest.mock("../../../../apps/backend/src/db/connection.js", () => ({ db: jest.fn() }));
jest.mock("../../../../apps/backend/src/modules/sessions/sessions.repository.js", () => ({
  ...jest.requireActual("../../../../apps/backend/src/modules/sessions/sessions.repository.js"),
  getSessionById: jest.fn(),
  findSessionIntake: jest.fn(),
}));
jest.mock("../../../../apps/backend/src/modules/common/audit.util.js");

const mockDb = db as unknown as jest.Mock;
const mockRepo = jest.mocked(repository);
const intake = { entries: [], totals: { water_ml: 500, energy_kcal: 0 } };

beforeEach(() => {
  jest.clearAllMocks();
  mockRepo.findSessionIntake.mockResolvedValue(intake);
});

describe("intake limits", () => {
  it("gives each kind its own ceiling", () => {
    expect(intakeMaxAmount("water")).toBe(INTAKE_LIMITS.waterMaxMl);
    expect(intakeMaxAmount("energy")).toBe(INTAKE_LIMITS.energyMaxKcal);
  });
});

describe("addIntakeEntry", () => {
  const insert = jest.fn();
  beforeEach(() => {
    insert.mockReturnValue({ returning: async () => [{ id: "entry-1" }] });
    mockDb.mockReturnValue({ insert });
  });

  it.each(["in_progress", "completed"])("records an entry on a %s workout", async (status) => {
    mockRepo.getSessionById.mockResolvedValue({ id: "s1", status } as never);

    await expect(addIntakeEntry("u1", "s1", { kind: "water", amount: 500 })).resolves.toBe(intake);

    expect(insert).toHaveBeenCalledWith({ session_id: "s1", kind: "water", amount: 500 });
    expect(insertAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "intake_recorded", entityId: "entry-1" }),
    );
  });

  it("refuses a workout that has not started", async () => {
    mockRepo.getSessionById.mockResolvedValue({ id: "s1", status: "planned" } as never);
    await expect(addIntakeEntry("u1", "s1", { kind: "energy", amount: 90 })).rejects.toMatchObject({
      status: 409,
      code: "E.SESSION.INTAKE_NOT_STARTED",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("answers 404 for someone else's session", async () => {
    mockRepo.getSessionById.mockResolvedValue(undefined);
    await expect(addIntakeEntry("u1", "s1", { kind: "water", amount: 1 })).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("deleteIntakeEntry", () => {
  const del = jest.fn();
  beforeEach(() => {
    mockRepo.getSessionById.mockResolvedValue({ id: "s1", status: "completed" } as never);
    mockDb.mockReturnValue({ where: () => ({ del }) });
  });

  it("removes the entry and audits it", async () => {
    del.mockResolvedValue(1);
    await expect(deleteIntakeEntry("u1", "s1", "entry-1")).resolves.toBe(intake);
    expect(insertAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "intake_deleted" }));
  });

  it("answers 404 for an entry that is not on this session", async () => {
    del.mockResolvedValue(0);
    await expect(deleteIntakeEntry("u1", "s1", "entry-9")).rejects.toMatchObject({
      status: 404,
      code: "E.SESSION.INTAKE_NOT_FOUND",
    });
    expect(insertAudit).not.toHaveBeenCalled();
  });
});

describe("insertLoggedIntake", () => {
  it("stamps a logged workout's entries with its end time", async () => {
    const insert = jest.fn();
    const trx = jest.fn(() => ({ insert })) as never;
    await insertLoggedIntake(trx, "s1", "2026-11-27T10:00:00.000Z", [
      { kind: "water", amount: 750 },
      { kind: "energy", amount: 200 },
    ]);
    expect(insert).toHaveBeenCalledWith([
      { session_id: "s1", kind: "water", amount: 750, recorded_at: "2026-11-27T10:00:00.000Z" },
      { session_id: "s1", kind: "energy", amount: 200, recorded_at: "2026-11-27T10:00:00.000Z" },
    ]);
  });

  it("writes nothing without entries", async () => {
    const trx = jest.fn() as never;
    await insertLoggedIntake(trx, "s1", "2026-11-27T10:00:00.000Z", []);
    expect(trx).not.toHaveBeenCalled();
  });
});
