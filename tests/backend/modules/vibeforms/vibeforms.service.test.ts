import {
  getVibeformProfile,
  getVibeformPreferences,
  normalizeVibeLevel,
  updateVibeformPreferences,
} from "../../../../apps/backend/src/modules/vibeforms/vibeforms.service.js";
import * as measurementsRepository from "../../../../apps/backend/src/modules/measurements/measurements.repository.js";
import * as vibeLevelRepository from "../../../../apps/backend/src/modules/points/vibe-level.repository.js";
import * as sessionsRepository from "../../../../apps/backend/src/modules/sessions/sessions.repository.js";
import * as repository from "../../../../apps/backend/src/modules/vibeforms/vibeforms.repository.js";
import * as gamificationProjection from "../../../../apps/backend/src/modules/points/gamification-projection.service.js";

jest.mock("../../../../apps/backend/src/db/connection.js", () => ({
  db: jest.fn(),
}));
jest.mock("../../../../apps/backend/src/modules/vibeforms/vibeforms.repository.js");
jest.mock("../../../../apps/backend/src/modules/measurements/measurements.repository.js");
jest.mock("../../../../apps/backend/src/modules/points/vibe-level.repository.js");
jest.mock("../../../../apps/backend/src/modules/sessions/sessions.repository.js");
jest.mock("../../../../apps/backend/src/modules/points/gamification-projection.service.js");

const mockedRepository = jest.mocked(repository);
const mockedMeasurementsRepository = jest.mocked(measurementsRepository);
const mockedVibeLevelRepository = jest.mocked(vibeLevelRepository);
const mockedSessionsRepository = jest.mocked(sessionsRepository);
const mockedGamificationProjection = jest.mocked(gamificationProjection);
const userId = "c4f6d130-9696-4cb3-8d3e-f8f619ab804d";

describe("Vibeform preference service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns documented defaults when the user has no stored choice", async () => {
    mockedRepository.findVibeformPreferences.mockResolvedValue(null);

    await expect(getVibeformPreferences(userId)).resolves.toEqual({
      templateCode: "flow",
      templateVersion: 1,
      bodyProfile: "balanced",
      motionEnabled: true,
    });
  });

  it("merges a partial update and pins the registered template version", async () => {
    mockedRepository.findVibeformPreferences.mockResolvedValue({
      user_id: userId,
      template_code: "flow",
      template_version: 1,
      body_profile: "balanced",
      motion_enabled: true,
      created_at: "2026-09-19T00:00:00.000Z",
      updated_at: "2026-09-19T00:00:00.000Z",
    });
    mockedRepository.upsertVibeformPreferences.mockImplementation(async (id, preferences) => ({
      user_id: id,
      template_code: preferences.templateCode,
      template_version: preferences.templateVersion,
      body_profile: preferences.bodyProfile,
      motion_enabled: preferences.motionEnabled,
      created_at: "2026-09-19T00:00:00.000Z",
      updated_at: "2026-09-19T00:01:00.000Z",
    }));

    await expect(
      updateVibeformPreferences(userId, {
        bodyProfile: "hip-dominant",
        motionEnabled: false,
      }),
    ).resolves.toEqual({
      templateCode: "flow",
      templateVersion: 1,
      bodyProfile: "hip-dominant",
      motionEnabled: false,
    });

    expect(mockedRepository.upsertVibeformPreferences).toHaveBeenCalledWith(userId, {
      templateCode: "flow",
      templateVersion: 1,
      bodyProfile: "hip-dominant",
      motionEnabled: false,
    });
  });
});

