import * as policy from "../../../../apps/backend/src/modules/auth/auth.login-attempt.service.js";
import * as bruteForce from "../../../../apps/backend/src/modules/auth/bruteforce.repository.js";
import * as audit from "../../../../apps/backend/src/modules/auth/auth.audit.js";
import { db } from "../../../../apps/backend/src/db/index.js";

jest.mock("../../../../apps/backend/src/modules/auth/bruteforce.repository.js");
jest.mock("../../../../apps/backend/src/modules/auth/auth.audit.js");
jest.mock("../../../../apps/backend/src/db/index.js", () => {
  const mockDb = { transaction: jest.fn() };
  return { __esModule: true, default: mockDb, db: mockDb };
});

const mockBruteForce = jest.mocked(bruteForce);
const mockAudit = jest.mocked(audit);
const mockDb = db as unknown as { transaction: jest.Mock };

describe("auth.login-attempt.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBruteForce.isIPLocked.mockReturnValue(false);
    mockBruteForce.isAccountLocked.mockReturnValue(false);
    mockBruteForce.getMaxIPAttempts.mockReturnValue(20);
    mockBruteForce.getMaxIPDistinctEmails.mockReturnValue(10);
    mockBruteForce.getMaxAccountAttempts.mockReturnValue(5);
  });

  it("rejects a pre-existing IP lock and records the security audit", async () => {
    const ipAttempt = {
      total_attempt_count: 20,
      distinct_email_count: 8,
    } as never;
    mockBruteForce.getFailedAttemptByIP.mockResolvedValue(ipAttempt);
    mockBruteForce.isIPLocked.mockReturnValue(true);
    mockBruteForce.getRemainingIPLockoutSeconds.mockReturnValue(90);

    await expect(
      policy.assertLoginAllowed("user@example.com", "203.0.113.5", "req-1"),
    ).resolves.toBe(false);

    expect(mockAudit.recordAuthAuditEvent).toHaveBeenCalledWith(
      null,
      "auth.login_blocked_ip",
      expect.objectContaining({ ip: "203.0.113.5", requestId: "req-1" }),
    );
  });

  it("records account and IP failures atomically without disclosing counters", async () => {
    const account = { attempt_count: 3, locked_until: null } as never;
    const ip = { total_attempt_count: 3, distinct_email_count: 1 } as never;
    mockDb.transaction.mockImplementation(async (callback) =>
      callback({} as never),
    );
    mockBruteForce.recordFailedAttempt.mockResolvedValue(account);
    mockBruteForce.recordFailedAttemptByIP.mockResolvedValue(ip);
    await expect(
      policy.recordLoginFailure({
        identifier: "user@example.com",
        ipAddress: "203.0.113.5",
        userAgent: "agent",
        actorUserId: "11111111-1111-4111-8111-111111111111",
        requestId: "req-2",
      }),
    ).resolves.toBeUndefined();

    expect(mockBruteForce.lockLoginAttemptIp).toHaveBeenCalled();
    expect(mockBruteForce.recordFailedAttempt).toHaveBeenCalled();
    expect(mockBruteForce.recordFailedAttemptByIP).toHaveBeenCalled();
    expect(mockAudit.recordAuthAuditEvent).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "auth.login_failed",
      expect.objectContaining({ attemptCount: 3, requestId: "req-2" }),
    );
  });
});
