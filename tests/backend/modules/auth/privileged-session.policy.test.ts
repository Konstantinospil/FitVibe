import {
  ADMIN_SESSION_IDLE_MS,
  ADMIN_SESSION_MAX_AGE_MS,
  isPrivilegedRole,
  isPrivilegedSessionActive,
  privilegedSessionDeadline,
} from "../../../../apps/backend/src/modules/auth/privileged-session.policy.js";
import { refreshTokenTtlForRole, nextSessionExpiry, signRefresh, verifyRefresh } from "../../../../apps/backend/src/modules/auth/auth.session-tokens.js";
import { env } from "../../../../apps/backend/src/config/env.js";

// Test ownership: #557, Stage C. These tests assert the actual signed TTL,
// absolute expiry and idle deadlines without weakening pre-existing tests.
describe("privileged session security policy (#557)", () => {
  const created = new Date("2026-10-31T12:00:00.000Z");
  const at = (delta: number) => new Date(created.getTime() + delta).toISOString();

  it.each(["admin", "superadmin"])("limits %s refresh JWT lifetime", (role) => {
    expect(isPrivilegedRole(role)).toBe(true);
    const token = signRefresh({ sub: "user-1", sid: "session-1", mfa: true, role });
    const decoded = verifyRefresh(token);
    expect(decoded.exp! - decoded.iat!).toBe(refreshTokenTtlForRole(role));
    expect(decoded.exp! - decoded.iat!).toBeLessThanOrEqual(8 * 60 * 60);
    expect(decoded.exp! - decoded.iat!).toBeLessThanOrEqual(env.REFRESH_TOKEN_TTL);
  });

  it("retains the member refresh TTL", () => {
    expect(isPrivilegedRole("athlete")).toBe(false);
    expect(refreshTokenTtlForRole("athlete")).toBe(env.REFRESH_TOKEN_TTL);
  });

  it("rejects idle expiry at the boundary, even with a valid absolute lifetime", () => {
    const session = { created_at: created.toISOString(), last_active_at: at(60_000) };
    expect(isPrivilegedSessionActive(session, created.getTime() + 60_000 + ADMIN_SESSION_IDLE_MS - 1)).toBe(true);
    expect(isPrivilegedSessionActive(session, created.getTime() + 60_000 + ADMIN_SESSION_IDLE_MS)).toBe(false);
  });

  it("does not grant a new activity window to legacy sessions with null last_active_at", () => {
    const session = { created_at: created.toISOString(), last_active_at: null };
    expect(isPrivilegedSessionActive(session, created.getTime() + ADMIN_SESSION_IDLE_MS)).toBe(false);
  });

  it("rejects absolute expiry despite recent activity", () => {
    const session = { created_at: created.toISOString(), last_active_at: at(ADMIN_SESSION_MAX_AGE_MS - 1000) };
    expect(privilegedSessionDeadline(session)).toBe(created.getTime() + ADMIN_SESSION_MAX_AGE_MS);
    expect(isPrivilegedSessionActive(session, created.getTime() + ADMIN_SESSION_MAX_AGE_MS)).toBe(false);
  });

  it("rejects malformed persisted timestamps fail closed", () => {
    expect(isPrivilegedSessionActive({ created_at: "invalid", last_active_at: null })).toBe(false);
    expect(isPrivilegedSessionActive({ created_at: created.toISOString(), last_active_at: "invalid" })).toBe(false);
  });

  it("caps refresh extension to original session creation for administrators", () => {
    const originalCreated = Date.now() - ADMIN_SESSION_MAX_AGE_MS + 60_000;
    const deadline = new Date(nextSessionExpiry("admin", originalCreated)).getTime();
    expect(deadline).toBe(originalCreated + ADMIN_SESSION_MAX_AGE_MS);
  });
});
