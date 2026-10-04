import * as twoFactorService from "../../../../apps/backend/src/modules/auth/two-factor.service.js";
import { HttpError } from "../../../../apps/backend/src/utils/http.js";
import bcrypt from "bcryptjs";
import { authenticator } from "@otplib/preset-default";
import QRCode from "qrcode";

// Mock dependencies
jest.mock("bcryptjs");
jest.mock("@otplib/preset-default");
jest.mock("qrcode");
jest.mock("../../../../apps/backend/src/db/connection.js");
jest.mock("../../../../apps/backend/src/modules/auth/totp-secret.crypto.js", () => ({
  encryptTotpSecret: jest.fn((secret: string) => `enc:${secret}`),
  decryptTotpSecret: jest.fn((stored: string) =>
    stored.startsWith("enc:") ? stored.slice(4) : stored,
  ),
}));

const mockBcrypt = jest.mocked(bcrypt);
const mockAuthenticator = jest.mocked(authenticator);
const mockQRCode = jest.mocked(QRCode);

// Mock db
const queryBuilders: Record<string, unknown> = {};

function createMockQueryBuilder(defaultValue: unknown = []) {
  const builder = Object.assign(Promise.resolve(defaultValue), {
    where: jest.fn().mockReturnThis(),
    update: jest.fn().mockResolvedValue(1),
    insert: jest.fn().mockResolvedValue([1]),
    del: jest.fn().mockResolvedValue(1),
    first: jest.fn().mockResolvedValue(defaultValue),
    count: jest.fn().mockReturnThis(),
  });
  return builder;
}

jest.mock("../../../../apps/backend/src/db/connection.js", () => {
  const mockDbFunction = jest.fn((table: string) => {
    if (!queryBuilders[table]) {
      queryBuilders[table] = createMockQueryBuilder();
    }
    return queryBuilders[table];
  }) as jest.Mock & { transaction: jest.Mock };

  mockDbFunction.transaction = jest.fn(async (callback: (trx: typeof mockDbFunction) => unknown) =>
    callback(mockDbFunction),
  );

  return {
    db: mockDbFunction,
  };
});

