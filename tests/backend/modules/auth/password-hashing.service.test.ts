import bcrypt from "bcryptjs";
import {
  hashPassword, verifyPasswordHash, isLegacyBcryptHash,
} from "../../../../apps/backend/src/modules/auth/password-hashing.service.js";

// Test ownership: #557 Stage B hashing migration.
describe("Argon2id password hashing and legacy compatibility (#557)", () => {
  jest.setTimeout(60_000);

  it("hashes new passwords with unique 64MiB, 3-pass Argon2id salts", async () => {
    const password = "unusually long passphrase for test only";
    const a = await hashPassword(password);
    const b = await hashPassword(password);
    expect(a).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=1\$/);
    expect(a).not.toBe(b);
    expect(await verifyPasswordHash(password, a)).toBe(true);
    expect(await verifyPasswordHash(password + "x", a)).toBe(false);
    expect(await verifyPasswordHash(password, b)).toBe(true);
  });

  it("verifies existing bcrypt hashes and rejects invalid PHC data", async () => {
    const original = await bcrypt.hash("old password", 10);
    expect(isLegacyBcryptHash(original)).toBe(true);
    expect(await verifyPasswordHash("old password", original)).toBe(true);
    expect(await verifyPasswordHash("wrong", original)).toBe(false);
    expect(await verifyPasswordHash("old password", "$argon2id$v=19$m=2147483647,t=9999,p=99$AA$AA")).toBe(false);
    expect(await verifyPasswordHash("old password", "unknown-hash")).toBe(false);
  });
});
