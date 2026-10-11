import { db } from "../../../../apps/backend/src/db/connection.js";
import {
  assertRegistrationReferenceValues,
  getRegistrationOptions,
} from "../../../../apps/backend/src/modules/auth/auth.registration-options.service.js";

jest.mock("../../../../apps/backend/src/db/connection.js", () => ({
  db: jest.fn(),
}));

const mockDb = jest.mocked(db);

type CatalogConfig = {
  genders?: Array<{ code: string; description: string }>;
  fitnessLevels?: Array<{ code: string; description: string }>;
  weight?: {
    key: string;
    min_value_metric: number | string | null;
    max_value_metric: number | string | null;
  } | null;
};

function configureCatalog({
  genders = [
    { code: "gender-a", description: "Gender A" },
    { code: "gender-b", description: "Gender B" },
  ],
  fitnessLevels = [
    { code: "level-a", description: "Level A" },
    { code: "level-b", description: "Level B" },
  ],
  weight = {
    key: "weight_kg",
    min_value_metric: "20",
    max_value_metric: 400,
  },
}: CatalogConfig = {}): void {
  mockDb.mockImplementation(
    ((tableName: string) => {
      if (tableName === "genders") {
        return {
          select: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockResolvedValue(genders),
        };
      }

      if (tableName === "fitness_levels") {
        return {
          select: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockResolvedValue(fitnessLevels),
        };
      }

      if (tableName === "bio_attributes") {
        return {
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(weight),
        };
      }

      throw new Error(`Unexpected table: ${tableName}`);
    }) as never,
  );
}

describe("registration options service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configureCatalog();
  });

  describe("getRegistrationOptions", () => {
    it("returns database catalogs and configured numeric weight bounds", async () => {
      await expect(getRegistrationOptions()).resolves.toEqual({
        genders: [
          { code: "gender-a", description: "Gender A" },
          { code: "gender-b", description: "Gender B" },
        ],
        fitnessLevels: [
          { code: "level-a", description: "Level A" },
          { code: "level-b", description: "Level B" },
        ],
        weight: { minKg: 20, maxKg: 400 },
      });

      expect(mockDb).toHaveBeenCalledWith("genders");
      expect(mockDb).toHaveBeenCalledWith("fitness_levels");
      expect(mockDb).toHaveBeenCalledWith("bio_attributes");
    });

    it("fails when the weight reference row is missing", async () => {
      configureCatalog({ weight: null });

      await expect(getRegistrationOptions()).rejects.toMatchObject({
        status: 500,
        code: "REGISTRATION_REFERENCE_DATA_MISSING",
      });
    });

    it("fails when a configured weight bound is null", async () => {
      configureCatalog({
        weight: {
          key: "weight_kg",
          min_value_metric: null,
          max_value_metric: 400,
        },
      });

      await expect(getRegistrationOptions()).rejects.toMatchObject({
        status: 500,
        code: "REGISTRATION_REFERENCE_DATA_MISSING",
      });
    });

    it("fails when a configured weight bound is not numeric", async () => {
      configureCatalog({
        weight: {
          key: "weight_kg",
          min_value_metric: "not-a-number",
          max_value_metric: 400,
        },
      });

      await expect(getRegistrationOptions()).rejects.toMatchObject({
        status: 500,
        code: "REGISTRATION_REFERENCE_DATA_MISSING",
      });
    });

    it("fails when the configured weight range is inverted", async () => {
      configureCatalog({
        weight: {
          key: "weight_kg",
          min_value_metric: 500,
          max_value_metric: 100,
        },
      });

      await expect(getRegistrationOptions()).rejects.toMatchObject({
        status: 500,
        code: "REGISTRATION_REFERENCE_DATA_INVALID",
      });
    });
  });

  describe("assertRegistrationReferenceValues", () => {
    it("accepts codes and weight present in the current database catalogs", async () => {
      await expect(
        assertRegistrationReferenceValues({
          gender: "gender-a",
          fitnessLevel: "level-b",
          weightKg: 75,
        }),
      ).resolves.toBeUndefined();
    });

    it("rejects a gender code absent from the database catalog", async () => {
      await expect(
        assertRegistrationReferenceValues({ gender: "missing-gender" }),
      ).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
    });

    it("rejects a fitness-level code absent from the database catalog", async () => {
      await expect(
        assertRegistrationReferenceValues({ fitnessLevel: "missing-level" }),
      ).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
    });

    it("rejects weight below the configured database range", async () => {
      await expect(assertRegistrationReferenceValues({ weightKg: 19 })).rejects.toMatchObject({
        status: 422,
        code: "VALIDATION_ERROR",
      });
    });

    it("rejects weight above the configured database range", async () => {
      await expect(assertRegistrationReferenceValues({ weightKg: 401 })).rejects.toMatchObject({
        status: 422,
        code: "VALIDATION_ERROR",
      });
    });
  });
});