describe("Two-Factor Lifecycle Service", () => {
  const userId = "user-123";
  const userEmail = "test@example.com";
  const password = "SecureP@ssw0rd123";
  const passwordHash = "hashed_password";

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(queryBuilders).forEach((key) => delete queryBuilders[key]);
  });

  describe("lifecycle orchestration", () => {
    it("resolves the primary email before starting setup", async () => {
      queryBuilders["user_contacts"] = createMockQueryBuilder({ value: userEmail });
      queryBuilders["user_2fa_settings"] = createMockQueryBuilder(null);
      queryBuilders["backup_codes"] = createMockQueryBuilder();
      queryBuilders["audit_log"] = createMockQueryBuilder();

      mockAuthenticator.generateSecret.mockReturnValue("TEST_SECRET");
      mockAuthenticator.keyuri.mockReturnValue("otpauth://totp/test");
      mockQRCode.toDataURL.mockResolvedValue("data:image/png;base64,test");
      mockBcrypt.hash.mockResolvedValue("hashed_code" as never);

      const result = await twoFactorService.beginTwoFactorSetup(userId);

      expect(result.secret).toBe("TEST_SECRET");
      expect(
        (queryBuilders["user_contacts"] as { where: jest.Mock }).where,
      ).toHaveBeenCalledWith({
        user_id: userId,
        type: "email",
        is_primary: true,
      });
    });

    it("fails setup when the primary email is missing", async () => {
      queryBuilders["user_2fa_settings"] = createMockQueryBuilder(null);
      queryBuilders["user_contacts"] = createMockQueryBuilder(null);

      await expect(twoFactorService.beginTwoFactorSetup(userId)).rejects.toMatchObject({
        code: "E.USER.EMAIL_NOT_FOUND",
        status: 404,
      });
    });

    it("fails disable when the user no longer exists", async () => {
      queryBuilders["users"] = createMockQueryBuilder(null);

      await expect(twoFactorService.disableTwoFactor(userId, password, "123456")).rejects.toMatchObject({
        code: "E.USER.NOT_FOUND",
        status: 404,
      });
    });
  });

  describe("setupTwoFactor", () => {
    it("should setup 2FA for new user", async () => {
      const secret = "TEST_SECRET";
      const qrCode = "data:image/png;base64,test";
      const backupCodes = ["CODE1-123", "CODE2-456"];

      mockAuthenticator.generateSecret.mockReturnValue(secret);
      mockAuthenticator.keyuri.mockReturnValue("otpauth://totp/test");
      mockQRCode.toDataURL.mockResolvedValue(qrCode);
      mockBcrypt.hash.mockResolvedValue("hashed_code" as never);

      // Mock user_2fa_settings query - no existing record
      queryBuilders["user_2fa_settings"] = createMockQueryBuilder(null);
      (queryBuilders["user_2fa_settings"] as { first: jest.Mock }).first.mockResolvedValue(null);

      // Mock backup_codes insert
      queryBuilders["backup_codes"] = createMockQueryBuilder();
      (queryBuilders["backup_codes"] as { insert: jest.Mock }).insert.mockResolvedValue([1]);

      const result = await twoFactorService.setupTwoFactor(userId, userEmail);

      expect(result.secret).toBe(secret);
      expect(result.qrCode).toBe(qrCode);
      expect(result.backupCodes).toHaveLength(10);
      expect(mockAuthenticator.generateSecret).toHaveBeenCalled();
      expect(mockQRCode.toDataURL).toHaveBeenCalled();
    });

    it("should update existing 2FA settings when not enabled", async () => {
      const secret = "TEST_SECRET";
      const existingSettings = {
        id: "settings-id",
        user_id: userId,
        totp_secret: "old_secret",
        is_enabled: false,
        is_verified: false,
        recovery_email: null,
        recovery_phone: null,
        enabled_at: null,
        last_used_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockAuthenticator.generateSecret.mockReturnValue(secret);
      mockQRCode.toDataURL.mockResolvedValue("data:image/png;base64,test");
      mockBcrypt.hash.mockResolvedValue("hashed_code" as never);

      queryBuilders["user_2fa_settings"] = createMockQueryBuilder(existingSettings);
      (queryBuilders["user_2fa_settings"] as { first: jest.Mock }).first.mockResolvedValue(
        existingSettings,
      );
      (queryBuilders["user_2fa_settings"] as { update: jest.Mock }).update.mockResolvedValue(1);

      queryBuilders["backup_codes"] = createMockQueryBuilder();
      (queryBuilders["backup_codes"] as { insert: jest.Mock }).insert.mockResolvedValue([1]);

      const result = await twoFactorService.setupTwoFactor(userId, userEmail);

      expect(result.secret).toBe(secret);
      expect(
        (queryBuilders["user_2fa_settings"] as { update: jest.Mock }).update,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          totp_secret: `enc:${secret}`,
          is_enabled: false,
          is_verified: false,
        }),
      );
    });

    it("should throw error when 2FA is already enabled", async () => {
      const existingSettings = {
        id: "settings-id",
        user_id: userId,
        totp_secret: "secret",
        is_enabled: true,
        is_verified: true,
        recovery_email: null,
        recovery_phone: null,
        enabled_at: new Date().toISOString(),
        last_used_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      queryBuilders["user_2fa_settings"] = createMockQueryBuilder(existingSettings);
      (queryBuilders["user_2fa_settings"] as { first: jest.Mock }).first.mockResolvedValue(
        existingSettings,
      );

      await expect(twoFactorService.setupTwoFactor(userId, userEmail)).rejects.toThrow(HttpError);
      const error = await twoFactorService.setupTwoFactor(userId, userEmail).catch((e) => e);
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).code).toBe("2FA_ALREADY_ENABLED");
    });
  });

  describe("verifyAndEnable2FA", () => {
    it("should verify and enable 2FA successfully", async () => {
      const code = "123456";
      const settings = {
        id: "settings-id",
        user_id: userId,
        totp_secret: "secret",
        is_enabled: false,
        is_verified: false,
        recovery_email: null,
        recovery_phone: null,
        enabled_at: null,
        last_used_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockAuthenticator.verify.mockReturnValue(true);

      queryBuilders["user_2fa_settings"] = createMockQueryBuilder(settings);
      (queryBuilders["user_2fa_settings"] as { first: jest.Mock }).first.mockResolvedValue(
        settings,
      );
      (queryBuilders["user_2fa_settings"] as { update: jest.Mock }).update.mockResolvedValue(1);

      queryBuilders["audit_log"] = createMockQueryBuilder();
      (queryBuilders["audit_log"] as { insert: jest.Mock }).insert.mockResolvedValue([1]);

      const result = await twoFactorService.verifyAndEnable2FA(userId, code);

      expect(result).toBe(true);
      expect(mockAuthenticator.verify).toHaveBeenCalledWith({
        token: code,
        secret: settings.totp_secret,
      });
      expect(
        (queryBuilders["user_2fa_settings"] as { update: jest.Mock }).update,
      ).toHaveBeenCalled();
    });

    it("should throw error when settings not found", async () => {
      queryBuilders["user_2fa_settings"] = createMockQueryBuilder(null);
      (queryBuilders["user_2fa_settings"] as { first: jest.Mock }).first.mockResolvedValue(null);

      await expect(twoFactorService.verifyAndEnable2FA(userId, "123456")).rejects.toThrow(HttpError);
      const error = await twoFactorService.verifyAndEnable2FA(userId, "123456").catch((e) => e);
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).code).toBe("2FA_NOT_SETUP");
    });

    it("should throw error when 2FA is already enabled", async () => {
      const settings = {
        id: "settings-id",
        user_id: userId,
        totp_secret: "secret",
        is_enabled: true,
        is_verified: true,
        recovery_email: null,
        recovery_phone: null,
        enabled_at: new Date().toISOString(),
        last_used_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      queryBuilders["user_2fa_settings"] = createMockQueryBuilder(settings);
      (queryBuilders["user_2fa_settings"] as { first: jest.Mock }).first.mockResolvedValue(
        settings,
      );

      await expect(twoFactorService.verifyAndEnable2FA(userId, "123456")).rejects.toThrow(HttpError);
      const error = await twoFactorService.verifyAndEnable2FA(userId, "123456").catch((e) => e);
      expect((error as HttpError).code).toBe("2FA_ALREADY_ENABLED");
    });

    it("should throw error when code is invalid", async () => {
      const settings = {
        id: "settings-id",
        user_id: userId,
        totp_secret: "secret",
        is_enabled: false,
        is_verified: false,
        recovery_email: null,
        recovery_phone: null,
        enabled_at: null,
        last_used_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockAuthenticator.verify.mockReturnValue(false);

      queryBuilders["user_2fa_settings"] = createMockQueryBuilder(settings);
      (queryBuilders["user_2fa_settings"] as { first: jest.Mock }).first.mockResolvedValue(
        settings,
      );

      await expect(twoFactorService.verifyAndEnable2FA(userId, "invalid")).rejects.toThrow(HttpError);
      const error = await twoFactorService.verifyAndEnable2FA(userId, "invalid").catch((e) => e);
      expect((error as HttpError).code).toBe("INVALID_2FA_CODE");
    });
  });

  describe("verify2FACode", () => {
    it("should verify TOTP code successfully", async () => {
      const code = "123456";
      const settings = {
        id: "settings-id",
        user_id: userId,
        totp_secret: "secret",
        is_enabled: true,
        is_verified: true,
        recovery_email: null,
        recovery_phone: null,
        enabled_at: new Date().toISOString(),
        last_used_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockAuthenticator.verify.mockReturnValue(true);

      queryBuilders["user_2fa_settings"] = createMockQueryBuilder(settings);
      (queryBuilders["user_2fa_settings"] as { first: jest.Mock }).first.mockResolvedValue(
        settings,
      );
      (queryBuilders["user_2fa_settings"] as { update: jest.Mock }).update.mockResolvedValue(1);

      const result = await twoFactorService.verify2FACode(userId, code);

      expect(result).toBe(true);
      expect(mockAuthenticator.verify).toHaveBeenCalled();
    });

    it("should return false when settings not found", async () => {
      queryBuilders["user_2fa_settings"] = createMockQueryBuilder(null);
      (queryBuilders["user_2fa_settings"] as { first: jest.Mock }).first.mockResolvedValue(null);

      const result = await twoFactorService.verify2FACode(userId, "123456");

      expect(result).toBe(false);
    });

    it("should reject enabled but unverified settings", async () => {
      const settings = {
        id: "settings-id",
        user_id: userId,
        totp_secret: "secret",
        is_enabled: true,
        is_verified: false,
        recovery_email: null,
        recovery_phone: null,
        enabled_at: null,
        last_used_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      queryBuilders["user_2fa_settings"] = createMockQueryBuilder(settings);
      (queryBuilders["user_2fa_settings"] as { first: jest.Mock }).first.mockResolvedValue(
        settings,
      );

      const result = await twoFactorService.verify2FACode(userId, "123456");

      expect(result).toBe(false);
      expect(mockAuthenticator.verify).not.toHaveBeenCalled();
    });

    it("should verify backup code when TOTP fails", async () => {
      const code = "BACKUP-12";
      const settings = {
        id: "settings-id",
        user_id: userId,
        totp_secret: "secret",
        is_enabled: true,
        is_verified: true,
        recovery_email: null,
        recovery_phone: null,
        enabled_at: new Date().toISOString(),
        last_used_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockAuthenticator.verify.mockReturnValue(false);
      mockBcrypt.compare.mockResolvedValue(true as never);

      queryBuilders["user_2fa_settings"] = createMockQueryBuilder(settings);
      (queryBuilders["user_2fa_settings"] as { first: jest.Mock }).first.mockResolvedValue(
        settings,
      );

      queryBuilders["backup_codes"] = createMockQueryBuilder([
        {
          id: "backup-id",
          user_id: userId,
          code_hash: "hashed",
          is_used: false,
          used_at: null,
          generation_batch: 1,
          created_at: new Date().toISOString(),
        },
      ]);

      (queryBuilders["backup_codes"] as { where: jest.Mock }).where.mockReturnThis();
      (queryBuilders["backup_codes"] as { update: jest.Mock }).update.mockResolvedValue(1);

      const result = await twoFactorService.verify2FACode(userId, code);

      expect(result).toBe(true);
      expect(mockBcrypt.compare).toHaveBeenCalled();
    });

    it("should reject a backup code when another request consumed it first", async () => {
      const settings = {
        id: "settings-id",
        user_id: userId,
        totp_secret: "secret",
        is_enabled: true,
        is_verified: true,
        recovery_email: null,
        recovery_phone: null,
        enabled_at: new Date().toISOString(),
        last_used_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockAuthenticator.verify.mockReturnValue(false);
      mockBcrypt.compare.mockResolvedValue(true as never);
      queryBuilders["user_2fa_settings"] = createMockQueryBuilder(settings);
      (queryBuilders["user_2fa_settings"] as { first: jest.Mock }).first.mockResolvedValue(
        settings,
      );
      queryBuilders["backup_codes"] = createMockQueryBuilder([
        {
          id: "backup-id",
          user_id: userId,
          code_hash: "hashed",
          is_used: false,
          used_at: null,
          generation_batch: 1,
          created_at: new Date().toISOString(),
        },
      ]);
      (queryBuilders["backup_codes"] as { update: jest.Mock }).update.mockResolvedValue(0);

      const result = await twoFactorService.verify2FACode(userId, "BACKUP-12");

      expect(result).toBe(false);
    });

    it("should return false when both TOTP and backup code fail", async () => {
      const code = "invalid";
      const settings = {
        id: "settings-id",
        user_id: userId,
        totp_secret: "secret",
        is_enabled: true,
        is_verified: true,
        recovery_email: null,
        recovery_phone: null,
        enabled_at: new Date().toISOString(),
        last_used_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockAuthenticator.verify.mockReturnValue(false);
      mockBcrypt.compare.mockResolvedValue(false as never);

      queryBuilders["user_2fa_settings"] = createMockQueryBuilder(settings);
      (queryBuilders["user_2fa_settings"] as { first: jest.Mock }).first.mockResolvedValue(
        settings,
      );

      queryBuilders["backup_codes"] = createMockQueryBuilder([]);

      const result = await twoFactorService.verify2FACode(userId, code);

      expect(result).toBe(false);
    });
  });

  describe("sensitive 2FA administration", () => {
    const enabledSettings = {
      id: "settings-id",
      user_id: userId,
      totp_secret: "enc:secret",
      is_enabled: true,
      is_verified: true,
      recovery_email: null,
      recovery_phone: null,
      enabled_at: new Date().toISOString(),
      last_used_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it("requires password and current factor before disabling 2FA", async () => {
      queryBuilders["users"] = createMockQueryBuilder({ password_hash: passwordHash });
      queryBuilders["user_2fa_settings"] = createMockQueryBuilder(enabledSettings);
      queryBuilders["backup_codes"] = createMockQueryBuilder();
      queryBuilders["audit_log"] = createMockQueryBuilder();
      mockBcrypt.compare.mockResolvedValue(true as never);
      mockAuthenticator.verify.mockReturnValue(true);

      await expect(
        twoFactorService.disableTwoFactor(userId, password, "123456"),
      ).resolves.toBeUndefined();

      expect(mockBcrypt.compare).toHaveBeenCalledWith(password, passwordHash);
      expect(mockAuthenticator.verify).toHaveBeenCalledWith({
        token: "123456",
        secret: "secret",
      });
      expect(
        (queryBuilders["user_2fa_settings"] as { update: jest.Mock }).update,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          is_enabled: false,
          is_verified: false,
        }),
      );
      expect(
        (queryBuilders["user_2fa_settings"] as { update: jest.Mock }).update,
      ).not.toHaveBeenCalledWith(expect.objectContaining({ totp_secret: "" }));
    });

    it("rejects a wrong password before the second factor is evaluated", async () => {
      queryBuilders["users"] = createMockQueryBuilder({ password_hash: passwordHash });
      mockBcrypt.compare.mockResolvedValue(false as never);

      await expect(
        twoFactorService.disableTwoFactor(userId, "wrong_password", "123456"),
      ).rejects.toMatchObject({
        code: "STEP_UP_FAILED",
        status: 401,
      });
      expect(mockAuthenticator.verify).not.toHaveBeenCalled();
    });

    it("rejects an invalid current factor after password verification", async () => {
      queryBuilders["users"] = createMockQueryBuilder({ password_hash: passwordHash });
      queryBuilders["user_2fa_settings"] = createMockQueryBuilder(enabledSettings);
      mockBcrypt.compare.mockResolvedValue(true as never);
      mockAuthenticator.verify.mockReturnValue(false);

      await expect(
        twoFactorService.disableTwoFactor(userId, password, "000000"),
      ).rejects.toMatchObject({
        code: "STEP_UP_FAILED",
        status: 401,
      });
    });

    it("low-level disable still rejects when 2FA is not enabled", async () => {
      queryBuilders["user_2fa_settings"] = createMockQueryBuilder(null);

      await expect(twoFactorService.disable2FA(userId)).rejects.toMatchObject({
        code: "2FA_NOT_ENABLED",
        status: 404,
      });
    });
  });

  describe("is2FAEnabled", () => {
    it("should return true when 2FA is enabled", async () => {
      const settings = {
        id: "settings-id",
        user_id: userId,
        totp_secret: "secret",
        is_enabled: true,
        is_verified: true,
        recovery_email: null,
        recovery_phone: null,
        enabled_at: new Date().toISOString(),
        last_used_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      queryBuilders["user_2fa_settings"] = createMockQueryBuilder(settings);
      (queryBuilders["user_2fa_settings"] as { first: jest.Mock }).first.mockResolvedValue(
        settings,
      );

      const result = await twoFactorService.is2FAEnabled(userId);

      expect(result).toBe(true);
    });

    it("should return false when 2FA is enabled but not verified", async () => {
      const settings = {
        id: "settings-id",
        user_id: userId,
        totp_secret: "secret",
        is_enabled: true,
        is_verified: false,
        recovery_email: null,
        recovery_phone: null,
        enabled_at: null,
        last_used_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      queryBuilders["user_2fa_settings"] = createMockQueryBuilder(settings);
      (queryBuilders["user_2fa_settings"] as { first: jest.Mock }).first.mockResolvedValue(
        settings,
      );

      expect(await twoFactorService.is2FAEnabled(userId)).toBe(false);
    });

    it("should return false when 2FA is not enabled", async () => {
      queryBuilders["user_2fa_settings"] = createMockQueryBuilder(null);
      (queryBuilders["user_2fa_settings"] as { first: jest.Mock }).first.mockResolvedValue(null);

      const result = await twoFactorService.is2FAEnabled(userId);

      expect(result).toBe(false);
    });
  });

  describe("generateBackupCodes", () => {
    it("should generate backup codes successfully", async () => {
      const batch = 1;

      mockBcrypt.hash.mockResolvedValue("hashed_code" as never);

      queryBuilders["backup_codes"] = createMockQueryBuilder();
      (queryBuilders["backup_codes"] as { del: jest.Mock }).del.mockResolvedValue(1);
      (queryBuilders["backup_codes"] as { insert: jest.Mock }).insert.mockResolvedValue([1]);

      queryBuilders["audit_log"] = createMockQueryBuilder();
      (queryBuilders["audit_log"] as { insert: jest.Mock }).insert.mockResolvedValue([1]);

      const result = await twoFactorService.generateBackupCodes(userId, batch);

      expect(result).toHaveLength(10);
      expect(mockBcrypt.hash).toHaveBeenCalledTimes(10);
      expect((queryBuilders["backup_codes"] as { insert: jest.Mock }).insert).toHaveBeenCalledTimes(
        10,
      );
    });
  });

  describe("getRemainingBackupCodesCount", () => {
    it("should return count of unused backup codes", async () => {
      queryBuilders["backup_codes"] = createMockQueryBuilder();
      (queryBuilders["backup_codes"] as { count: jest.Mock }).count.mockReturnThis();
      (queryBuilders["backup_codes"] as { first: jest.Mock }).first.mockResolvedValue({
        count: "5",
      });

      const result = await twoFactorService.getRemainingBackupCodesCount(userId);

      expect(result).toBe(5);
    });

    it("should return 0 when no backup codes exist", async () => {
      queryBuilders["backup_codes"] = createMockQueryBuilder();
      (queryBuilders["backup_codes"] as { count: jest.Mock }).count.mockReturnThis();
      (queryBuilders["backup_codes"] as { first: jest.Mock }).first.mockResolvedValue({
        count: "0",
      });

      const result = await twoFactorService.getRemainingBackupCodesCount(userId);

      expect(result).toBe(0);
    });
  });
});
