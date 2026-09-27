import bcrypt from "bcryptjs";
import { db } from "../../../../apps/backend/src/db/connection.js";
import * as usersService from "../../../../apps/backend/src/modules/users/users.service.js";
import * as usersRepository from "../../../../apps/backend/src/modules/users/users.repository.js";
import * as authRepository from "../../../../apps/backend/src/modules/auth/auth.repository.js";
import * as dsrService from "../../../../apps/backend/src/modules/users/dsr.service.js";
import * as auditUtil from "../../../../apps/backend/src/modules/common/audit.util.js";
import { HttpError } from "../../../../apps/backend/src/utils/http.js";
import type {
  CreateUserDTO,
  UpdateProfileDTO,
  ChangePasswordDTO,
  UserStatus,
} from "../../../../apps/backend/src/modules/users/users.types.js";
import type {
  UserRow,
  ContactRow,
  AvatarRow,
} from "../../../../apps/backend/src/modules/users/users.repository.js";
import type { DeleteSchedule } from "../../../../apps/backend/src/modules/users/dsr.service.js";

// Mock dependencies
jest.mock("../../../../apps/backend/src/modules/common/email-blacklist.repository.js", () => ({
  isEmailBlacklisted: jest.fn().mockResolvedValue(false),
}));
jest.mock("../../../../apps/backend/src/modules/users/users.repository.js");
jest.mock("../../../../apps/backend/src/modules/auth/auth.repository.js");
jest.mock("../../../../apps/backend/src/modules/users/dsr.service.js");
jest.mock("../../../../apps/backend/src/modules/common/audit.util.js");
jest.mock("bcryptjs");

const mockUsersRepo = jest.mocked(usersRepository);
const mockAuthRepo = jest.mocked(authRepository);
const mockDsrService = jest.mocked(dsrService);
const mockAuditUtil = jest.mocked(auditUtil);
const mockBcrypt = jest.mocked(bcrypt);

// Mock db - needs to be both a function and have methods like transaction
jest.mock("../../../../apps/backend/src/db/connection.js", () => {
  const createQueryBuilder = (defaultValue: unknown[] = []) => {
    const builder = Object.assign(Promise.resolve(defaultValue), {
      whereRaw: jest.fn().mockReturnThis(),
      whereNot: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      join: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      update: jest.fn().mockResolvedValue(1),
      insert: jest.fn().mockResolvedValue([]),
    });
    return builder;
  };

  const mockQueryBuilder = createQueryBuilder();

  const mockDbFunction = jest.fn(() => mockQueryBuilder) as jest.Mock & {
    transaction: jest.Mock;
    raw: jest.Mock;
  };
  mockDbFunction.transaction = jest.fn((cb: (trx: unknown) => Promise<void>) => cb({}));
  mockDbFunction.raw = jest.fn((sql: string) => sql);

  return { db: mockDbFunction, mockQueryBuilder };
});

const mockDb = jest.mocked(db);

