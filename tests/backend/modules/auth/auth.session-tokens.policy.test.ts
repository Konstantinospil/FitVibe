import jwt from "jsonwebtoken";
import { env, RSA_KEYS } from "../../../../apps/backend/src/config/env.js";
import {
  accessTokenTtlForRole,
  signAccess,
  verifyAccess,
} from "../../../../apps/backend/src/modules/auth/auth.session-tokens.js";

// Test ownership: #557; backend-jest; privileged access-token policy.
describe("role-specific access-token lifetime (#557)", () => {
  const memberTtl = env.ACCESS_TOKEN_TTL;
  const privilegedTtl = Math.max(1, Math.min(300, Math.floor(memberTtl / 2)));

  it.each(["athlete", "member"])("keeps %s at the configured member TTL", (role) => {
    expect(accessTokenTtlForRole(role)).toBe(memberTtl);
  });

  it.each(["admin", "superadmin"])("caps %s below the member TTL", (role) => {
    expect(accessTokenTtlForRole(role)).toBe(privilegedTtl);
    expect(accessTokenTtlForRole(role)).toBeLessThan(memberTtl);
    expect(accessTokenTtlForRole(role)).toBeLessThanOrEqual(300);
  });

  it.each(["athlete", "admin", "superadmin"])("signs %s JWTs with the corresponding expiry", (role) => {
    const token = signAccess({ sub: "user-1", sid: "session-1", role, mfa: role !== "athlete" });
    const verified = verifyAccess(token);
    expect(verified.role).toBe(role);
    expect(verified.exp! - verified.iat!).toBe(accessTokenTtlForRole(role));
    expect(jwt.verify(token, RSA_KEYS.publicKey, { algorithms: ["RS256"] })).toMatchObject({
      sub: "user-1", sid: "session-1", role,
    });
  });
});
