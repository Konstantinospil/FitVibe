import { expect } from "@jest/globals";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import request from "supertest";
import type { Express } from "express";
import { createUser } from "../../../apps/backend/src/modules/auth/auth.repository.js";
import { getCurrentTermsVersion } from "../../../apps/backend/src/config/terms.js";
import { getTestValidPassword } from "./test-passwords.js";

export interface SignedInAthlete {
  userId: string;
  token: string;
  /** `Authorization` header value for supertest's `.set()`. */
  bearer: string;
}

/**
 * Creates an active, verified athlete and signs in through the real login API.
 * Integration suites call this after `truncateAll()` and `ensureRolesSeeded()`.
 */
export async function signInNewAthlete(app: Express, prefix: string): Promise<SignedInAthlete> {
  const password = getTestValidPassword();
  const userId = uuidv4();
  const email = `${prefix}-${userId}@example.com`;
  await createUser({
    id: userId,
    username: `${prefix}-${userId.slice(0, 8)}`,
    display_name: "Planner Test",
    password_hash: await bcrypt.hash(password, 10),
    primaryEmail: email,
    emailVerified: true,
    role_code: "athlete",
    status: "active",
    terms_accepted: true,
    terms_accepted_at: new Date().toISOString(),
    terms_version: getCurrentTermsVersion(),
  });
  const login = await request(app).post("/api/v1/auth/login").send({ email, password });
  expect(login.status).toBe(200);
  const token = login.body.tokens.accessToken as string;
  return { userId, token, bearer: `Bearer ${token}` };
}