describe("Users Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsersRepo.checkAliasAvailable.mockResolvedValue(true);
  });

  describe("createUser", () => {
    const validUserDto: CreateUserDTO = {
      username: "testuser",
      displayName: "Test User",
      email: "test@example.com",
      password: "SecureP@ssw0rd123",
      role: "athlete",
    };

    it("should create a new user with valid data", async () => {
      const hashedPassword = "hashed_password";
      mockBcrypt.hash.mockResolvedValue(hashedPassword as never);

      mockUsersRepo.createUserRecord.mockResolvedValue(undefined as never);
      mockUsersRepo.upsertContact.mockResolvedValue(undefined as never);
      mockUsersRepo.insertStateHistory.mockResolvedValue(undefined as never);
      mockUsersRepo.fetchUserWithContacts.mockResolvedValue({
        user: {
          id: expect.any(String),
          username: "testuser",
          display_name: "Test User",
          locale: "en",
          preferred_lang: "en",
          role_code: "athlete",
          status: "pending_verification",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as UserRow,
        contacts: [
          {
            id: "contact-1",
            type: "email",
            value: "test@example.com",
            is_primary: true,
            is_recovery: true,
            is_verified: false,
            verified_at: null,
            created_at: new Date().toISOString(),
          } as ContactRow,
        ],
        avatar: null,
      });

      const result = await usersService.createUser(null, validUserDto);

      expect(result.username).toBe("testuser");
      expect(result.primaryEmail).toBe("test@example.com");
      expect(mockBcrypt.hash).toHaveBeenCalledWith("SecureP@ssw0rd123", 12);
      expect(mockUsersRepo.createUserRecord).toHaveBeenCalled();
    });

    it("should validate username format", async () => {
      const invalidUserDto = {
        ...validUserDto,
        username: "ab", // too short
      };

      await expect(usersService.createUser(null, invalidUserDto)).rejects.toThrow(HttpError);
      await expect(usersService.createUser(null, invalidUserDto)).rejects.toThrow(
        "USER_USERNAME_INVALID",
      );
    });

    it("should reject invalid username characters", async () => {
      const invalidUserDto = {
        ...validUserDto,
        username: "user@name!", // invalid characters
      };

      await expect(usersService.createUser(null, invalidUserDto)).rejects.toThrow(HttpError);
    });

    it("should handle username conflicts", async () => {
      mockBcrypt.hash.mockResolvedValue("hashed" as never);

      (mockDb as unknown as jest.Mock).mockImplementation(() => ({
        transaction: jest.fn((cb: (trx: unknown) => Promise<void>) => cb({})),
      }));

      mockDb.mockReturnValue({
        whereRaw: jest.fn().mockReturnThis(),
        whereNot: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
      } as never);

      mockUsersRepo.createUserRecord.mockRejectedValue({ code: "23505" });

      await expect(usersService.createUser(null, validUserDto)).rejects.toThrow(HttpError);
      await expect(usersService.createUser(null, validUserDto)).rejects.toThrow(
        "USER_USERNAME_TAKEN",
      );
    });

    it("should use custom status when provided", async () => {
      const hashedPassword = "hashed_password";
      mockBcrypt.hash.mockResolvedValue(hashedPassword as never);

      (mockDb as unknown as jest.Mock).mockImplementation(() => ({
        transaction: jest.fn((cb: (trx: unknown) => Promise<void>) => cb({})),
      }));

      mockDb.mockReturnValue({
        whereRaw: jest.fn().mockReturnThis(),
        whereNot: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
      } as never);

      mockUsersRepo.createUserRecord.mockResolvedValue(undefined as never);
      mockUsersRepo.upsertContact.mockResolvedValue(undefined as never);
      mockUsersRepo.insertStateHistory.mockResolvedValue(undefined as never);
      mockUsersRepo.fetchUserWithContacts.mockResolvedValue({
        user: {
          id: "user-123",
          username: "testuser",
          display_name: "Test User",
          status: "pending_verification",
        } as UserRow,
        contacts: [],
        avatar: null,
      });

      const dtoWithStatus = {
        ...validUserDto,
        status: "pending_verification" as UserStatus,
      };

      await usersService.createUser(null, dtoWithStatus);

      expect(mockUsersRepo.createUserRecord).toHaveBeenCalled();
    });

    it("should reject invalid initial status", async () => {
      const invalidDto = {
        ...validUserDto,
        status: "pending_deletion" as UserStatus,
      };

      await expect(usersService.createUser(null, invalidDto)).rejects.toThrow(HttpError);
    });
  });

  describe("getMe", () => {
    const userId = "user-123";

    it("should return user detail with contacts and avatar", async () => {
      const mockUserData = {
        user: {
          id: userId,
          username: "testuser",
          display_name: "Test User",
          locale: "en",
          preferred_lang: "en",
          role_code: "athlete",
          status: "active",
          created_at: "2024-01-01T00:00:00Z",
        } as UserRow,
        contacts: [
          {
            id: "contact-1",
            type: "email",
            value: "test@example.com",
            is_primary: true,
            is_recovery: false,
            is_verified: true,
            verified_at: "2024-01-01T00:00:00Z",
            created_at: "2024-01-01T00:00:00Z",
          } as ContactRow,
        ],
        avatar: {
          file_url: "https://example.com/avatar.jpg",
          mime_type: "image/jpeg",
          bytes: 1024,
          created_at: "2024-01-01T00:00:00Z",
        } as AvatarRow,
      };

      mockUsersRepo.fetchUserWithContacts.mockResolvedValue(mockUserData);

      const result = await usersService.getMe(userId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(userId);
      expect(result?.username).toBe("testuser");
      expect(result?.primaryEmail).toBe("test@example.com");
      expect(result?.avatar).toEqual({
        url: "https://example.com/avatar.jpg",
        mimeType: "image/jpeg",
        bytes: 1024,
        updatedAt: "2024-01-01T00:00:00Z",
      });
      expect(result?.contacts).toHaveLength(1);
    });

    it("should return null when user not found", async () => {
      mockUsersRepo.fetchUserWithContacts.mockResolvedValue(null);

      const result = await usersService.getMe(userId);

      expect(result).toBeNull();
    });

    it("should handle user without avatar", async () => {
      mockUsersRepo.fetchUserWithContacts.mockResolvedValue({
        user: {
          id: userId,
          username: "testuser",
          display_name: "Test User",
        } as UserRow,
        contacts: [],
        avatar: null,
      });

      const result = await usersService.getMe(userId);

      expect(result?.avatar).toBeNull();
    });
  });

  describe("listAll", () => {
    it("should return list of users", async () => {
      const mockUsers = [
        {
          id: "user-1",
          username: "user1",
          display_name: "User One",
          locale: "en",
          preferred_lang: "en",
          role_code: "athlete",
          status: "active",
          created_at: "2024-01-01T00:00:00Z",
        } as UserRow,
      ];

      mockUsersRepo.listUsers.mockResolvedValue(mockUsers);

      const result = await usersService.listAll(10, 0);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("user-1");
      expect(mockUsersRepo.listUsers).toHaveBeenCalledWith(10, 0);
    });

    it("should use default limit and offset", async () => {
      mockUsersRepo.listUsers.mockResolvedValue([]);

      await usersService.listAll();

      expect(mockUsersRepo.listUsers).toHaveBeenCalledWith(50, 0);
    });
  });

  describe("updateProfile", () => {
    const userId = "user-123";

    it("should update username with valid format", async () => {
      const dto: UpdateProfileDTO = {
        username: "newusername",
      };

      mockUsersRepo.findUserById.mockResolvedValue({
        id: userId,
        username: "oldusername",
        display_name: "Test User",
      } as UserRow);

      mockUsersRepo.getProfileByUserId.mockResolvedValue(null);
      mockUsersRepo.updateProfileAlias.mockResolvedValue(1);
      mockUsersRepo.updateUserProfile.mockResolvedValue(1);
      mockUsersRepo.fetchUserWithContacts.mockResolvedValue({
        user: {
          id: userId,
          username: "newusername",
          display_name: "Test User",
        } as UserRow,
        contacts: [],
        avatar: null,
      });

      const result = await usersService.updateProfile(userId, dto);

      expect(result.username).toBe("newusername");
      expect(mockUsersRepo.checkAliasAvailable).toHaveBeenCalledWith("newusername", userId);
      expect(mockUsersRepo.updateProfileAlias).toHaveBeenCalledWith(userId, "newusername", {});
    });

    it("should reject invalid username format", async () => {
      const dto: UpdateProfileDTO = {
        username: "ab", // too short
      };

      mockUsersRepo.findUserById.mockResolvedValue({
        id: userId,
        username: "testuser",
        display_name: "Test User",
      } as UserRow);

      await expect(usersService.updateProfile(userId, dto)).rejects.toThrow(
        "USER_USERNAME_INVALID",
      );
    });

    it("should reject taken username", async () => {
      const dto: UpdateProfileDTO = {
        username: "takenusername",
      };

      mockUsersRepo.findUserById.mockResolvedValue({
        id: userId,
        username: "testuser",
        display_name: "Test User",
      } as UserRow);
      mockUsersRepo.checkAliasAvailable.mockResolvedValue(false);

      await expect(usersService.updateProfile(userId, dto)).rejects.toThrow("USER_USERNAME_TAKEN");
    });

    it("should update display name", async () => {
      const dto: UpdateProfileDTO = {
        displayName: "New Display Name",
      };

      mockUsersRepo.findUserById.mockResolvedValue({
        id: userId,
        username: "testuser",
        display_name: "Old Name",
      } as UserRow);

      mockUsersRepo.updateUserProfile.mockResolvedValue(1);
      mockUsersRepo.fetchUserWithContacts.mockResolvedValue({
        user: {
          id: userId,
          username: "testuser",
          display_name: "New Display Name",
        } as UserRow,
        contacts: [],
        avatar: null,
      });

      const result = await usersService.updateProfile(userId, dto);

      expect(result.displayName).toBe("New Display Name");
    });

    it("should update alias with valid format", async () => {
      const dto: UpdateProfileDTO = {
        alias: "newalias",
      };

      mockUsersRepo.findUserById.mockResolvedValue({
        id: userId,
        username: "testuser",
        display_name: "Test User",
      } as UserRow);

      // First call: before transaction (line 413)
      mockUsersRepo.getProfileByUserId.mockResolvedValueOnce({
        user_id: userId,
        alias: "oldalias",
      } as never);
      // Second call: inside transaction (line 477)
      mockUsersRepo.getProfileByUserId.mockResolvedValueOnce({
        user_id: userId,
        alias: "oldalias",
      } as never);
      // Third call: after transaction (for final fetch)
      mockUsersRepo.getProfileByUserId.mockResolvedValue({
        user_id: userId,
        alias: "newalias",
      } as never);

      mockUsersRepo.canChangeAlias.mockResolvedValue({ allowed: true });
      mockUsersRepo.checkAliasAvailable.mockResolvedValue(true);
      mockUsersRepo.updateProfileAlias.mockResolvedValue(1);
      mockUsersRepo.fetchUserWithContacts.mockResolvedValue({
        user: {
          id: userId,
          username: "testuser",
          display_name: "Test User",
        } as UserRow,
        contacts: [],
        avatar: null,
      });
      mockUsersRepo.getLatestUserMetrics.mockResolvedValue(null);

      const result = await usersService.updateProfile(userId, dto);

      expect(mockUsersRepo.canChangeAlias).toHaveBeenCalledWith(userId);
      expect(mockUsersRepo.checkAliasAvailable).toHaveBeenCalledWith("newalias", userId);
      expect(mockUsersRepo.updateProfileAlias).toHaveBeenCalledWith(userId, "newalias", {});
      expect(mockAuditUtil.insertAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: userId,
          entityType: "users",
          action: "profile_update",
          entityId: userId,
        }),
      );
      expect(result.profile?.alias).toBe("newalias");
    });

    it("should reject taken alias", async () => {
      const dto: UpdateProfileDTO = {
        alias: "takenalias",
      };

      mockUsersRepo.findUserById.mockResolvedValue({
        id: userId,
        username: "testuser",
        display_name: "Test User",
      } as UserRow);

      mockUsersRepo.getProfileByUserId.mockResolvedValue({
        user_id: userId,
        alias: "oldalias",
      } as never);

      mockUsersRepo.canChangeAlias.mockResolvedValue({ allowed: true });
      mockUsersRepo.checkAliasAvailable.mockResolvedValue(false);

      try {
        await usersService.updateProfile(userId, dto);
        fail("Expected HttpError to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect((error as HttpError).code).toBe("E.PROFILE_UPDATE_FAILED");
      }
    });

    it("should update weight with kg unit", async () => {
      const dto: UpdateProfileDTO = {
        weight: 75.5,
        weightUnit: "kg",
      };

      mockUsersRepo.findUserById.mockResolvedValue({
        id: userId,
        username: "testuser",
        display_name: "Test User",
      } as UserRow);

      // First call: before transaction (for weight check)
      mockUsersRepo.getLatestUserMetrics.mockResolvedValueOnce({
        weight: 70,
        unit: "kg",
        fitness_level_code: null,
        training_frequency: null,
      });
      // Second call: after transaction (for final fetch)
      mockUsersRepo.getLatestUserMetrics.mockResolvedValue({
        weight: 75.5,
        unit: "kg",
        fitness_level_code: null,
        training_frequency: null,
      });

      mockUsersRepo.insertUserMetric.mockResolvedValue("metric-123");
      mockUsersRepo.fetchUserWithContacts.mockResolvedValue({
        user: {
          id: userId,
          username: "testuser",
          display_name: "Test User",
        } as UserRow,
        contacts: [],
        avatar: null,
      });
      mockUsersRepo.getProfileByUserId.mockResolvedValue(null);

      const result = await usersService.updateProfile(userId, dto);

      expect(mockUsersRepo.insertUserMetric).toHaveBeenCalledWith(
        userId,
        { weight: 75.5, unit: "kg" },
        {},
      );
      expect(result.profile?.weight).toBe(75.5);
      expect(result.profile?.weightUnit).toBe("kg");
    });

    it("should convert weight from lb to kg", async () => {
      const dto: UpdateProfileDTO = {
        weight: 165.5, // lbs
        weightUnit: "lb",
      };

      mockUsersRepo.findUserById.mockResolvedValue({
        id: userId,
        username: "testuser",
        display_name: "Test User",
      } as UserRow);

      // getLatestUserMetrics is called once for weight check (line 472)
      // and once in toUserDetail (line 131) after transaction
      mockUsersRepo.getLatestUserMetrics
        .mockResolvedValueOnce({
          weight: 70,
          unit: "kg",
          fitness_level_code: null,
          training_frequency: null,
        })
        .mockResolvedValue({
          weight: 75.07, // 165.5 * 0.453592
          unit: "kg",
          fitness_level_code: null,
          training_frequency: null,
        });
      mockUsersRepo.insertUserMetric.mockResolvedValue("metric-123");
      mockUsersRepo.fetchUserWithContacts.mockResolvedValue({
        user: {
          id: userId,
          username: "testuser",
          display_name: "Test User",
        } as UserRow,
        contacts: [],
        avatar: null,
      });
      mockUsersRepo.getProfileByUserId.mockResolvedValue(null);

      await usersService.updateProfile(userId, dto);

      expect(mockUsersRepo.insertUserMetric).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          weight: expect.closeTo(75.07, 2),
          unit: "kg",
        }),
        {},
      );
    });

    it("should update fitness level", async () => {
      const dto: UpdateProfileDTO = {
        fitnessLevel: "intermediate",
      };

      mockUsersRepo.findUserById.mockResolvedValue({
        id: userId,
        username: "testuser",
        display_name: "Test User",
      } as UserRow);

      // First call: before transaction (for fitness level check)
      mockUsersRepo.getLatestUserMetrics.mockResolvedValueOnce({
        weight: null,
        unit: "kg",
        fitness_level_code: "beginner",
        training_frequency: null,
      });
      // Second call: after transaction (for final fetch)
      mockUsersRepo.getLatestUserMetrics.mockResolvedValue({
        weight: null,
        unit: "kg",
        fitness_level_code: "intermediate",
        training_frequency: null,
      });

      mockUsersRepo.insertUserMetric.mockResolvedValue("metric-123");
      mockUsersRepo.fetchUserWithContacts.mockResolvedValue({
        user: {
          id: userId,
          username: "testuser",
          display_name: "Test User",
        } as UserRow,
        contacts: [],
        avatar: null,
      });
      mockUsersRepo.getProfileByUserId.mockResolvedValue(null);

      const result = await usersService.updateProfile(userId, dto);

      expect(mockUsersRepo.insertUserMetric).toHaveBeenCalledWith(
        userId,
        { fitness_level_code: "intermediate" },
        {},
      );
      expect(result.profile?.fitnessLevel).toBe("intermediate");
    });

    it("should update training frequency", async () => {
      const dto: UpdateProfileDTO = {
        trainingFrequency: "3_4_per_week",
      };

      mockUsersRepo.findUserById.mockResolvedValue({
        id: userId,
        username: "testuser",
        display_name: "Test User",
      } as UserRow);

      // First call: before transaction (for training frequency check)
      mockUsersRepo.getLatestUserMetrics.mockResolvedValueOnce({
        weight: null,
        unit: "kg",
        fitness_level_code: null,
        training_frequency: "1_2_per_week",
      });
      // Second call: after transaction (for final fetch)
      mockUsersRepo.getLatestUserMetrics.mockResolvedValue({
        weight: null,
        unit: "kg",
        fitness_level_code: null,
        training_frequency: "3_4_per_week",
      });

      mockUsersRepo.insertUserMetric.mockResolvedValue("metric-123");
      mockUsersRepo.fetchUserWithContacts.mockResolvedValue({
        user: {
          id: userId,
          username: "testuser",
          display_name: "Test User",
        } as UserRow,
        contacts: [],
        avatar: null,
      });
      mockUsersRepo.getProfileByUserId.mockResolvedValue(null);

      const result = await usersService.updateProfile(userId, dto);

      expect(mockUsersRepo.insertUserMetric).toHaveBeenCalledWith(
        userId,
        { training_frequency: "3_4_per_week" },
        {},
      );
      expect(result.profile?.trainingFrequency).toBe("3_4_per_week");
    });

    it("should update all new profile fields together", async () => {
      const dto: UpdateProfileDTO = {
        alias: "newalias",
        weight: 80,
        weightUnit: "kg",
        fitnessLevel: "advanced",
        trainingFrequency: "5_plus_per_week",
      };

      mockUsersRepo.findUserById.mockResolvedValue({
        id: userId,
        username: "testuser",
        display_name: "Test User",
      } as UserRow);

      // First call: before transaction (line 413)
      mockUsersRepo.getProfileByUserId.mockResolvedValueOnce({
        user_id: userId,
        alias: "oldalias",
      } as never);
      // Second call: inside transaction (line 477)
      mockUsersRepo.getProfileByUserId.mockResolvedValueOnce({
        user_id: userId,
        alias: "oldalias",
      } as never);
      // Third call: after transaction (for final fetch)
      mockUsersRepo.getProfileByUserId.mockResolvedValue({
        user_id: userId,
        alias: "newalias",
      } as never);

      mockUsersRepo.canChangeAlias.mockResolvedValue({ allowed: true });
      mockUsersRepo.checkAliasAvailable.mockResolvedValue(true);
      mockUsersRepo.updateProfileAlias.mockResolvedValue(1);

      // getLatestUserMetrics is called multiple times (for weight, fitnessLevel, trainingFrequency)
      mockUsersRepo.getLatestUserMetrics
        .mockResolvedValueOnce({
          weight: 75,
          unit: "kg",
          fitness_level_code: "intermediate",
          training_frequency: "3_4_per_week",
        })
        .mockResolvedValueOnce({
          weight: 75,
          unit: "kg",
          fitness_level_code: "intermediate",
          training_frequency: "3_4_per_week",
        })
        .mockResolvedValueOnce({
          weight: 75,
          unit: "kg",
          fitness_level_code: "intermediate",
          training_frequency: "3_4_per_week",
        })
        .mockResolvedValue({
          weight: 80,
          unit: "kg",
          fitness_level_code: "advanced",
          training_frequency: "5_plus_per_week",
        });

      mockUsersRepo.insertUserMetric.mockResolvedValue("metric-123");
      mockUsersRepo.fetchUserWithContacts.mockResolvedValue({
        user: {
          id: userId,
          username: "testuser",
          display_name: "Test User",
        } as UserRow,
        contacts: [],
        avatar: null,
      });

      const result = await usersService.updateProfile(userId, dto);

      expect(mockUsersRepo.updateProfileAlias).toHaveBeenCalledWith(userId, "newalias", {});
      expect(mockUsersRepo.insertUserMetric).toHaveBeenCalledWith(
        userId,
        {
          weight: 80,
          unit: "kg",
          fitness_level_code: "advanced",
          training_frequency: "5_plus_per_week",
        },
        {},
      );
      expect(result.profile?.alias).toBe("newalias");
      expect(result.profile?.weight).toBe(80);
      expect(result.profile?.fitnessLevel).toBe("advanced");
      expect(result.profile?.trainingFrequency).toBe("5_plus_per_week");
    });

    it("should not update alias if value unchanged", async () => {
      const dto: UpdateProfileDTO = {
        alias: "existingalias",
      };

      mockUsersRepo.findUserById.mockResolvedValue({
        id: userId,
        username: "testuser",
        display_name: "Test User",
      } as UserRow);

      // First call: before transaction (line 414)
      mockUsersRepo.getProfileByUserId.mockResolvedValueOnce({
        user_id: userId,
        alias: "existingalias",
      } as never);
      // Second call: after transaction (for final fetch)
      mockUsersRepo.getProfileByUserId.mockResolvedValue({
        user_id: userId,
        alias: "existingalias",
      } as never);
      mockUsersRepo.fetchUserWithContacts.mockResolvedValue({
        user: {
          id: userId,
          username: "testuser",
          display_name: "Test User",
        } as UserRow,
        contacts: [],
        avatar: null,
      });
      mockUsersRepo.getLatestUserMetrics.mockResolvedValue(null);

      await usersService.updateProfile(userId, dto);

      expect(mockUsersRepo.canChangeAlias).not.toHaveBeenCalled();
      expect(mockUsersRepo.checkAliasAvailable).not.toHaveBeenCalled();
      expect(mockUsersRepo.updateProfileAlias).not.toHaveBeenCalled();
    });

    it("should not insert metric if values unchanged", async () => {
      const dto: UpdateProfileDTO = {
        weight: 75.5,
        weightUnit: "kg",
      };

      mockUsersRepo.findUserById.mockResolvedValue({
        id: userId,
        username: "testuser",
        display_name: "Test User",
      } as UserRow);

      // getLatestUserMetrics is called once for weight check (line 472)
      // and once in toUserDetail (line 131) after transaction
      mockUsersRepo.getLatestUserMetrics
        .mockResolvedValueOnce({
          weight: 75.5,
          unit: "kg",
          fitness_level_code: null,
          training_frequency: null,
        })
        .mockResolvedValue({
          weight: 75.5,
          unit: "kg",
          fitness_level_code: null,
          training_frequency: null,
        });

      mockUsersRepo.fetchUserWithContacts.mockResolvedValue({
        user: {
          id: userId,
          username: "testuser",
          display_name: "Test User",
        } as UserRow,
        contacts: [],
        avatar: null,
      });
      mockUsersRepo.getProfileByUserId.mockResolvedValue(null);

      await usersService.updateProfile(userId, dto);

      expect(mockUsersRepo.insertUserMetric).not.toHaveBeenCalled();
    });
  });

  describe("updatePassword", () => {
    const userId = "user-123";

    it("should update password with valid current password", async () => {
      const dto: ChangePasswordDTO = {
        currentPassword: "OldP@ssw0rd123",
        newPassword: "NewP@ssw0rd456",
      };

      mockUsersRepo.findUserById.mockResolvedValue({
        id: userId,
        password_hash: "old_hash",
        username: "testuser",
        primary_email: "test@example.com",
      } as never);

      mockUsersRepo.getUserContacts.mockResolvedValue([
        { type: "email", value: "test@example.com", is_primary: true } as ContactRow,
      ]);

      (mockDb as unknown as jest.Mock).mockImplementation(() => ({
        transaction: jest.fn((cb: (trx: unknown) => Promise<void>) => cb({})),
      }));

      mockBcrypt.compare.mockResolvedValue(true as never);
      mockBcrypt.hash.mockResolvedValue("new_hash" as never);
      mockAuthRepo.changePasswordAndRevokeAuthAtomic.mockResolvedValue(undefined);

      await usersService.updatePassword(userId, dto);

      expect(mockBcrypt.compare).toHaveBeenCalledWith("OldP@ssw0rd123", "old_hash");
      expect(mockBcrypt.hash).toHaveBeenCalledWith("NewP@ssw0rd456", 12);
      expect(mockAuthRepo.changePasswordAndRevokeAuthAtomic).toHaveBeenCalled();
      expect(mockAuditUtil.insertAudit).toHaveBeenCalled();
    });

    it("should reject incorrect current password", async () => {
      const dto: ChangePasswordDTO = {
        currentPassword: "WrongPassword",
        newPassword: "NewP@ssw0rd456",
      };

      mockUsersRepo.findUserById.mockResolvedValue({
        id: userId,
        password_hash: "old_hash",
        username: "testuser",
        primary_email: "test@example.com",
      } as never);

      mockBcrypt.compare.mockResolvedValue(false as never);

      await expect(usersService.updatePassword(userId, dto)).rejects.toThrow(
        "USER_INVALID_PASSWORD",
      );
    });

    it("should throw error if user not found", async () => {
      const dto: ChangePasswordDTO = {
        currentPassword: "OldP@ssw0rd123",
        newPassword: "NewP@ssw0rd456",
      };

      mockUsersRepo.findUserById.mockResolvedValue(undefined);

      await expect(usersService.updatePassword(userId, dto)).rejects.toThrow();
    });

    it("should revoke all refresh tokens after password change", async () => {
      const dto: ChangePasswordDTO = {
        currentPassword: "OldP@ssw0rd123",
        newPassword: "NewP@ssw0rd456",
      };

      mockUsersRepo.findUserById.mockResolvedValue({
        id: userId,
        password_hash: "old_hash",
        username: "testuser",
        primary_email: "test@example.com",
      } as never);

      mockUsersRepo.getUserContacts.mockResolvedValue([
        { type: "email", value: "test@example.com", is_primary: true } as ContactRow,
      ]);

      (mockDb as unknown as jest.Mock).mockImplementation(() => ({
        transaction: jest.fn((cb: (trx: unknown) => Promise<void>) => cb({})),
      }));

      mockBcrypt.compare.mockResolvedValue(true as never);
      mockBcrypt.hash.mockResolvedValue("new_hash" as never);
      mockAuthRepo.changePasswordAndRevokeAuthAtomic.mockResolvedValue(undefined);

      await usersService.updatePassword(userId, dto);

      expect(mockAuthRepo.changePasswordAndRevokeAuthAtomic).toHaveBeenCalledWith(userId, expect.any(String));
    });
  });

  describe("changeStatus", () => {
    const userId = "user-123";

    it("should change status from pending_verification to active", async () => {
      mockUsersRepo.findUserById.mockResolvedValue({
        id: userId,
        status: "pending_verification",
      } as UserRow);

      (mockDb as unknown as jest.Mock).mockImplementation(() => ({
        transaction: jest.fn((cb: (trx: unknown) => Promise<void>) => cb({})),
      }));

      mockUsersRepo.setUserStatus.mockResolvedValue(1);
      mockUsersRepo.insertStateHistory.mockResolvedValue([1]);
      mockUsersRepo.fetchUserWithContacts.mockResolvedValue({
        user: {
          id: userId,
          status: "active",
        } as UserRow,
        contacts: [],
        avatar: null,
      });

      await usersService.changeStatus(null, userId, "active");

      expect(mockUsersRepo.setUserStatus).toHaveBeenCalled();
    });

    it("should change status from active to suspended", async () => {
      mockUsersRepo.findUserById.mockResolvedValue({
        id: userId,
        status: "active",
      } as UserRow);

      (mockDb as unknown as jest.Mock).mockImplementation(() => ({
        transaction: jest.fn((cb: (trx: unknown) => Promise<void>) => cb({})),
      }));

      mockUsersRepo.setUserStatus.mockResolvedValue(1);
      mockUsersRepo.insertStateHistory.mockResolvedValue([1]);
      mockUsersRepo.fetchUserWithContacts.mockResolvedValue({
        user: {
          id: userId,
          status: "suspended",
        } as UserRow,
        contacts: [],
        avatar: null,
      });

      await usersService.changeStatus(null, userId, "suspended");

      expect(mockUsersRepo.setUserStatus).toHaveBeenCalled();
    });

    it("should reject invalid status transition", async () => {
      mockUsersRepo.findUserById.mockResolvedValue({
        id: userId,
        status: "pending_deletion",
      } as UserRow);

      await expect(usersService.changeStatus(null, userId, "active")).rejects.toThrow(
        "Cannot transition status from pending_deletion to active",
      );
    });

    it("should throw error if user not found", async () => {
      mockUsersRepo.findUserById.mockResolvedValue(undefined);

      await expect(usersService.changeStatus(null, userId, "active")).rejects.toThrow();
    });
  });

  describe("requestAccountDeletion", () => {
    const userId = "user-123";

    it("should schedule account deletion", async () => {
      const mockSchedule: DeleteSchedule = {
        scheduledAt: new Date().toISOString(),
        purgeDueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        backupPurgeDueAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      };

      mockUsersRepo.findUserById.mockResolvedValue({
        id: userId,
        status: "active",
      } as UserRow);

      mockDsrService.scheduleAccountDeletion.mockResolvedValue(mockSchedule);

      const result = await usersService.requestAccountDeletion(userId, "password123");

      expect(result).toEqual(mockSchedule);
      expect(mockDsrService.scheduleAccountDeletion).toHaveBeenCalledWith(userId);
    });
  });

  describe("listContacts", () => {
    const userId = "user-123";

    it("should return user contacts", async () => {
      const mockContacts: ContactRow[] = [
        {
          id: "contact-1",
          user_id: userId,
          type: "email",
          value: "test@example.com",
          is_primary: true,
          is_recovery: false,
          is_verified: true,
          verified_at: "2024-01-01T00:00:00Z",
          created_at: "2024-01-01T00:00:00Z",
        },
      ];

      mockUsersRepo.getUserContacts.mockResolvedValue(mockContacts);

      const result = await usersService.listContacts(userId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("contact-1");
      expect(result[0].value).toBe("test@example.com");
      expect(result[0].isPrimary).toBe(true);
    });

    it("should return empty array when no contacts", async () => {
      mockUsersRepo.getUserContacts.mockResolvedValue([]);

      const result = await usersService.listContacts(userId);

      expect(result).toEqual([]);
    });
  });

  describe("removeContact", () => {
    const userId = "user-123";
    const contactId = "contact-123";

    it("should remove contact when it exists and user owns it", async () => {
      mockUsersRepo.getContactById.mockResolvedValue({
        id: contactId,
        user_id: userId,
        type: "email",
        value: "test@example.com",
        is_primary: false,
      } as ContactRow);

      mockUsersRepo.deleteContact.mockResolvedValue(1);

      await usersService.removeContact(userId, contactId);

      expect(mockUsersRepo.deleteContact).toHaveBeenCalledWith(userId, contactId);
    });

    it("should throw error if contact not found", async () => {
      mockUsersRepo.getContactById.mockResolvedValue(undefined);

      await expect(usersService.removeContact(userId, contactId)).rejects.toThrow();
    });

    it("should throw error if user does not own contact", async () => {
      mockUsersRepo.getContactById.mockResolvedValue({
        id: contactId,
        user_id: "other-user",
        type: "email",
        value: "test@example.com",
      } as ContactRow);

      await expect(usersService.removeContact(userId, contactId)).rejects.toThrow();
    });

    it("should throw error if trying to remove primary email", async () => {
      mockUsersRepo.getContactById.mockResolvedValue({
        id: contactId,
        user_id: userId,
        type: "email",
        value: "primary@example.com",
        is_primary: true,
      } as ContactRow);

      await expect(usersService.removeContact(userId, contactId)).rejects.toThrow(
        "USER_CONTACT_REMOVE_PRIMARY",
      );
    });
  });

  describe("requestContactVerification", () => {
    const userId = "user-123";
    const contactId = "contact-123";

    beforeEach(() => {
      jest.clearAllMocks();
      mockAuthRepo.countAuthTokensSince.mockResolvedValue(0);
      mockAuthRepo.purgeAuthTokensOlderThan.mockResolvedValue(0);
      mockAuthRepo.markAuthTokensConsumed.mockResolvedValue(0);
      mockAuthRepo.createAuthToken.mockResolvedValue([]);
    });

    it("should create verification token for unverified contact", async () => {
      mockUsersRepo.getContactById.mockResolvedValue({
        id: contactId,
        user_id: userId,
        type: "email",
        value: "test@example.com",
        is_verified: false,
      } as ContactRow);

      const result = await usersService.requestContactVerification(userId, contactId);

      expect(result).toHaveProperty("token");
      expect(result).toHaveProperty("expiresAt");
      expect(mockAuthRepo.createAuthToken).toHaveBeenCalled();
      expect(mockAuditUtil.insertAudit).toHaveBeenCalled();
    });

    it("should throw error if contact not found", async () => {
      mockUsersRepo.getContactById.mockResolvedValue(undefined);

      await expect(usersService.requestContactVerification(userId, contactId)).rejects.toThrow(
        HttpError,
      );
    });

    it("should throw error if user does not own contact", async () => {
      mockUsersRepo.getContactById.mockResolvedValue({
        id: contactId,
        user_id: "other-user",
        type: "email",
        value: "test@example.com",
        is_verified: false,
      } as ContactRow);

      await expect(usersService.requestContactVerification(userId, contactId)).rejects.toThrow(
        HttpError,
      );
    });

    it("should throw error if contact already verified", async () => {
      mockUsersRepo.getContactById.mockResolvedValue({
        id: contactId,
        user_id: userId,
        type: "email",
        value: "test@example.com",
        is_verified: true,
      } as ContactRow);

      await expect(usersService.requestContactVerification(userId, contactId)).rejects.toThrow(
        "USER_CONTACT_ALREADY_VERIFIED",
      );
    });

    it("should throw error if rate limit exceeded", async () => {
      mockUsersRepo.getContactById.mockResolvedValue({
        id: contactId,
        user_id: userId,
        type: "email",
        value: "test@example.com",
        is_verified: false,
      } as ContactRow);
      mockAuthRepo.countAuthTokensSince.mockResolvedValue(3);

      await expect(usersService.requestContactVerification(userId, contactId)).rejects.toThrow(
        HttpError,
      );
      try {
        await usersService.requestContactVerification(userId, contactId);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect((error as HttpError).code).toBe("USER_CONTACT_VERIFY_LIMIT");
      }
    });
  });

  describe("updatePrimaryEmail", () => {
    const userId = "user-123";
    const email = "newemail@example.com";

    beforeEach(() => {
      jest.clearAllMocks();
      mockUsersRepo.fetchUserWithContacts.mockResolvedValue({
        user: {
          id: userId,
          username: "testuser",
          display_name: "Test User",
          status: "active",
        } as UserRow,
        contacts: [],
        avatar: null,
      });
    });

    it("should update primary email successfully", async () => {
      mockUsersRepo.upsertContact.mockResolvedValue(1);

      const result = await usersService.updatePrimaryEmail(userId, email);

      expect(mockUsersRepo.upsertContact).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          type: "email",
          value: email.trim().toLowerCase(),
          isPrimary: true,
          isRecovery: true,
        }),
      );
      expect(mockAuditUtil.insertAudit).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("should throw error for empty email", async () => {
      await expect(usersService.updatePrimaryEmail(userId, "   ")).rejects.toThrow(
        "USER_EMAIL_INVALID",
      );
    });

    it("should throw error if email already taken", async () => {
      mockUsersRepo.upsertContact.mockRejectedValue({ code: "23505" });

      await expect(usersService.updatePrimaryEmail(userId, email)).rejects.toThrow(
        "USER_EMAIL_TAKEN",
      );
    });
  });

  describe("updatePhoneNumber", () => {
    const userId = "user-123";
    const phone = "+1234567890";

    beforeEach(() => {
      jest.clearAllMocks();
      mockUsersRepo.fetchUserWithContacts.mockResolvedValue({
        user: {
          id: userId,
          username: "testuser",
          display_name: "Test User",
          status: "active",
        } as UserRow,
        contacts: [],
        avatar: null,
      });
    });

    it("should update phone number successfully", async () => {
      mockUsersRepo.upsertContact.mockResolvedValue(1);

      const result = await usersService.updatePhoneNumber(userId, phone);

      expect(mockUsersRepo.upsertContact).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          type: "phone",
          value: phone.trim(),
          isPrimary: false,
          isRecovery: true,
        }),
      );
      expect(mockAuditUtil.insertAudit).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("should update phone with custom isRecovery flag", async () => {
      mockUsersRepo.upsertContact.mockResolvedValue(1);

      await usersService.updatePhoneNumber(userId, phone, false);

      expect(mockUsersRepo.upsertContact).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          isRecovery: false,
        }),
      );
    });

    it("should throw error for empty phone", async () => {
      await expect(usersService.updatePhoneNumber(userId, "   ")).rejects.toThrow(
        "USER_PHONE_INVALID",
      );
    });

    it("should throw error if phone already taken", async () => {
      mockUsersRepo.upsertContact.mockRejectedValue({ code: "23505" });

      await expect(usersService.updatePhoneNumber(userId, phone)).rejects.toThrow(
        "USER_PHONE_TAKEN",
      );
    });
  });

  describe("verifyContact", () => {
    const userId = "user-123";
    const contactId = "contact-123";
    const token = "test-token";

    beforeEach(() => {
      jest.clearAllMocks();
      mockAuthRepo.findAuthToken.mockResolvedValue({
        id: "token-123",
        user_id: userId,
        token_type: "email_verification",
        token_hash: "hash-123",
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        created_at: new Date().toISOString(),
        consumed_at: null,
      });
      mockUsersRepo.markContactVerified.mockResolvedValue(1);
      mockAuthRepo.consumeAuthToken.mockResolvedValue(1);
      mockAuthRepo.markAuthTokensConsumed.mockResolvedValue(1);
    });

    it("should verify contact with valid token", async () => {
      mockUsersRepo.getContactById
        .mockResolvedValueOnce({
          id: contactId,
          user_id: userId,
          type: "email",
          value: "test@example.com",
          is_verified: false,
        } as ContactRow)
        .mockResolvedValueOnce({
          id: contactId,
          user_id: userId,
          type: "email",
          value: "test@example.com",
          is_verified: true,
        } as ContactRow);

      const result = await usersService.verifyContact(userId, contactId, token);

      expect(mockUsersRepo.markContactVerified).toHaveBeenCalledWith(contactId);
      expect(mockAuthRepo.consumeAuthToken).toHaveBeenCalled();
      expect(result.isVerified).toBe(true);
    });

    it("should return contact if already verified", async () => {
      mockUsersRepo.getContactById.mockResolvedValue({
        id: contactId,
        user_id: userId,
        type: "email",
        value: "test@example.com",
        is_verified: true,
      } as ContactRow);

      const result = await usersService.verifyContact(userId, contactId, token);

      expect(mockUsersRepo.markContactVerified).not.toHaveBeenCalled();
      expect(result.isVerified).toBe(true);
    });

    it("should throw error if contact not found", async () => {
      mockUsersRepo.getContactById.mockResolvedValue(undefined);

      await expect(usersService.verifyContact(userId, contactId, token)).rejects.toThrow(HttpError);
    });

    it("should throw error for empty token", async () => {
      mockUsersRepo.getContactById.mockResolvedValue({
        id: contactId,
        user_id: userId,
        type: "email",
        value: "test@example.com",
        is_verified: false,
      } as ContactRow);

      await expect(usersService.verifyContact(userId, contactId, "   ")).rejects.toThrow(
        "USER_CONTACT_TOKEN_REQUIRED",
      );
    });

    it("should throw error for invalid token", async () => {
      mockUsersRepo.getContactById.mockResolvedValue({
        id: contactId,
        user_id: userId,
        type: "email",
        value: "test@example.com",
        is_verified: false,
      } as ContactRow);
      mockAuthRepo.findAuthToken.mockResolvedValue(undefined);

      await expect(usersService.verifyContact(userId, contactId, token)).rejects.toThrow(
        "USER_CONTACT_TOKEN_INVALID",
      );
    });

    it("should throw error for expired token", async () => {
      mockUsersRepo.getContactById.mockResolvedValue({
        id: contactId,
        user_id: userId,
        type: "email",
        value: "test@example.com",
        is_verified: false,
      } as ContactRow);
      mockAuthRepo.findAuthToken.mockResolvedValue({
        id: "token-123",
        user_id: userId,
        token_type: "email_verification",
        token_hash: "hash-123",
        expires_at: new Date(Date.now() - 1000).toISOString(),
        created_at: new Date().toISOString(),
        consumed_at: null,
      });

      await expect(usersService.verifyContact(userId, contactId, token)).rejects.toThrow(
        "USER_CONTACT_TOKEN_EXPIRED",
      );
    });
  });

  describe("collectUserData", () => {
    const userId = "user-123";
    let mockQueryBuilder: {
      where: jest.Mock;
      whereIn: jest.Mock;
      orWhere: jest.Mock;
      leftJoin: jest.Mock;
      join: jest.Mock;
      select: jest.Mock;
      orderBy: jest.Mock;
      first: jest.Mock;
      pluck: jest.Mock;
    };

    beforeEach(() => {
      jest.clearAllMocks();
      // Create a thenable query builder that resolves to an empty array when awaited
      const thenablePromise = Promise.resolve([]);
      mockQueryBuilder = Object.assign(thenablePromise, {
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        join: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue([]),
        pluck: jest.fn().mockResolvedValue([]),
      });
      mockDb.mockReturnValue(mockQueryBuilder as unknown as ReturnType<typeof db>);
      (mockDb as unknown as { raw: jest.Mock }).raw = jest.fn((sql: string) => sql);
      (mockDb as unknown as { transaction: jest.Mock }).transaction = jest.fn(
        (cb: (trx: unknown) => Promise<void>) => cb({}),
      );
    });

    it("should collect all user data successfully", async () => {
      // Mock user query
      mockQueryBuilder.first.mockResolvedValueOnce({
        id: userId,
        username: "testuser",
        display_name: "Test User",
        status: "active",
        password_hash: "hash",
      });

      // Mock all other queries to return empty arrays/null
      mockQueryBuilder.first
        .mockResolvedValueOnce([]) // contacts
        .mockResolvedValueOnce(null) // profile
        .mockResolvedValueOnce([]) // metrics (orderBy)
        .mockResolvedValueOnce([]) // sessions
        .mockResolvedValueOnce([]) // plans
        .mockResolvedValueOnce([]) // exercises
        .mockResolvedValueOnce([]) // session_exercises (whereIn)
        .mockResolvedValueOnce([]) // exercise_sets (whereIn)
        .mockResolvedValueOnce([]) // user_points (orderBy)
        .mockResolvedValueOnce([]) // badges (orderBy)
        .mockResolvedValueOnce([]) // followers (orderBy)
        .mockResolvedValueOnce([]) // following (orderBy)
        .mockResolvedValueOnce([]) // media (orderBy)
        .mockResolvedValueOnce([]); // user_state_history (orderBy)

      const result = await usersService.collectUserData(userId);

      expect(result).toHaveProperty("user");
      expect(result).toHaveProperty("contacts");
      expect(result).toHaveProperty("profile");
      expect(result).toHaveProperty("metrics");
      expect(result).toHaveProperty("sessions");
      expect(result).toHaveProperty("points");
      expect(result).toHaveProperty("badges");
      expect(result).toHaveProperty("meta");
      expect(result.user).not.toHaveProperty("password_hash");
    });

    it("should throw error if user not found", async () => {
      mockQueryBuilder.first.mockResolvedValue(null);

      await expect(usersService.collectUserData(userId)).rejects.toThrow("USER_NOT_FOUND");
    });
  });

  describe("user preferences", () => {
    const userId = "user-123";
    const preferences = {
      language: "de" as const,
      measurementSystem: "metric" as const,
    };

    it("should return user preferences", async () => {
      mockUsersRepo.getUserPreferences.mockResolvedValue(preferences);

      await expect(usersService.getUserPreferences(userId)).resolves.toEqual(preferences);
    });

    it("should throw when user preferences are missing", async () => {
      mockUsersRepo.getUserPreferences.mockResolvedValue(undefined);

      await expect(usersService.getUserPreferences(userId)).rejects.toThrow("USER_NOT_FOUND");
    });

    it("should persist user preferences", async () => {
      const updated = { ...preferences, measurementSystem: "imperial" as const };
      mockUsersRepo.updateUserPreferences.mockResolvedValue(updated);

      await expect(
        usersService.updateUserPreferences(userId, { measurementSystem: "imperial" }),
      ).resolves.toEqual(updated);
      expect(mockUsersRepo.updateUserPreferences).toHaveBeenCalledWith(userId, {
        measurementSystem: "imperial",
      });
    });
  });

  describe("privacy settings", () => {
    const userId = "user-123";
    const settings = {
      defaultVisibility: "private" as const,
      allowFollowers: true,
      showEmail: false,
      showWeight: false,
      showFitnessLevel: false,
    };

    it("should return privacy settings", async () => {
      mockUsersRepo.getPrivacySettings.mockResolvedValue(settings);

      await expect(usersService.getPrivacySettings(userId)).resolves.toEqual(settings);
    });

    it("should throw when privacy settings are missing", async () => {
      mockUsersRepo.getPrivacySettings.mockResolvedValue(undefined);

      await expect(usersService.getPrivacySettings(userId)).rejects.toThrow("USER_NOT_FOUND");
    });

    it("should persist privacy settings", async () => {
      mockUsersRepo.updatePrivacySettings.mockResolvedValue({
        ...settings,
        allowFollowers: false,
      });

      await expect(
        usersService.updatePrivacySettings(userId, { allowFollowers: false }),
      ).resolves.toEqual({ ...settings, allowFollowers: false });
      expect(mockUsersRepo.updatePrivacySettings).toHaveBeenCalledWith(userId, {
        allowFollowers: false,
      });
    });
  });
});
