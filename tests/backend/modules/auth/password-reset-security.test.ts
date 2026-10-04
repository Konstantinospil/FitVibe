import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import bcrypt from "bcryptjs";
import * as authService from "../../../../apps/backend/src/modules/auth/auth.service.js";
import * as authRepo from "../../../../apps/backend/src/modules/auth/auth.repository.js";
import * as emailBlacklistRepo from "../../../../apps/backend/src/modules/common/email-blacklist.repository.js";
import { HttpError } from "../../../../apps/backend/src/utils/http.js";
import type {
  AuthTokenRecord,
  AuthUserRecord,
} from "../../../../apps/backend/src/modules/auth/auth.repository.js";

jest.mock("../../../../apps/backend/src/modules/auth/auth.repository.js");
jest.mock("bcryptjs");
jest.mock("../../../../apps/backend/src/services/mailer.service.js");
jest.mock("../../../../apps/backend/src/modules/common/email-blacklist.repository.js");

const mockAuthRepo = jest.mocked(authRepo);
const mockEmailBlacklistRepo = jest.mocked(emailBlacklistRepo);
const mockBcrypt = jest.mocked(bcrypt);

describe("AC-1.9: Password Reset Security", () => {
  const mockUser: AuthUserRecord = {
    id: "user-123",
    username: "testuser",
    display_name: "Test User",
    locale: "en-US",
    preferred_lang: "en",
    primary_email: "test@example.com",
    email_verified: true,
    role_code: "athlete",
    status: "active",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    password_hash: "$2a$12$oldpasswordhash",
    terms_accepted: true,
    terms_accepted_at: "2024-01-01T00:00:00Z",
    terms_version: "2024-06-01",
  };

  const validResetToken: AuthTokenRecord = {
    id: "token-123",
    user_id: "user-123",
    token_type: "password_reset",
    token_hash: "valid-token-hash",
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    consumed_at: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockEmailBlacklistRepo.isEmailBlacklisted.mockResolvedValue(false);
    mockAuthRepo.findAuthToken.mockResolvedValue(validResetToken);
    mockAuthRepo.findUserById.mockResolvedValue(mockUser);
    mockBcrypt.hash.mockResolvedValue("$2a$12$newpasswordhash" as never);
    mockAuthRepo.resetPasswordAtomic.mockResolvedValue(true);
  });

  it("applies password replacement, reset-token consumption, and auth revocation through one atomic boundary", async () => {
    await authService.resetPassword("valid-token", "NewValidPassword123!");

    expect(mockAuthRepo.resetPasswordAtomic).toHaveBeenCalledWith(
      "user-123",
      "$2a$12$newpasswordhash",
      "token-123",
      "password_reset",
    );
  });

  it("rejects replay when the reset token loses the atomic claim", async () => {
    mockAuthRepo.resetPasswordAtomic.mockResolvedValue(false);

    await expect(
      authService.resetPassword("valid-token", "NewValidPassword123!"),
    ).rejects.toMatchObject({
      status: 400,
      code: "AUTH_INVALID_TOKEN",
    });
  });

  it("rejects a token already consumed before validation", async () => {
    mockAuthRepo.findAuthToken.mockResolvedValue(undefined);

    await expect(
      authService.resetPassword("consumed-token", "NewValidPassword123!"),
    ).rejects.toMatchObject({
      status: 400,
      code: "AUTH_INVALID_TOKEN",
    });
    expect(mockAuthRepo.resetPasswordAtomic).not.toHaveBeenCalled();
  });

  it("rejects an expired token and consumes it defensively", async () => {
    mockAuthRepo.findAuthToken.mockResolvedValue({
      ...validResetToken,
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    mockAuthRepo.consumeAuthToken.mockResolvedValue(1);

    await expect(
      authService.resetPassword("expired-token", "NewValidPassword123!"),
    ).rejects.toMatchObject({
      status: 400,
      code: "AUTH_INVALID_TOKEN",
    });
    expect(mockAuthRepo.consumeAuthToken).toHaveBeenCalledWith("token-123");
    expect(mockAuthRepo.resetPasswordAtomic).not.toHaveBeenCalled();
  });

  it("rejects a reset token whose user no longer exists", async () => {
    mockAuthRepo.findUserById.mockResolvedValue(undefined);

    await expect(
      authService.resetPassword("valid-token", "NewValidPassword123!"),
    ).rejects.toMatchObject({
      status: 404,
      code: "AUTH_USER_NOT_FOUND",
    });
    expect(mockAuthRepo.resetPasswordAtomic).not.toHaveBeenCalled();
  });

  it("rejects a blacklisted primary email before changing security state", async () => {
    mockEmailBlacklistRepo.isEmailBlacklisted.mockResolvedValue(true);
    mockAuthRepo.consumeAuthToken.mockResolvedValue(1);

    await expect(
      authService.resetPassword("valid-token", "NewValidPassword123!"),
    ).rejects.toMatchObject({
      status: 400,
      code: "AUTH_INVALID_TOKEN",
    });
    expect(mockAuthRepo.resetPasswordAtomic).not.toHaveBeenCalled();
  });

  it("enforces password policy before the atomic transition", async () => {
    await expect(authService.resetPassword("valid-token", "weak")).rejects.toBeInstanceOf(
      HttpError,
    );
    expect(mockAuthRepo.resetPasswordAtomic).not.toHaveBeenCalled();
  });

  it("propagates atomic transaction failure without falling back to partial writes", async () => {
    mockAuthRepo.resetPasswordAtomic.mockRejectedValue(new Error("transaction rolled back"));

    await expect(
      authService.resetPassword("valid-token", "NewValidPassword123!"),
    ).rejects.toThrow("transaction rolled back");

    expect(mockAuthRepo.updateUserPassword).not.toHaveBeenCalled();
    expect(mockAuthRepo.markAuthTokensConsumed).not.toHaveBeenCalled();
    expect(mockAuthRepo.revokeRefreshByUserId).not.toHaveBeenCalled();
  });

  it("allows only the atomic claimant to succeed under concurrent reset attempts", async () => {
    mockAuthRepo.resetPasswordAtomic
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const results = await Promise.allSettled([
      authService.resetPassword("valid-token", "PasswordOne123!"),
      authService.resetPassword("valid-token", "PasswordTwo123!"),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });
});
