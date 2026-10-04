import { db } from "../../../../apps/backend/src/db/connection.js";
import * as exerciseService from "../../../../apps/backend/src/modules/exercises/exercise.service.js";
import * as exerciseRepository from "../../../../apps/backend/src/modules/exercises/exercise.repository.js";
import { HttpError } from "../../../../apps/backend/src/utils/http.js";
import type {
  CreateExerciseDTO,
  UpdateExerciseDTO,
  Exercise,
} from "../../../../apps/backend/src/modules/exercises/exercise.types.js";

// Mock dependencies
jest.mock("../../../../apps/backend/src/modules/exercises/exercise.repository.js");
// Track builders by table name for configuration
const queryBuilders: Record<
  string,
  { first: jest.Mock; whereRaw: jest.Mock; andWhere: jest.Mock }
> = {};

jest.mock("../../../../apps/backend/src/db/connection.js", () => {
  const createQueryBuilder = (table: string, defaultValue: unknown = null) => {
    // Get or create builder for this table
    let builderData = queryBuilders[table];
    if (!builderData) {
      const mockFirst = jest.fn().mockResolvedValue(defaultValue);
      const mockWhereRaw = jest.fn(function (this: unknown) {
        return this;
      });
      const mockAndWhere = jest.fn(function (this: unknown) {
        return this;
      });
      builderData = { first: mockFirst, whereRaw: mockWhereRaw, andWhere: mockAndWhere };
      queryBuilders[table] = builderData;
    }

    const builder = Object.assign(Promise.resolve(defaultValue), {
      where: jest.fn(function (this: unknown) {
        return this;
      }),
      whereRaw: builderData.whereRaw,
      andWhere: builderData.andWhere,
      andWhereNot: jest.fn(function (this: unknown) {
        return this;
      }),
      whereNull: jest.fn(function (this: unknown) {
        return this;
      }),
      first: builderData.first,
      select: jest.fn(function (this: unknown) {
        return this;
      }),
    });
    return Object.assign(
      jest.fn((table: string) => builder),
      builder,
    );
  };

  const mockDbFunction = jest.fn((table: string) => createQueryBuilder(table, null)) as jest.Mock;

  return {
    db: mockDbFunction,
  };
});

const mockExerciseRepo = jest.mocked(exerciseRepository);
const mockDb = jest.mocked(db);