describe("Vibeform profile service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGamificationProjection.ensureGamificationProjectionFresh.mockResolvedValue(undefined);
    mockedRepository.findVibeformPreferences.mockResolvedValue(null);
  });

  it("normalizes persisted source data into the renderer contract", async () => {
    mockedMeasurementsRepository.getLatestBioValuesByKeys.mockResolvedValue({
      weight_kg: { key: "weight_kg", valueNumber: 81, measuredAt: "2026-09-18T00:00:00Z" },
      height_cm: { key: "height_cm", valueNumber: 180, measuredAt: "2026-09-01T00:00:00Z" },
    });
    mockedVibeLevelRepository.getAllDomainVibeLevels.mockResolvedValue(
      new Map([
        ["intelligence", { vibe_level: 100 }],
        ["regeneration", { vibe_level: 680 }],
        ["agility", { vibe_level: 1260 }],
        ["explosivity", { vibe_level: 1840 }],
        ["endurance", { vibe_level: 2420 }],
        ["strength", { vibe_level: 3000 }],
      ]) as never,
    );
    const now = new Date("2026-09-19T18:00:00.000Z");
    mockedSessionsRepository.listRegionalStrengthStimuli.mockResolvedValue([
      { region: "upper", completedAt: now.toISOString(), setCount: 36, averageRpe: 10 },
      { region: "lower", completedAt: now.toISOString(), setCount: 72, averageRpe: null },
      {
        region: "fullBody",
        completedAt: "2026-08-08T18:00:00.000Z",
        setCount: 72,
        averageRpe: 10,
      },
    ]);

    await expect(getVibeformProfile(userId, now)).resolves.toEqual({
      preferences: {
        templateCode: "flow",
        templateVersion: 1,
        bodyProfile: "balanced",
        motionEnabled: true,
      },
      metrics: {
        intelligence: 0,
        regeneration: 0.2,
        agility: 0.4,
        explosivity: 0.6,
        endurance: 0.8,
        strength: 1,
        upperBodyLoad: 0.75,
        lowerBodyLoad: 1,
        bmi: 25,
        heightCm: 180,
      },
      calculationVersion: "2",
      calculatedAt: now.toISOString(),
    });
    expect(mockedSessionsRepository.listRegionalStrengthStimuli).toHaveBeenCalledWith(userId, {
      from: new Date("2026-06-27T18:00:00.000Z"),
      to: now,
    });
  });

  it("uses initial Vibe levels and nullable body metrics when source rows are absent", async () => {
    mockedMeasurementsRepository.getLatestBioValuesByKeys.mockResolvedValue({});
    mockedVibeLevelRepository.getAllDomainVibeLevels.mockResolvedValue(new Map());
    mockedSessionsRepository.listRegionalStrengthStimuli.mockResolvedValue([]);

    const profile = await getVibeformProfile(userId, new Date("2026-09-19T00:00:00.000Z"));

    expect(profile.metrics.bmi).toBeNull();
    expect(profile.metrics.heightCm).toBeNull();
    expect(profile.metrics.strength).toBeCloseTo(900 / 2900);
    expect(profile.metrics.upperBodyLoad).toBe(0);
  });

  it("clamps Vibe levels outside the supported rating range", () => {
    expect(normalizeVibeLevel(-100)).toBe(0);
    expect(normalizeVibeLevel(3100)).toBe(1);
  });

  it.each([
    ["no training", [], 0, 0],
    [
      "upper-body training",
      [{ region: "upper", completedAt: "2026-09-19T00:00:00.000Z", setCount: 72, averageRpe: null }],
      1,
      0,
    ],
    [
      "lower-body training",
      [{ region: "lower", completedAt: "2026-09-19T00:00:00.000Z", setCount: 72, averageRpe: null }],
      0,
      1,
    ],
    [
      "full-body training",
      [
        {
          region: "fullBody",
          completedAt: "2026-09-19T00:00:00.000Z",
          setCount: 72,
          averageRpe: null,
        },
      ],
      0.5,
      0.5,
    ],
  ] as const)("allocates %s without leaking load between regions", async (_name, stimuli, upper, lower) => {
    mockedMeasurementsRepository.getLatestBioValuesByKeys.mockResolvedValue({});
    mockedVibeLevelRepository.getAllDomainVibeLevels.mockResolvedValue(new Map());
    mockedSessionsRepository.listRegionalStrengthStimuli.mockResolvedValue([...stimuli]);

    const result = await getVibeformProfile(userId, new Date("2026-09-19T00:00:00.000Z"));

    expect(result.metrics.upperBodyLoad).toBe(upper);
    expect(result.metrics.lowerBodyLoad).toBe(lower);
  });

  it("keeps invalid physical measurements nullable instead of fabricating body data", async () => {
    mockedMeasurementsRepository.getLatestBioValuesByKeys.mockResolvedValue({
      weight_kg: { key: "weight_kg", valueNumber: 0, measuredAt: "2026-09-19T00:00:00Z" },
      height_cm: { key: "height_cm", valueNumber: -10, measuredAt: "2026-09-19T00:00:00Z" },
    });
    mockedVibeLevelRepository.getAllDomainVibeLevels.mockResolvedValue(new Map());
    mockedSessionsRepository.listRegionalStrengthStimuli.mockResolvedValue([]);

    const result = await getVibeformProfile(userId, new Date("2026-09-19T00:00:00.000Z"));

    expect(result.metrics.bmi).toBeNull();
    expect(result.metrics.heightCm).toBeNull();
  });
});
