import { argon2, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

/**
 * Stage B (#557). Node >=24.7 supplies Argon2id without a native third-party
 * module; verify this on both amd64 and arm64 release images.
 *
 * PHC encoding is self-describing and versioned. Legacy bcrypt hashes remain
 * readable until all active accounts have migrated.
 */
const MEMORY_KIB = 64 * 1024;
const PASSES = 3;
const PARALLELISM = 1;
const TAG_LENGTH = 32;
const SALT_LENGTH = 16;
const PHC = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;
const BCRYPT = /^\$2[aby]\$\d{2}\$/;

type Argon2Params = {
  message: string | Buffer;
  nonce: Buffer;
  parallelism: number;
  tagLength: number;
  memory: number;
  passes: number;
};

function derive(password: string, salt: Buffer, memory: number, passes: number, parallelism: number, length: number): Promise<Buffer> {
  const params: Argon2Params = { message: password, nonce: salt, memory, passes, parallelism, tagLength: length };
  return new Promise<Buffer>((resolve, reject) => {
    argon2("argon2id", params, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

function b64(bytes: Buffer): string {
  return bytes.toString("base64").replace(/=+$/u, "");
}

export function isLegacyBcryptHash(hash: string): boolean {
  return BCRYPT.test(hash);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const tag = await derive(password, salt, MEMORY_KIB, PASSES, PARALLELISM, TAG_LENGTH);
  return `$argon2id$v=19$m=${MEMORY_KIB},t=${PASSES},p=${PARALLELISM}$${b64(salt)}$${b64(tag)}`;
}

export async function verifyPasswordHash(password: string, hash: string): Promise<boolean> {
  if (isLegacyBcryptHash(hash)) return bcrypt.compare(password, hash);
  const match = PHC.exec(hash);
  if (!match) return false;
  const [, memoryString, passesString, parallelismString, salt64, tag64] = match;
  const memory = Number(memoryString), passes = Number(passesString), parallelism = Number(parallelismString);
  // Bound resource costs before performing expensive work on persisted hashes.
  if (memory !== MEMORY_KIB || passes !== PASSES || parallelism !== PARALLELISM) return false;
  const salt = Buffer.from(salt64, "base64");
  const tag = Buffer.from(tag64, "base64");
  if (salt.length !== SALT_LENGTH || tag.length !== TAG_LENGTH || b64(salt) !== salt64 || b64(tag) !== tag64) return false;
  const calculated = await derive(password, salt, memory, passes, parallelism, tag.length);
  return timingSafeEqual(calculated, tag);
}
