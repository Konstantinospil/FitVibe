/**
 * Email-first registration service (ADR-039), with storage, queue and mail
 * mocked. Real PostgreSQL behaviour is covered by
 * tests/backend/integration/email-first-registration.integration.test.ts.
 */
import crypto from "crypto";
import * as registration from "../../../../apps/backend/src/modules/auth/auth.registration.service.js";
import * as authRepository from "../../../../apps/backend/src/modules/auth/auth.repository.js";
import * as intentRepository from "../../../../apps/backend/src/modules/auth/auth.registration-intent.repository.js";
import { queueService } from "../../../../apps/backend/src/jobs/services/queue.factory.js";
import { mailerService } from "../../../../apps/backend/src/services/mailer.service.js";
import { isEmailBlacklisted } from "../../../../apps/backend/src/modules/common/email-blacklist.repository.js";
import { acceptLegalDocumentVersion } from "../../../../apps/backend/src/modules/legal/legal.service.js";
import type { AuthUserRecord } from "../../../../apps/backend/src/modules/auth/auth.repository.js";
import type { RegistrationIntentRecord } from "../../../../apps/backend/src/modules/auth/auth.registration-intent.repository.js";

jest.mock("../../../../apps/backend/src/modules/auth/auth.repository.js");
jest.mock("../../../../apps/backend/src/modules/auth/auth.registration-intent.repository.js");
jest.mock("../../../../apps/backend/src/jobs/services/queue.factory.js", () => ({
  queueService: { enqueue: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock("../../../../apps/backend/src/services/mailer.service.js", () => ({
  mailerService: { send: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock("../../../../apps/backend/src/modules/common/email-blacklist.repository.js", () => ({
  isEmailBlacklisted: jest.fn().mockResolvedValue(false),
}));
jest.mock("../../../../apps/backend/src/modules/legal/legal.service.js", () => ({
  getCurrentLegalPublication: jest.fn().mockResolvedValue({ id: "terms-1", version: "1.0.0" }),
  acceptLegalDocumentVersion: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../../../apps/backend/src/modules/auth/auth.registration-options.service.js", () => ({
  assertRegistrationReferenceValues: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../../../apps/backend/src/modules/auth/password-hashing.service.js", () => ({
  hashPassword: jest.fn().mockResolvedValue("argon2-hash"),
}));
jest.mock("../../../../apps/backend/src/modules/auth/timing.utils.js", () => ({
  normalizeAuthTiming: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../../../apps/backend/src/modules/system/app-settings.runtime.js", () => ({
  getRuntimeAppSetting: jest.fn(() => 15),
}));
jest.mock("../../../../apps/backend/src/config/env.js", () => ({
  env: {
    email: { enabled: false, captureEnabled: false },
    frontendUrl: "https://app.fitvibe.test",
    isProduction: false,
  },
}));
const trx = { isTransaction: true };
jest.mock("../../../../apps/backend/src/db/connection.js", () => ({
  db: { transaction: jest.fn(async (work: (t: unknown) => Promise<unknown>) => work(trx)) },
}));

const repo = jest.mocked(authRepository);
const intents = jest.mocked(intentRepository);
const enqueue = jest.mocked(queueService.enqueue);
const send = jest.mocked(mailerService.send);
const blacklisted = jest.mocked(isEmailBlacklisted);

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
const LINK = "L".repeat(43);

function account(overrides: Partial<AuthUserRecord>): AuthUserRecord {
  return {
    id: "user-1",
    username: "owner",
    display_name: "Owner",
    locale: "de-DE",
    preferred_lang: "de",
    primary_email: "owner@example.com",
    email_verified: true,
    role_code: "athlete",
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    password_hash: "hash",
    terms_accepted: true,
    terms_accepted_at: "2026-01-01T00:00:00Z",
    terms_version: "1.0.0",
    ...overrides,
  } as AuthUserRecord;
}

function intent(overrides: Partial<RegistrationIntentRecord> = {}): RegistrationIntentRecord {
  return {
    id: "intent-1",
    email_hash: sha256("new@example.com"),
    email: "new@example.com",
    token_hash: sha256(LINK),
    locale: "en",
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    consumed_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  intents.countRegistrationIntentsSince.mockResolvedValue(0);
  intents.insertRegistrationIntent.mockResolvedValue(undefined);
  intents.consumeOpenRegistrationLinks.mockResolvedValue(0);
  intents.consumeRegistrationIntent.mockResolvedValue(1);
  repo.findUserByEmail.mockResolvedValue(undefined);
  repo.findUserByUsername.mockResolvedValue(undefined);
  blacklisted.mockResolvedValue(false);
});

describe("startRegistration", () => {
  it("queues a sensitive job and reads no account data", async () => {
    await registration.startRegistration({ email: "  New@Example.com ", locale: "fr" });

    expect(enqueue).toHaveBeenCalledWith({
      name: registration.REGISTRATION_DISPATCH_JOB,
      payload: { email: "new@example.com", locale: "fr" },
      sensitive: true,
    });
    expect(repo.findUserByEmail).not.toHaveBeenCalled();
    expect(blacklisted).not.toHaveBeenCalled();
    expect(intents.countRegistrationIntentsSince).not.toHaveBeenCalled();
  });
});

describe("dispatchRegistrationRequest", () => {
  it("sends a new address a continue link whose hash is the stored token hash", async () => {
    await expect(
      registration.dispatchRegistrationRequest({ email: "new@example.com", locale: "en" }),
    ).resolves.toBe("continue_link");

    expect(intents.consumeOpenRegistrationLinks).toHaveBeenCalledWith(
      sha256("new@example.com"),
      expect.any(Date),
    );
    const [[row]] = intents.insertRegistrationIntent.mock.calls;
    expect(row).toMatchObject({ email: "new@example.com", email_hash: sha256("new@example.com") });

    const [[mail]] = send.mock.calls;
    expect(mail.subject).toBe("Finish creating your FitVibe account");
    const token = /register\/complete\?token=([A-Za-z0-9_-]+)/.exec(mail.text ?? "")?.[1];
    expect(token).toBeDefined();
    expect(row.token_hash).toBe(sha256(token as string));
    expect(new Date(row.expires_at).getTime() - new Date(row.created_at).getTime()).toBe(
      15 * 60 * 1000,
    );
  });

  it("tells an active owner they already have an account, in their language", async () => {
    repo.findUserByEmail.mockResolvedValue(account({ status: "active", locale: "de-DE" }));

    await expect(
      registration.dispatchRegistrationRequest({ email: "owner@example.com", locale: "en" }),
    ).resolves.toBe("existing_account_notice");

    const [[row]] = intents.insertRegistrationIntent.mock.calls;
    expect(row.email).toBeUndefined();
    expect(row.token_hash).toBeUndefined();
    const [[mail]] = send.mock.calls;
    expect(mail).toMatchObject({
      to: "owner@example.com",
      subject: "Jemand hat versucht, sich mit Ihrer FitVibe-E-Mail-Adresse zu registrieren",
    });
    expect(mail.text).toContain("https://app.fitvibe.test/forgot-password");
  });

  it("sends an administrator-created pending account its verification link", async () => {
    repo.findUserByEmail.mockResolvedValue(account({ status: "pending_verification" }));
    repo.countAuthTokensSince.mockResolvedValue(0);

    await expect(
      registration.dispatchRegistrationRequest({ email: "owner@example.com" }),
    ).resolves.toBe("pending_verification_link");
    expect(send.mock.calls[0][0].text).toContain("/verify?token=");
  });

  it("stays silent when a pending account has hit its verification cap", async () => {
    repo.findUserByEmail.mockResolvedValue(account({ status: "pending_verification" }));
    repo.countAuthTokensSince.mockResolvedValue(3);

    await expect(
      registration.dispatchRegistrationRequest({ email: "owner@example.com" }),
    ).resolves.toBe("no_email");
    expect(send).not.toHaveBeenCalled();
  });

  it.each(["suspended", "banned", "pending_deletion"])(
    "sends nothing when the account is %s, but still counts the request",
    async (status) => {
      repo.findUserByEmail.mockResolvedValue(account({ status: status as "active" }));

      await expect(
        registration.dispatchRegistrationRequest({ email: "owner@example.com" }),
      ).resolves.toBe("no_email");
      expect(send).not.toHaveBeenCalled();
      expect(intents.insertRegistrationIntent).toHaveBeenCalledTimes(1);
    },
  );

  it("sends nothing to a blocked address, but still counts the request", async () => {
    blacklisted.mockResolvedValue(true);

    await expect(
      registration.dispatchRegistrationRequest({ email: "blocked@example.com" }),
    ).resolves.toBe("no_email");
    expect(repo.findUserByEmail).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(intents.insertRegistrationIntent).toHaveBeenCalledTimes(1);
  });

  it("drops requests over the per-address limit before looking anything up", async () => {
    intents.countRegistrationIntentsSince.mockResolvedValue(
      registration.REGISTRATION_REQUESTS_PER_WINDOW,
    );

    await expect(
      registration.dispatchRegistrationRequest({ email: "new@example.com" }),
    ).resolves.toBe("throttled");
    expect(blacklisted).not.toHaveBeenCalled();
    expect(repo.findUserByEmail).not.toHaveBeenCalled();
    expect(intents.insertRegistrationIntent).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects a malformed payload", async () => {
    await expect(registration.dispatchRegistrationRequest({ email: 42 })).rejects.toThrow(
      "Invalid registration dispatch payload",
    );
  });
});

describe("getRegistrationIntent", () => {
  it("returns the address for a valid link", async () => {
    intents.findOpenRegistrationIntent.mockResolvedValue(intent());

    await expect(registration.getRegistrationIntent(LINK)).resolves.toMatchObject({
      email: "new@example.com",
    });
    expect(intents.findOpenRegistrationIntent).toHaveBeenCalledWith(sha256(LINK));
  });

  it("rejects unknown, used and expired links", async () => {
    intents.findOpenRegistrationIntent.mockResolvedValue(undefined);
    await expect(registration.getRegistrationIntent(LINK)).rejects.toMatchObject({
      status: 400,
      code: "AUTH_INVALID_TOKEN",
    });

    intents.findOpenRegistrationIntent.mockResolvedValue(
      intent({ expires_at: new Date(Date.now() - 1000).toISOString() }),
    );
    await expect(registration.getRegistrationIntent(LINK)).rejects.toMatchObject({
      status: 410,
      code: "AUTH_TOKEN_EXPIRED",
    });
  });
});

describe("completeRegistration", () => {
  const dto = {
    token: LINK,
    username: "new-athlete",
    password: "an original long passphrase for registration",
    terms_accepted: true,
  };

  beforeEach(() => {
    intents.findOpenRegistrationIntent.mockResolvedValue(intent());
    repo.createUser.mockResolvedValue(undefined);
    repo.findUserById.mockResolvedValue(
      account({ id: "new-id", username: "new-athlete", primary_email: "new@example.com" }),
    );
  });

  it("creates an active, verified account and consumes the link in one transaction", async () => {
    const result = await registration.completeRegistration(dto);

    expect(repo.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        alias: "new-athlete",
        primaryEmail: "new@example.com",
        status: "active",
        emailVerified: true,
        terms_accepted: true,
      }),
      trx,
    );
    expect(intents.findOpenRegistrationIntent).toHaveBeenLastCalledWith(sha256(LINK), trx, {
      forUpdate: true,
    });
    expect(jest.mocked(acceptLegalDocumentVersion)).toHaveBeenCalledWith(
      expect.any(String),
      "terms-1",
      "registration",
      trx,
    );
    expect(intents.consumeRegistrationIntent).toHaveBeenCalledWith("intent-1", trx);
    expect(result.user).toMatchObject({ username: "new-athlete" });
  });

  it("reports a taken username without creating anything or using up the link", async () => {
    repo.findUserByUsername.mockResolvedValue(account({}));

    await expect(registration.completeRegistration(dto)).rejects.toMatchObject({
      status: 409,
      code: "USER_USERNAME_TAKEN",
    });
    expect(repo.createUser).not.toHaveBeenCalled();
    expect(intents.consumeRegistrationIntent).not.toHaveBeenCalled();
  });

  it("rejects a link that another submission consumed first", async () => {
    intents.findOpenRegistrationIntent
      .mockResolvedValueOnce(intent())
      .mockResolvedValueOnce(undefined);

    await expect(registration.completeRegistration(dto)).rejects.toMatchObject({
      status: 400,
      code: "AUTH_INVALID_TOKEN",
    });
    expect(repo.createUser).not.toHaveBeenCalled();
  });

  it("maps unique violations to explicit errors for the link holder", async () => {
    repo.createUser.mockRejectedValueOnce(
      Object.assign(new Error("duplicate"), { code: "23505", constraint: "profiles_alias_unique" }),
    );
    await expect(registration.completeRegistration(dto)).rejects.toMatchObject({
      code: "USER_USERNAME_TAKEN",
    });

    repo.createUser.mockRejectedValueOnce(
      Object.assign(new Error("duplicate"), {
        code: "23505",
        constraint: "idx_user_contacts_email_value",
      }),
    );
    await expect(registration.completeRegistration(dto)).rejects.toMatchObject({
      status: 409,
      code: "AUTH_EMAIL_ALREADY_REGISTERED",
    });

    const unrelated = Object.assign(new Error("duplicate"), { code: "23505", constraint: "x" });
    repo.createUser.mockRejectedValueOnce(unrelated);
    await expect(registration.completeRegistration(dto)).rejects.toBe(unrelated);
  });

  it("refuses a link for an address that has since been blocked", async () => {
    blacklisted.mockResolvedValue(true);

    await expect(registration.completeRegistration(dto)).rejects.toMatchObject({
      code: "AUTH_INVALID_TOKEN",
    });
    expect(intents.consumeRegistrationIntent).toHaveBeenCalledWith("intent-1");
    expect(repo.createUser).not.toHaveBeenCalled();
  });

  it("requires accepted terms", async () => {
    await expect(
      registration.completeRegistration({ ...dto, terms_accepted: false }),
    ).rejects.toMatchObject({ status: 400, code: "TERMS_ACCEPTANCE_REQUIRED" });
    expect(repo.createUser).not.toHaveBeenCalled();
  });
});
