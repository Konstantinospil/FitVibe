import type { Request, Response } from "express";
import * as usersController from "../../../../apps/backend/src/modules/users/users.controller.js";
import * as usersService from "../../../../apps/backend/src/modules/users/users.service.js";
import * as usersRepository from "../../../../apps/backend/src/modules/users/users.repository.js";
import * as userDataArchive from "../../../../apps/backend/src/modules/users/user-data-archive.service.js";
import * as idempotencyService from "../../../../apps/backend/src/modules/common/idempotency.service.js";

// Mock dependencies
jest.mock("../../../../apps/backend/src/modules/users/users.service.js");
jest.mock("../../../../apps/backend/src/modules/users/users.repository.js");
jest.mock("../../../../apps/backend/src/modules/common/idempotency.service.js");
jest.mock("../../../../apps/backend/src/modules/users/user-data-archive.service.js");

const mockUsersService = jest.mocked(usersService);
const mockUsersRepository = jest.mocked(usersRepository);
const mockIdempotencyService = jest.mocked(idempotencyService);
const mockUserDataArchive = jest.mocked(userDataArchive);

describe("Users Controller", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  const userId = "user-123";
  const contactId = "123e4567-e89b-12d3-a456-426614174001";

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      user: { sub: userId, role: "user" },
      body: {},
      query: {},
      params: {},
      headers: {},
      get: jest.fn().mockReturnValue(null),
      method: "GET",
      baseUrl: "/api/v1",
      route: { path: "/users" },
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };
  });

  describe("me", () => {
    it("should get current user successfully", async () => {
      const mockUser = {
        id: userId,
        username: "testuser",
        displayName: "Test User",
        email: "test@example.com",
      };

      mockUsersService.getMe.mockResolvedValue(mockUser);

      await usersController.me(mockRequest as Request, mockResponse as Response);

      expect(mockUsersService.getMe).toHaveBeenCalledWith(userId);
      expect(mockResponse.json).toHaveBeenCalledWith(mockUser);
    });

    it("should return 401 when not authenticated", async () => {
      mockRequest.user = undefined;

      await usersController.me(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: "Unauthorized" });
      expect(mockUsersService.getMe).not.toHaveBeenCalled();
    });

    it("should return 404 when user not found", async () => {
      mockUsersService.getMe.mockResolvedValue(null);

      await usersController.me(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: "User not found" });
    });
  });

  describe("list", () => {
    it("should list users with default pagination", async () => {
      const mockUsers = [{ id: userId, username: "testuser" }];

      mockUsersService.listAll.mockResolvedValue(mockUsers);

      await usersController.list(mockRequest as Request, mockResponse as Response);

      expect(mockUsersService.listAll).toHaveBeenCalledWith(50, 0);
      expect(mockResponse.json).toHaveBeenCalledWith(mockUsers);
    });

    it("should list users with custom pagination", async () => {
      const mockUsers = [{ id: userId, username: "testuser" }];

      mockRequest.query = { limit: "10", offset: "5" };
      mockUsersService.listAll.mockResolvedValue(mockUsers);

      await usersController.list(mockRequest as Request, mockResponse as Response);

      expect(mockUsersService.listAll).toHaveBeenCalledWith(10, 5);
      expect(mockResponse.json).toHaveBeenCalledWith(mockUsers);
    });
  });

  describe("adminCreateUser", () => {
    it("should create user successfully without idempotency", async () => {
      const userData = {
        username: "newuser",
        displayName: "New User",
        email: "new@example.com",
        password: "SecurePassword123!",
        role: "user",
      };

      const mockUser = {
        id: "user-456",
        ...userData,
      };

      mockRequest.body = userData;
      mockRequest.method = "POST";
      mockUsersService.createUser.mockResolvedValue(mockUser);

      await usersController.adminCreateUser(mockRequest as Request, mockResponse as Response);

      expect(mockUsersService.createUser).toHaveBeenCalledWith(userId, userData);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(mockUser);
    });

    it("should create user with idempotency", async () => {
      const userData = {
        username: "newuser",
        displayName: "New User",
        email: "new@example.com",
        password: "SecurePassword123!",
        role: "user",
      };

      const mockUser = {
        id: "user-456",
        ...userData,
      };

      const idempotencyKey = "idempotency-key-123";
      mockRequest.body = userData;
      mockRequest.method = "POST";
      mockRequest.get = jest.fn().mockReturnValue(idempotencyKey);
      mockIdempotencyService.resolveIdempotency.mockResolvedValue({
        type: "new",
        recordId: "record-123",
      });
      mockUsersService.createUser.mockResolvedValue(mockUser);
      mockIdempotencyService.persistIdempotencyResult.mockResolvedValue(undefined);

      await usersController.adminCreateUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.set).toHaveBeenCalledWith("Idempotency-Key", idempotencyKey);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(mockUser);
    });

    it("should replay idempotent request", async () => {
      const userData = {
        username: "newuser",
        displayName: "New User",
        email: "new@example.com",
        password: "SecurePassword123!",
        role: "user",
      };

      const idempotencyKey = "idempotency-key-123";
      const mockReplayResponse = { id: "user-456", username: "newuser" };

      mockRequest.body = userData;
      mockRequest.method = "POST";
      mockRequest.get = jest.fn().mockReturnValue(idempotencyKey);
      mockIdempotencyService.resolveIdempotency.mockResolvedValue({
        type: "replay",
        status: 201,
        body: mockReplayResponse,
      });

      await usersController.adminCreateUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.set).toHaveBeenCalledWith("Idempotency-Key", idempotencyKey);
      expect(mockResponse.set).toHaveBeenCalledWith("Idempotent-Replayed", "true");
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(mockReplayResponse);
      expect(mockUsersService.createUser).not.toHaveBeenCalled();
    });

    it("should return 400 for invalid body", async () => {
      mockRequest.body = { username: "ab" }; // Too short

      await usersController.adminCreateUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Object),
        }),
      );
      expect(mockUsersService.createUser).not.toHaveBeenCalled();
    });
  });

  describe("updateMe", () => {
    it("should update profile successfully without idempotency", async () => {
      const updateData = {
        displayName: "Updated Name",
        weight: 75,
        weightUnit: "kg" as const,
      };

      const mockUser = {
        id: userId,
        username: "testuser",
        ...updateData,
      };

      mockRequest.body = updateData;
      mockRequest.method = "PATCH";
      mockUsersService.updateProfile.mockResolvedValue(mockUser);

      await usersController.updateMe(mockRequest as Request, mockResponse as Response);

      expect(mockUsersService.updateProfile).toHaveBeenCalledWith(userId, updateData);
      expect(mockResponse.json).toHaveBeenCalledWith(mockUser);
    });

    it("should update profile with idempotency", async () => {
      const updateData = {
        displayName: "Updated Name",
      };

      const mockUser = {
        id: userId,
        username: "testuser",
        ...updateData,
      };

      const idempotencyKey = "idempotency-key-123";
      mockRequest.body = updateData;
      mockRequest.method = "PATCH";
      mockRequest.get = jest.fn().mockReturnValue(idempotencyKey);
      mockIdempotencyService.resolveIdempotency.mockResolvedValue({
        type: "new",
        recordId: "record-123",
      });
      mockUsersService.updateProfile.mockResolvedValue(mockUser);
      mockIdempotencyService.persistIdempotencyResult.mockResolvedValue(undefined);

      await usersController.updateMe(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.set).toHaveBeenCalledWith("Idempotency-Key", idempotencyKey);
      expect(mockResponse.json).toHaveBeenCalledWith(mockUser);
    });

    it("should return 401 when not authenticated", async () => {
      mockRequest.user = undefined;

      await usersController.updateMe(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockUsersService.updateProfile).not.toHaveBeenCalled();
    });

    it("should return 400 for invalid body", async () => {
      mockRequest.body = { username: "ab" }; // Too short

      await usersController.updateMe(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockUsersService.updateProfile).not.toHaveBeenCalled();
    });
  });

  describe("changePassword", () => {
    it("should change password successfully without idempotency", async () => {
      const passwordData = {
        currentPassword: "CurrentPassword123!",
        newPassword: "NewSecurePassword123!",
      };

      mockRequest.body = passwordData;
      mockRequest.method = "PATCH";
      mockUsersService.updatePassword.mockResolvedValue(undefined);

      await usersController.changePassword(mockRequest as Request, mockResponse as Response);

      expect(mockUsersService.updatePassword).toHaveBeenCalledWith(userId, passwordData);
      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockResponse.send).toHaveBeenCalled();
    });

    it("should change password with idempotency", async () => {
      const passwordData = {
        currentPassword: "CurrentPassword123!",
        newPassword: "NewSecurePassword123!",
      };

      const idempotencyKey = "idempotency-key-123";
      mockRequest.body = passwordData;
      mockRequest.method = "PATCH";
      mockRequest.get = jest.fn().mockReturnValue(idempotencyKey);
      mockIdempotencyService.resolveIdempotency.mockResolvedValue({
        type: "new",
        recordId: "record-123",
      });
      mockUsersService.updatePassword.mockResolvedValue(undefined);
      mockIdempotencyService.persistIdempotencyResult.mockResolvedValue(undefined);

      await usersController.changePassword(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.set).toHaveBeenCalledWith("Idempotency-Key", idempotencyKey);
      expect(mockResponse.status).toHaveBeenCalledWith(204);
    });

    it("should return 401 when not authenticated", async () => {
      mockRequest.user = undefined;

      await usersController.changePassword(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockUsersService.updatePassword).not.toHaveBeenCalled();
    });

    it("should return 400 for invalid body", async () => {
      mockRequest.body = { currentPassword: "short" }; // Too short

      await usersController.changePassword(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockUsersService.updatePassword).not.toHaveBeenCalled();
    });
  });

  describe("deleteAccount", () => {
    it("should delete account successfully without idempotency", async () => {
      const deleteData = {
        password: "CurrentPassword123!",
      };

      const mockSchedule = {
        scheduledAt: new Date("2024-01-15"),
        purgeDueAt: new Date("2024-01-29"),
        backupPurgeDueAt: new Date("2024-02-12"),
      };

      mockRequest.body = deleteData;
      mockRequest.method = "POST";
      mockUsersService.requestAccountDeletion.mockResolvedValue(mockSchedule);

      await usersController.deleteAccount(mockRequest as Request, mockResponse as Response);

      expect(mockUsersService.requestAccountDeletion).toHaveBeenCalledWith(
        userId,
        deleteData.password,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(202);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "pending_deletion",
        scheduledAt: mockSchedule.scheduledAt,
        purgeDueAt: mockSchedule.purgeDueAt,
        backupPurgeDueAt: mockSchedule.backupPurgeDueAt,
      });
    });

    it("should return 401 when not authenticated", async () => {
      mockRequest.user = undefined;

      await usersController.deleteAccount(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockUsersService.requestAccountDeletion).not.toHaveBeenCalled();
    });

    it("should return 400 for invalid body", async () => {
      mockRequest.body = { password: "short" }; // Too short

      await usersController.deleteAccount(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockUsersService.requestAccountDeletion).not.toHaveBeenCalled();
    });
  });

  describe("exportData", () => {
    it("should export user data successfully", async () => {
      const mockData = {
        user: { id: userId, username: "testuser" },
        sessions: [],
        exercises: [],
      };

      mockUsersService.collectUserData.mockResolvedValue(mockData);
      mockUserDataArchive.writeUserDataArchive.mockResolvedValue(undefined);

      await usersController.exportData(mockRequest as Request, mockResponse as Response);

      expect(mockUsersService.collectUserData).toHaveBeenCalledWith(userId);
      expect(mockResponse.setHeader).toHaveBeenCalledWith("Content-Type", "application/zip");
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        'attachment; filename="fitvibe_user_export.zip"',
      );
      expect(mockUserDataArchive.writeUserDataArchive).toHaveBeenCalledWith(mockResponse, mockData);
    });

    it("should return 401 when not authenticated", async () => {
      mockRequest.user = undefined;

      await usersController.exportData(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockUsersService.collectUserData).not.toHaveBeenCalled();
    });
  });

  describe("user preferences", () => {
    const preferences = {
      language: "de" as const,
      measurementSystem: "metric" as const,
    };

    it("should get user preferences", async () => {
      mockUsersService.getUserPreferences.mockResolvedValue(preferences);

      await usersController.getPreferences(mockRequest as Request, mockResponse as Response);

      expect(mockUsersService.getUserPreferences).toHaveBeenCalledWith(userId);
      expect(mockResponse.json).toHaveBeenCalledWith(preferences);
    });

    it("should update valid user preferences", async () => {
      mockRequest.body = { language: "de", measurementSystem: "imperial" };
      mockUsersService.updateUserPreferences.mockResolvedValue({
        language: "de",
        measurementSystem: "imperial",
      });

      await usersController.updatePreferences(mockRequest as Request, mockResponse as Response);

      expect(mockUsersService.updateUserPreferences).toHaveBeenCalledWith(userId, {
        language: "de",
        measurementSystem: "imperial",
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        language: "de",
        measurementSystem: "imperial",
      });
    });

    it("should reject empty preference updates", async () => {
      mockRequest.body = {};

      await usersController.updatePreferences(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockUsersService.updateUserPreferences).not.toHaveBeenCalled();
    });

    it("should reject unsupported preference values", async () => {
      mockRequest.body = { language: "xx", measurementSystem: "mixed" };

      await usersController.updatePreferences(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockUsersService.updateUserPreferences).not.toHaveBeenCalled();
    });
  });

  describe("getPrivacy", () => {
    const privacySettings = {
      defaultVisibility: "private" as const,
      allowFollowers: true,
      showEmail: false,
      showWeight: false,
      showFitnessLevel: false,
    };

    it("should return privacy settings", async () => {
      mockUsersService.getPrivacySettings.mockResolvedValue(privacySettings);

      await usersController.getPrivacy(mockRequest as Request, mockResponse as Response);

      expect(mockUsersService.getPrivacySettings).toHaveBeenCalledWith(userId);
      expect(mockResponse.json).toHaveBeenCalledWith(privacySettings);
    });

    it("should return 401 when not authenticated", async () => {
      mockRequest.user = undefined;

      await usersController.getPrivacy(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockUsersService.getPrivacySettings).not.toHaveBeenCalled();
    });
  });

  describe("updatePrivacy", () => {
    const privacySettings = {
      defaultVisibility: "followers" as const,
      allowFollowers: false,
      showEmail: true,
      showWeight: false,
      showFitnessLevel: false,
    };

    it("should update privacy settings", async () => {
      mockRequest.body = { allowFollowers: false, showEmail: true, defaultVisibility: "followers" };
      mockUsersService.updatePrivacySettings.mockResolvedValue(privacySettings);

      await usersController.updatePrivacy(mockRequest as Request, mockResponse as Response);

      expect(mockUsersService.updatePrivacySettings).toHaveBeenCalledWith(userId, {
        allowFollowers: false,
        showEmail: true,
        defaultVisibility: "followers",
      });
      expect(mockResponse.json).toHaveBeenCalledWith(privacySettings);
    });

    it("should return 400 for an empty body", async () => {
      mockRequest.body = {};

      await usersController.updatePrivacy(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockUsersService.updatePrivacySettings).not.toHaveBeenCalled();
    });

    it("should return 401 when not authenticated", async () => {
      mockRequest.user = undefined;
      mockRequest.body = { allowFollowers: true };

      await usersController.updatePrivacy(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockUsersService.updatePrivacySettings).not.toHaveBeenCalled();
    });
  });

  describe("getById", () => {
    it("should get user by id successfully", async () => {
      const targetUserId = "user-456";
      const mockUser = {
        id: targetUserId,
        username: "targetuser",
        displayName: "Target User",
      };

      mockRequest.params = { id: targetUserId };
      mockUsersService.getMe.mockResolvedValue(mockUser);

      await usersController.getById(mockRequest as Request, mockResponse as Response);

      expect(mockUsersService.getMe).toHaveBeenCalledWith(targetUserId);
      expect(mockResponse.json).toHaveBeenCalledWith(mockUser);
    });

    it("should return 404 when user not found", async () => {
      const targetUserId = "user-456";
      mockRequest.params = { id: targetUserId };
      mockUsersService.getMe.mockResolvedValue(null);

      await usersController.getById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: "User not found" });
    });
  });

  describe("listUserContacts", () => {
    it("should list contacts successfully", async () => {
      const mockContacts = [
        {
          id: contactId,
          user_id: userId,
          contact_type: "email",
          contact_value: "test@example.com",
          verified: true,
        },
      ];

      mockUsersService.listContacts.mockResolvedValue(mockContacts);

      await usersController.listUserContacts(mockRequest as Request, mockResponse as Response);

      expect(mockUsersService.listContacts).toHaveBeenCalledWith(userId);
      expect(mockResponse.json).toHaveBeenCalledWith(mockContacts);
    });

    it("should return 401 when not authenticated", async () => {
      mockRequest.user = undefined;

      await usersController.listUserContacts(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockUsersService.listContacts).not.toHaveBeenCalled();
    });
  });

  describe("requestContactVerificationHandler", () => {
    it("should request contact verification successfully without idempotency", async () => {
      const mockResult = {
        id: contactId,
        verification_token_sent: true,
      };

      mockRequest.params = { contactId };
      mockRequest.method = "POST";
      mockUsersService.requestContactVerification.mockResolvedValue(mockResult);

      await usersController.requestContactVerificationHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockUsersService.requestContactVerification).toHaveBeenCalledWith(userId, contactId);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(mockResult);
    });

    it("should return 401 when not authenticated", async () => {
      mockRequest.user = undefined;

      await usersController.requestContactVerificationHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockUsersService.requestContactVerification).not.toHaveBeenCalled();
    });

    it("should return 400 for invalid contactId", async () => {
      mockRequest.params = { contactId: "invalid-uuid" };

      await usersController.requestContactVerificationHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockUsersService.requestContactVerification).not.toHaveBeenCalled();
    });
  });

  describe("updateEmail", () => {
    it("should update email successfully without idempotency", async () => {
      const emailData = {
        email: "newemail@example.com",
      };

      const mockProfile = {
        id: userId,
        primary_email: emailData.email,
      };

      mockRequest.body = emailData;
      mockRequest.method = "PATCH";
      mockUsersService.updatePrimaryEmail.mockResolvedValue(mockProfile);

      await usersController.updateEmail(mockRequest as Request, mockResponse as Response);

      expect(mockUsersService.updatePrimaryEmail).toHaveBeenCalledWith(userId, emailData.email);
      expect(mockResponse.json).toHaveBeenCalledWith(mockProfile);
    });

    it("should return 401 when not authenticated", async () => {
      mockRequest.user = undefined;

      await usersController.updateEmail(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockUsersService.updatePrimaryEmail).not.toHaveBeenCalled();
    });

    it("should return 400 for invalid email", async () => {
      mockRequest.body = { email: "invalid-email" };

      await usersController.updateEmail(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockUsersService.updatePrimaryEmail).not.toHaveBeenCalled();
    });
  });

  describe("updatePhone", () => {
    it("should update phone successfully without idempotency", async () => {
      const phoneData = {
        phone: "+1234567890",
        isRecovery: true,
      };

      const mockProfile = {
        id: userId,
        primary_phone: phoneData.phone,
      };

      mockRequest.body = phoneData;
      mockRequest.method = "PATCH";
      mockUsersService.updatePhoneNumber.mockResolvedValue(mockProfile);

      await usersController.updatePhone(mockRequest as Request, mockResponse as Response);

      expect(mockUsersService.updatePhoneNumber).toHaveBeenCalledWith(
        userId,
        phoneData.phone,
        true,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(mockProfile);
    });

    it("should use default isRecovery when not provided", async () => {
      const phoneData = {
        phone: "+1234567890",
      };

      const mockProfile = {
        id: userId,
        primary_phone: phoneData.phone,
      };

      mockRequest.body = phoneData;
      mockRequest.method = "PATCH";
      mockUsersService.updatePhoneNumber.mockResolvedValue(mockProfile);

      await usersController.updatePhone(mockRequest as Request, mockResponse as Response);

      expect(mockUsersService.updatePhoneNumber).toHaveBeenCalledWith(
        userId,
        phoneData.phone,
        true,
      );
    });

    it("should return 401 when not authenticated", async () => {
      mockRequest.user = undefined;

      await usersController.updatePhone(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockUsersService.updatePhoneNumber).not.toHaveBeenCalled();
    });
  });

  describe("verifyContactHandler", () => {
    it("should verify contact successfully without idempotency", async () => {
      const token = "verification-token-12345";
      const mockContact = {
        id: contactId,
        user_id: userId,
        contact_type: "email",
        contact_value: "test@example.com",
        verified: false,
      };

      const mockVerifiedContact = {
        ...mockContact,
        verified: true,
      };

      mockRequest.params = { contactId };
      mockRequest.body = { token };
      mockRequest.method = "POST";
      mockUsersRepository.getContactById.mockResolvedValue(mockContact);
      mockUsersService.verifyContact.mockResolvedValue(mockVerifiedContact);

      await usersController.verifyContactHandler(mockRequest as Request, mockResponse as Response);

      expect(mockUsersRepository.getContactById).toHaveBeenCalledWith(contactId);
      expect(mockUsersService.verifyContact).toHaveBeenCalledWith(userId, contactId, token);
      expect(mockResponse.json).toHaveBeenCalledWith(mockVerifiedContact);
    });

    it("should return 401 when not authenticated", async () => {
      mockRequest.user = undefined;

      await usersController.verifyContactHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockUsersService.verifyContact).not.toHaveBeenCalled();
    });

    it("should return 400 for invalid contactId", async () => {
      mockRequest.params = { contactId: "invalid-uuid" };
      mockRequest.body = { token: "verification-token-12345" };

      await usersController.verifyContactHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockUsersService.verifyContact).not.toHaveBeenCalled();
    });

    it("should return 403 when contact not found or doesn't belong to user", async () => {
      mockRequest.params = { contactId };
      mockRequest.body = { token: "verification-token-12345" };
      mockUsersRepository.getContactById.mockResolvedValue(null);

      await usersController.verifyContactHandler(mockRequest as Request, mockResponse as Response);

      expect(mockUsersRepository.getContactById).toHaveBeenCalledWith(contactId);
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "FORBIDDEN",
          }),
        }),
      );
      expect(mockUsersService.verifyContact).not.toHaveBeenCalled();
    });

    it("should return 403 when contact belongs to different user", async () => {
      const mockContact = {
        id: contactId,
        user_id: "different-user",
        contact_type: "email",
        contact_value: "test@example.com",
        verified: false,
      };

      mockRequest.params = { contactId };
      mockRequest.body = { token: "verification-token-12345" };
      mockUsersRepository.getContactById.mockResolvedValue(mockContact);

      await usersController.verifyContactHandler(mockRequest as Request, mockResponse as Response);

      expect(mockUsersRepository.getContactById).toHaveBeenCalledWith(contactId);
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "FORBIDDEN",
          }),
        }),
      );
      expect(mockUsersService.verifyContact).not.toHaveBeenCalled();
    });
  });

  describe("removeContactHandler", () => {
    it("should remove contact successfully without idempotency", async () => {
      mockRequest.params = { contactId };
      mockRequest.method = "DELETE";
      mockUsersService.removeContact.mockResolvedValue(undefined);

      await usersController.removeContactHandler(mockRequest as Request, mockResponse as Response);

      expect(mockUsersService.removeContact).toHaveBeenCalledWith(userId, contactId);
      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockResponse.send).toHaveBeenCalled();
    });

    it("should return 401 when not authenticated", async () => {
      mockRequest.user = undefined;

      await usersController.removeContactHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockUsersService.removeContact).not.toHaveBeenCalled();
    });

    it("should return 400 for invalid contactId", async () => {
      mockRequest.params = { contactId: "invalid-uuid" };

      await usersController.removeContactHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockUsersService.removeContact).not.toHaveBeenCalled();
    });
  });

  describe("adminChangeStatus", () => {
    it("should change status successfully without idempotency", async () => {
      const targetUserId = "user-456";
      const statusData = {
        status: "suspended" as const,
      };

      const mockProfile = {
        id: targetUserId,
        status: "suspended",
      };

      mockRequest.params = { id: targetUserId };
      mockRequest.body = statusData;
      mockRequest.method = "PATCH";
      mockUsersService.changeStatus.mockResolvedValue(mockProfile);

      await usersController.adminChangeStatus(mockRequest as Request, mockResponse as Response);

      expect(mockUsersService.changeStatus).toHaveBeenCalledWith(userId, targetUserId, "suspended");
      expect(mockResponse.json).toHaveBeenCalledWith(mockProfile);
    });

    it("should return 400 for invalid body", async () => {
      mockRequest.params = { id: "user-456" };
      mockRequest.body = { status: "invalid" };

      await usersController.adminChangeStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockUsersService.changeStatus).not.toHaveBeenCalled();
    });
  });

  describe("getMetrics", () => {
    it("should get own metrics successfully", async () => {
      const mockMetrics = {
        total_sessions: 10,
        total_exercises: 5,
      };

      mockRequest.params = {};
      mockUsersRepository.getUserMetrics.mockResolvedValue(mockMetrics);

      await usersController.getMetrics(mockRequest as Request, mockResponse as Response);

      expect(mockUsersRepository.getUserMetrics).toHaveBeenCalledWith(userId);
      expect(mockResponse.json).toHaveBeenCalledWith(mockMetrics);
    });

    it("should get metrics for specific user as admin", async () => {
      const targetUserId = "user-456";
      const mockMetrics = {
        total_sessions: 20,
        total_exercises: 10,
      };

      mockRequest.user = { sub: userId, role: "admin" };
      mockRequest.params = { userId: targetUserId };
      mockUsersRepository.getUserMetrics.mockResolvedValue(mockMetrics);

      await usersController.getMetrics(mockRequest as Request, mockResponse as Response);

      expect(mockUsersRepository.getUserMetrics).toHaveBeenCalledWith(targetUserId);
      expect(mockResponse.json).toHaveBeenCalledWith(mockMetrics);
    });

    it("should return 401 when not authenticated", async () => {
      mockRequest.user = undefined;
      mockRequest.params = {};

      await usersController.getMetrics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockUsersRepository.getUserMetrics).not.toHaveBeenCalled();
    });

    it("should return 403 when non-admin tries to access other user's metrics", async () => {
      const targetUserId = "user-456";

      mockRequest.user = { sub: userId, role: "user" };
      mockRequest.params = { userId: targetUserId };

      await usersController.getMetrics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "FORBIDDEN",
          }),
        }),
      );
      expect(mockUsersRepository.getUserMetrics).not.toHaveBeenCalled();
    });
  });
});
