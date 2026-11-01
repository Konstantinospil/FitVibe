import {
  assertPasswordPolicy,
  passwordMinimumForRole,
} from "../../../../apps/backend/src/modules/auth/passwordPolicy.js";
import { HttpError } from "../../../../apps/backend/src/utils/http.js";

describe("password policy (#557 Stage B)", () => {
  it("accepts long passphrases without arbitrary character-class requirements", () => {
    for (const password of ["all lowercase passphrase", "UPPERCASE WORDS ONLY", "123456789012"]) {
      expect(() => assertPasswordPolicy(password)).not.toThrow();
    }
  });

  it("enforces the member and administrator length minima", () => {
    expect(passwordMinimumForRole("athlete")).toBe(12);
    expect(passwordMinimumForRole("admin")).toBe(16);
    expect(passwordMinimumForRole("superadmin")).toBe(16);
    expect(() => assertPasswordPolicy("short", { role: "admin" })).toThrow(HttpError);
    expect(() => assertPasswordPolicy("123456789012", { role: "admin" })).toThrow("WEAK_PASSWORD");
    expect(() => assertPasswordPolicy("1234567890123456", { role: "admin" })).not.toThrow();
    expect(() => assertPasswordPolicy("a".repeat(129))).toThrow("WEAK_PASSWORD");
  });

  it("rejects passwords containing the account alias or email identifier", () => {
    expect(() => assertPasswordPolicy("myusername is private", { username: "myusername" }))
      .toThrow("PASSWORD_CONTAINS_USERNAME");
    expect(() => assertPasswordPolicy("myname in passphrase", { email: "myname@example.org" }))
      .toThrow("PASSWORD_CONTAINS_EMAIL");
  });

  it("does not reject otherwise valid, diverse unicode passphrases", () => {
    expect(() => assertPasswordPolicy("παράδειγμα ισχυρής φράσης")).not.toThrow();
  });
});
