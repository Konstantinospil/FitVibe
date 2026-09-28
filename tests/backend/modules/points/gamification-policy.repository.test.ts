const dbMock = jest.fn();

jest.mock("../../../../apps/backend/src/db/connection.js", () => ({
  db: dbMock,
}));

function createVersionBuilder(
  version:
    | { version_code: string; streak_lookback_days: number }
    | undefined,
) {
  const conditionBuilder = {
    whereNull: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
  };
  const builder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockImplementation((predicate: unknown) => {
      if (typeof predicate === "function") {
        (predicate as (query: typeof conditionBuilder) => void)(conditionBuilder);
      }
      return builder;
    }),
    orderBy: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(version),
  };
  return { builder, conditionBuilder };
}

function createRowsBuilder(rows: unknown[]) {
  const builder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    select: jest.fn().mockResolvedValue(rows),
  };
  return builder;
}

describe("gamification policy repository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads the policy version and maps persisted streak tiers", async () => {
    const { builder: versionBuilder, conditionBuilder } = createVersionBuilder({
      version_code: "v2",
      streak_lookback_days: 120,
    });
    const tiersBuilder = createRowsBuilder([
      { min_days: 3, bonus_points: 5 },
      { min_days: 7, bonus_points: 15 },
    ]);

    dbMock.mockImplementation((table: string) => {
      if (table === "gamification_policy_versions") return versionBuilder;
      if (table === "gamification_streak_tiers") return tiersBuilder;
      throw new Error(`Unexpected table ${table}`);
    });

    const { getGamificationPolicy } = await import(
      "../../../../apps/backend/src/modules/points/gamification-policy.repository.js"
    );
    const at = new Date("2026-09-28T12:00:00.000Z");

    await expect(getGamificationPolicy(at)).resolves.toEqual({
      versionCode: "v2",
      streakLookbackDays: 120,
      streakTiers: [
        { minDays: 3, bonusPoints: 5 },
        { minDays: 7, bonusPoints: 15 },
      ],
    });

    expect(versionBuilder.where).toHaveBeenCalledWith("valid_from", "<=", at);
    expect(conditionBuilder.whereNull).toHaveBeenCalledWith("valid_to");
    expect(conditionBuilder.orWhere).toHaveBeenCalledWith("valid_to", ">", at);
    expect(tiersBuilder.where).toHaveBeenCalledWith({ policy_version: "v2" });
    expect(tiersBuilder.orderBy).toHaveBeenCalledWith("min_days", "asc");
  });

  it("fails explicitly when no gamification policy applies", async () => {
    const { builder: versionBuilder } = createVersionBuilder(undefined);
    dbMock.mockImplementation((table: string) => {
      if (table === "gamification_policy_versions") return versionBuilder;
      throw new Error(`Unexpected table ${table}`);
    });

    const { getGamificationPolicy } = await import(
      "../../../../apps/backend/src/modules/points/gamification-policy.repository.js"
    );
    const at = new Date("1960-01-01T00:00:00.000Z");

    await expect(getGamificationPolicy(at)).rejects.toThrow(
      "No gamification policy version applies at 1960-01-01T00:00:00.000Z",
    );
  });

  it("loads and normalizes active seasonal events for the selected policy version", async () => {
    const { builder: versionBuilder } = createVersionBuilder({
      version_code: "v1",
      streak_lookback_days: 90,
    });
    const eventsBuilder = createRowsBuilder([
      {
        policy_version: "v1",
        code: "summer",
        name: "Summer Event",
        start_at: "2026-06-01T00:00:00.000Z",
        end_at: "2026-08-31T23:59:59.000Z",
        multiplier: "1.250",
        min_sessions_for_bonus: 20,
        bonus_points: 100,
      },
    ]);

    dbMock.mockImplementation((table: string) => {
      if (table === "gamification_policy_versions") return versionBuilder;
      if (table === "gamification_seasonal_events") return eventsBuilder;
      throw new Error(`Unexpected table ${table}`);
    });

    const { getSeasonalEventPolicies } = await import(
      "../../../../apps/backend/src/modules/points/gamification-policy.repository.js"
    );
    const at = new Date("2026-07-15T12:00:00.000Z");

    await expect(getSeasonalEventPolicies(at)).resolves.toEqual([
      {
        policyVersion: "v1",
        code: "summer",
        name: "Summer Event",
        startDate: new Date("2026-06-01T00:00:00.000Z"),
        endDate: new Date("2026-08-31T23:59:59.000Z"),
        multiplier: 1.25,
        minSessionsForBonus: 20,
        bonusPoints: 100,
      },
    ]);

    expect(eventsBuilder.where).toHaveBeenCalledWith({ policy_version: "v1" });
    expect(eventsBuilder.andWhere).toHaveBeenCalledWith("start_at", "<=", at);
    expect(eventsBuilder.andWhere).toHaveBeenCalledWith("end_at", ">=", at);
    expect(eventsBuilder.orderBy).toHaveBeenCalledWith("start_at", "asc");
  });

  it("returns no seasonal events when no policy version applies", async () => {
    const { builder: versionBuilder } = createVersionBuilder(undefined);
    dbMock.mockImplementation((table: string) => {
      if (table === "gamification_policy_versions") return versionBuilder;
      throw new Error(`Unexpected table ${table}`);
    });

    const { getSeasonalEventPolicies } = await import(
      "../../../../apps/backend/src/modules/points/gamification-policy.repository.js"
    );

    await expect(
      getSeasonalEventPolicies(new Date("1960-01-01T00:00:00.000Z")),
    ).resolves.toEqual([]);
  });

  it("uses the supplied transaction as the query executor", async () => {
    const { builder: versionBuilder } = createVersionBuilder({
      version_code: "v3",
      streak_lookback_days: 60,
    });
    const tiersBuilder = createRowsBuilder([]);
    const trx = jest.fn((table: string) => {
      if (table === "gamification_policy_versions") return versionBuilder;
      if (table === "gamification_streak_tiers") return tiersBuilder;
      throw new Error(`Unexpected table ${table}`);
    });

    const { getGamificationPolicy } = await import(
      "../../../../apps/backend/src/modules/points/gamification-policy.repository.js"
    );

    await getGamificationPolicy(new Date("2026-09-28T12:00:00.000Z"), trx as never);

    expect(trx).toHaveBeenCalledWith("gamification_policy_versions");
    expect(trx).toHaveBeenCalledWith("gamification_streak_tiers");
    expect(dbMock).not.toHaveBeenCalled();
  });
});