describe("Exercise Service", () => {
  const userId = "user-123";
  const exerciseId = "exercise-123";
  const typeCode = "strength";

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear query builders
    Object.keys(queryBuilders).forEach((key) => delete queryBuilders[key]);
  });

  describe("getAll", () => {
    it("should return paginated exercises", async () => {
      const query = { page: 1, limit: 10 };
      const expectedResult = {
        items: [],
        total: 0,
        page: 1,
        limit: 10,
      };

      mockExerciseRepo.listExercises.mockResolvedValue(expectedResult);

      const result = await exerciseService.getAll(userId, query);

      expect(result).toEqual(expectedResult);
      expect(mockExerciseRepo.listExercises).toHaveBeenCalledWith(userId, query, false);
    });

    it("should pass isAdmin flag to repository", async () => {
      const query = { page: 1, limit: 10 };
      mockExerciseRepo.listExercises.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 10,
      });

      await exerciseService.getAll(userId, query, true);

      expect(mockExerciseRepo.listExercises).toHaveBeenCalledWith(userId, query, true);
    });
  });

  describe("getOne", () => {
    const mockExercise: Exercise = {
      id: exerciseId,
      name: "Test Exercise",
      type_code: typeCode,
      owner_id: userId,
      is_public: false,
      tags: [],
      archived_at: null,
    };

    it("should return exercise when found", async () => {
      mockExerciseRepo.getExercise.mockResolvedValue(mockExercise);

      const result = await exerciseService.getOne(exerciseId, userId);

      expect(result).toEqual(mockExercise);
      expect(mockExerciseRepo.getExercise).toHaveBeenCalledWith(exerciseId, userId);
    });

    it("should throw 404 when exercise not found", async () => {
      mockExerciseRepo.getExercise.mockResolvedValue(null);

      await expect(exerciseService.getOne(exerciseId, userId)).rejects.toThrow(HttpError);
      await expect(exerciseService.getOne(exerciseId, userId)).rejects.toThrow(
        "EXERCISE_NOT_FOUND",
      );
    });

    it("should throw 404 when exercise belongs to different user", async () => {
      const otherUserExercise: Exercise = {
        ...mockExercise,
        owner_id: "other-user",
      };

      mockExerciseRepo.getExercise.mockResolvedValue(otherUserExercise);

      await expect(exerciseService.getOne(exerciseId, userId)).rejects.toThrow(HttpError);
    });

    it("should return a public exercise owned by a different user", async () => {
      const publicExercise: Exercise = {
        ...mockExercise,
        owner_id: "other-user",
        is_public: true,
      };

      mockExerciseRepo.getExercise.mockResolvedValue(publicExercise);

      const result = await exerciseService.getOne(exerciseId, userId);

      expect(result).toEqual(publicExercise);
    });

    it("should throw 404 when exercise is archived", async () => {
      const archivedExercise: Exercise = {
        ...mockExercise,
        archived_at: new Date().toISOString(),
      };

      mockExerciseRepo.getExercise.mockResolvedValue(archivedExercise);

      await expect(exerciseService.getOne(exerciseId, userId)).rejects.toThrow(HttpError);
    });

    it("should use getExerciseRaw for admin", async () => {
      mockExerciseRepo.getExerciseRaw.mockResolvedValue(mockExercise);

      const result = await exerciseService.getOne(exerciseId, userId, true);

      expect(result).toEqual(mockExercise);
      expect(mockExerciseRepo.getExerciseRaw).toHaveBeenCalledWith(exerciseId);
    });
  });

  describe("createOne", () => {
    const validDto: CreateExerciseDTO = {
      name: "Test Exercise",
      type_code: typeCode,
    };

    it("should create exercise successfully", async () => {
      const mockCreated: Exercise = {
        id: exerciseId,
        name: "Test Exercise",
        type_code: typeCode,
        owner_id: userId,
        is_public: false,
        tags: [],
        archived_at: null,
      };

      // Configure mocks: type exists, name is unique
      // Ensure builders exist by calling db() first
      mockDb("exercise_types");
      mockDb("exercises");
      if (queryBuilders["exercise_types"]) {
        queryBuilders["exercise_types"].first.mockResolvedValue({ code: typeCode });
      }
      if (queryBuilders["exercises"]) {
        queryBuilders["exercises"].first.mockResolvedValue(null); // No duplicate
      }

      mockExerciseRepo.createExercise.mockResolvedValue(undefined);
      mockExerciseRepo.getExercise.mockResolvedValue(mockCreated);

      const result = await exerciseService.createOne(userId, validDto);

      expect(result).toEqual(mockCreated);
      expect(mockExerciseRepo.createExercise).toHaveBeenCalled();
    });

    it("should throw error when type does not exist", async () => {
      // Configure mock: type does not exist
      mockDb("exercise_types");
      if (queryBuilders["exercise_types"]) {
        queryBuilders["exercise_types"].first.mockResolvedValue(null);
      }

      await expect(exerciseService.createOne(userId, validDto)).rejects.toThrow(HttpError);
      await expect(exerciseService.createOne(userId, validDto)).rejects.toThrow(
        "EXERCISE_INVALID_TYPE",
      );
    });

    it("should throw error when name is duplicate", async () => {
      // Configure mocks: type exists, but name is duplicate
      mockDb("exercise_types");
      mockDb("exercises");
      if (queryBuilders["exercise_types"]) {
        queryBuilders["exercise_types"].first.mockResolvedValue({ code: typeCode });
      }
      if (queryBuilders["exercises"]) {
        queryBuilders["exercises"].first.mockResolvedValue({ id: "existing-exercise" });
      }

      await expect(exerciseService.createOne(userId, validDto)).rejects.toThrow(HttpError);
      await expect(exerciseService.createOne(userId, validDto)).rejects.toThrow(
        "EXERCISE_DUPLICATE",
      );
    });

    it("should throw error when non-admin tries to set owner_id", async () => {
      const dtoWithOwner: CreateExerciseDTO = {
        ...validDto,
        owner_id: "other-user",
      };

      await expect(exerciseService.createOne(userId, dtoWithOwner)).rejects.toThrow(HttpError);
      await expect(exerciseService.createOne(userId, dtoWithOwner)).rejects.toThrow(
        "EXERCISE_FORBIDDEN",
      );
    });

    it("should throw error when non-admin tries to set owner_id to null", async () => {
      const dtoWithNullOwner: CreateExerciseDTO = {
        ...validDto,
        owner_id: null,
      };

      await expect(exerciseService.createOne(userId, dtoWithNullOwner)).rejects.toThrow(HttpError);
    });

    it("should sanitize tags", async () => {
      const dtoWithTags: CreateExerciseDTO = {
        ...validDto,
        tags: ["  TAG1  ", "tag2", "TAG1", "  "],
      };

      const mockCreated: Exercise = {
        id: exerciseId,
        name: "Test Exercise",
        type_code: typeCode,
        owner_id: userId,
        is_public: false,
        tags: ["tag1", "tag2"],
        archived_at: null,
      };

      // Configure mocks: type exists, name is unique
      mockDb("exercise_types");
      mockDb("exercises");
      if (queryBuilders["exercise_types"]) {
        queryBuilders["exercise_types"].first.mockResolvedValue({ code: typeCode });
      }
      if (queryBuilders["exercises"]) {
        queryBuilders["exercises"].first.mockResolvedValue(null);
      }

      mockExerciseRepo.createExercise.mockResolvedValue(undefined);
      mockExerciseRepo.getExercise.mockResolvedValue(mockCreated);

      const result = await exerciseService.createOne(userId, dtoWithTags);

      expect(result.tags).toEqual(["tag1", "tag2"]);
    });

    it("should allow admin to create exercise for other user", async () => {
      const dtoWithOwner: CreateExerciseDTO = {
        ...validDto,
        owner_id: "other-user",
      };

      const mockCreated: Exercise = {
        id: exerciseId,
        name: "Test Exercise",
        type_code: typeCode,
        owner_id: "other-user",
        is_public: false,
        tags: [],
        archived_at: null,
      };

      // Configure mocks: type exists, name is unique
      mockDb("exercise_types");
      mockDb("exercises");
      if (queryBuilders["exercise_types"]) {
        queryBuilders["exercise_types"].first.mockResolvedValue({ code: typeCode });
      }
      if (queryBuilders["exercises"]) {
        queryBuilders["exercises"].first.mockResolvedValue(null);
      }

      mockExerciseRepo.createExercise.mockResolvedValue(undefined);
      mockExerciseRepo.getExerciseRaw.mockResolvedValue(mockCreated);

      const result = await exerciseService.createOne(userId, dtoWithOwner, true);

      expect(result.owner_id).toBe("other-user");
    });
  });

  describe("updateOne", () => {
    const existingExercise: Exercise = {
      id: exerciseId,
      name: "Existing Exercise",
      type_code: typeCode,
      owner_id: userId,
      is_public: false,
      tags: [],
      archived_at: null,
    };

    it("should update exercise successfully", async () => {
      const updateDto: UpdateExerciseDTO = {
        name: "Updated Exercise",
      };

      const mockUpdated: Exercise = {
        ...existingExercise,
        name: "Updated Exercise",
      };

      mockExerciseRepo.getExerciseRaw.mockResolvedValue(existingExercise);
      mockExerciseRepo.updateExercise.mockResolvedValue(1);
      mockExerciseRepo.getExercise.mockResolvedValue(mockUpdated);

      // Configure mock: name is unique
      mockDb("exercises");
      if (queryBuilders["exercises"]) {
        queryBuilders["exercises"].first.mockResolvedValue(null);
      }

      const result = await exerciseService.updateOne(exerciseId, userId, updateDto);

      expect(result.name).toBe("Updated Exercise");
      expect(mockExerciseRepo.updateExercise).toHaveBeenCalled();
    });

    it("should throw 404 when exercise not found", async () => {
      mockExerciseRepo.getExerciseRaw.mockResolvedValue(null);

      await expect(
        exerciseService.updateOne(exerciseId, userId, { name: "New Name" }),
      ).rejects.toThrow(HttpError);
    });

    it("should throw 403 when user does not own exercise", async () => {
      const otherUserExercise: Exercise = {
        ...existingExercise,
        owner_id: "other-user",
      };

      mockExerciseRepo.getExerciseRaw.mockResolvedValue(otherUserExercise);

      await expect(
        exerciseService.updateOne(exerciseId, userId, { name: "New Name" }),
      ).rejects.toThrow(HttpError);
      await expect(
        exerciseService.updateOne(exerciseId, userId, { name: "New Name" }),
      ).rejects.toThrow("EXERCISE_FORBIDDEN");
    });

    it("should validate type exists when updating type_code", async () => {
      const updateDto: UpdateExerciseDTO = {
        type_code: "invalid-type",
      };

      mockExerciseRepo.getExerciseRaw.mockResolvedValue(existingExercise);

      // Configure mock: type does not exist
      mockDb("exercise_types");
      if (queryBuilders["exercise_types"]) {
        queryBuilders["exercise_types"].first.mockResolvedValue(null);
      }

      await expect(exerciseService.updateOne(exerciseId, userId, updateDto)).rejects.toThrow(
        HttpError,
      );
    });

    it("should validate name uniqueness when updating name", async () => {
      const updateDto: UpdateExerciseDTO = {
        name: "Duplicate Name",
      };

      mockExerciseRepo.getExerciseRaw.mockResolvedValue(existingExercise);

      // Configure mock: name is duplicate
      mockDb("exercises");
      if (queryBuilders["exercises"]) {
        queryBuilders["exercises"].first.mockResolvedValue({ id: "other-exercise" });
      }

      await expect(exerciseService.updateOne(exerciseId, userId, updateDto)).rejects.toThrow(
        HttpError,
      );
      await expect(exerciseService.updateOne(exerciseId, userId, updateDto)).rejects.toThrow(
        "EXERCISE_DUPLICATE",
      );
    });
  });

  describe("archiveOne", () => {
    const existingExercise: Exercise = {
      id: exerciseId,
      name: "Existing Exercise",
      type_code: typeCode,
      owner_id: userId,
      is_public: false,
      tags: [],
      archived_at: null,
    };

    it("should archive exercise successfully", async () => {
      mockExerciseRepo.getExerciseRaw.mockResolvedValue(existingExercise);
      mockExerciseRepo.archiveExercise.mockResolvedValue(1);

      await exerciseService.archiveOne(exerciseId, userId);

      expect(mockExerciseRepo.archiveExercise).toHaveBeenCalledWith(exerciseId);
    });

    it("should throw 404 when exercise not found", async () => {
      mockExerciseRepo.getExerciseRaw.mockResolvedValue(null);

      await expect(exerciseService.archiveOne(exerciseId, userId)).rejects.toThrow(HttpError);
    });

    it("should throw 403 when user does not own exercise", async () => {
      const otherUserExercise: Exercise = {
        ...existingExercise,
        owner_id: "other-user",
      };

      mockExerciseRepo.getExerciseRaw.mockResolvedValue(otherUserExercise);

      await expect(exerciseService.archiveOne(exerciseId, userId)).rejects.toThrow(HttpError);
    });

    it("should allow admin to archive any exercise", async () => {
      const otherUserExercise: Exercise = {
        ...existingExercise,
        owner_id: "other-user",
      };

      mockExerciseRepo.getExerciseRaw.mockResolvedValue(otherUserExercise);
      mockExerciseRepo.archiveExercise.mockResolvedValue(1);

      await exerciseService.archiveOne(exerciseId, userId, true);

      expect(mockExerciseRepo.archiveExercise).toHaveBeenCalled();
    });
  });
});
