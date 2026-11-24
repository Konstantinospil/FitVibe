/**
 * Integration test for the backend endpoints the backoffice calls (#649):
 * ops status, public system config and the user admin actions, against a real database.
 */

import { describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import bcrypt from "bcryptjs";
import { authenticator } from "@otplib/preset-default";
import { v4 as uuidv4 } from "uuid";
import app from "../../../apps/backend/src/app.js";
import db from "../../../apps/backend/src/db/index.js";
import { createUser } from "../../../apps/backend/src/modules/auth/auth.repository.js";
import { getCurrentTermsVersion } from "../../../apps/backend/src/config/terms.js";
import {
  truncateAll,
  ensureRolesSeeded,
  ensureUsernameColumnExists,
  withDatabaseErrorHandling,
} from "../../setup/test-helpers.js";
import { describeWithTestDatabase } from "../../setup/db-availability.js";

const PASSWORD = "SecureP@ssw0rd123!";
const NEXT_PASSWORD = "Moonlit Cedar River Lantern 2026!";

/** A distinct single-use code inside the accepted ±1 step window. */
function totpAt(secret: string, stepOffset: -1 | 0 | 1): string {
  return authenticator.clone({ epoch: Date.now() + stepOffset * 30_000 }).generate(secret);
}

async function createActiveUser(roleCode: string, alias: string, displayName: string) {
  const id = uuidv4();
  await createUser({
    id,
    username: alias,
    display_name: displayName,
    status: "active",
    role_code: roleCode,
    password_hash: await bcrypt.hash(PASSWORD, 12),
    primaryEmail: `${alias}@example.com`,
    emailVerified: true,
    terms_accepted: true,
    terms_accepted_at: new Date().toISOString(),
    terms_version: getCurrentTermsVersion(),
  });
  return id;
}

/** Admin with verified MFA and a post-MFA password change, as the admin routes require. */
async function loginAdminWithMfa(email: string): Promise<{ token: string; secret: string }> {
  const firstLogin = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password: PASSWORD });
  const passwordOnlyToken: string = firstLogin.body.tokens?.accessToken ?? "";
  const setup = await request(app)
    .get("/api/v1/auth/2fa/setup")
    .set("Authorization", `Bearer ${passwordOnlyToken}`);
  const secret: string = setup.body.secret;
  await request(app)
    .post("/api/v1/auth/2fa/verify")
    .set("Authorization", `Bearer ${passwordOnlyToken}`)
    .send({ code: authenticator.generate(secret) });

  const mfaLogin = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password: PASSWORD });
  const verified = await request(app)
    .post("/api/v1/auth/login/verify-2fa")
    .send({
      pendingSessionId: mfaLogin.body.pendingSessionId,
      code: authenticator.generate(secret),
    });
  await request(app)
    .post("/api/v1/users/change-password")
    .set("Authorization", `Bearer ${verified.body.tokens?.accessToken}`)
    .send({ currentPassword: PASSWORD, newPassword: NEXT_PASSWORD });

  const finalLogin = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password: NEXT_PASSWORD });
  const finalVerified = await request(app)
    .post("/api/v1/auth/login/verify-2fa")
    .send({
      pendingSessionId: finalLogin.body.pendingSessionId,
      code: authenticator.generate(secret),
    });
  expect(finalVerified.status).toBe(200);
  return { token: finalVerified.body.tokens.accessToken as string, secret };
}

describeWithTestDatabase("Integration: backoffice admin endpoints (#649)", () => {
  jest.setTimeout(90000);

  let adminToken: string;
  let adminSecret: string;
  let athleteId: string;
  let coAdminId: string;

  beforeAll(async () => {
    await ensureUsernameColumnExists();
  });

  beforeEach(async () => {
    await withDatabaseErrorHandling(async () => {
      const { env } = await import("../../../apps/backend/src/config/env.js");
      (env as { readOnlyMode: boolean }).readOnlyMode = false;
      await truncateAll();
      await ensureRolesSeeded();

      await createActiveUser("admin", "opsadmin", "Ops Admin");
      coAdminId = await createActiveUser("admin", "coadmin", "Co Admin");
      athleteId = await createActiveUser("athlete", "runner", "Rude Name");
      ({ token: adminToken, secret: adminSecret } =
        await loginAdminWithMfa("opsadmin@example.com"));
    });
  });

  const asAdmin = (req: request.Test) => req.set("Authorization", `Bearer ${adminToken}`);

  it("serves the ops status with real counts", async () => {
    const response = await asAdmin(request(app).get("/api/v1/admin/ops/status"));

    expect(response.status).toBe(200);
    expect(response.body.backend).toEqual(
      expect.objectContaining({ dbOk: true, readOnly: expect.any(Boolean) }),
    );
    expect(response.body.counts.loggedInUsers).toBeGreaterThanOrEqual(1);
    expect(response.body.counts.openIssues).toBe(
      response.body.counts.unresolvedMessages +
        response.body.counts.violationReports +
        response.body.counts.unresolvedAuditLogs,
    );
  });

  it("refuses the ops status to non-admins", async () => {
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "runner@example.com", password: PASSWORD });
    const response = await request(app)
      .get("/api/v1/admin/ops/status")
      .set("Authorization", `Bearer ${login.body.tokens?.accessToken}`);
    expect(response.status).toBe(403);
  });

  it("serves the public system config", async () => {
    const response = await request(app).get("/api/v1/system/config");
    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        readOnlyMode: expect.any(Boolean),
        maintenanceMode: expect.any(Boolean),
        features: {},
      }),
    );
  });

  it("changes roles and moderates profiles with fresh single-use TOTPs", async () => {
    const withoutTotp = await asAdmin(
      request(app).post(`/api/v1/admin/users/${athleteId}/role`).send({ role: "coach" }),
    );
    expect(withoutTotp.status).toBe(403);

    const escalation = await asAdmin(
      request(app)
        .post(`/api/v1/admin/users/${athleteId}/role`)
        .send({ role: "admin", totpCode: totpAt(adminSecret, 0) }),
    );
    expect(escalation.status).toBe(400);

    const roleChange = await asAdmin(
      request(app)
        .post(`/api/v1/admin/users/${athleteId}/role`)
        .send({ role: "coach", reason: "certified", totpCode: totpAt(adminSecret, -1) }),
    );
    expect(roleChange.status).toBe(200);
    expect((await db("users").where({ id: athleteId }).first()).role_code).toBe("coach");

    const nameReset = await asAdmin(
      request(app)
        .delete(`/api/v1/admin/users/${athleteId}/display-name`)
        .send({ reason: "offensive", totpCode: totpAt(adminSecret, 0) }),
    );
    expect(nameReset.status).toBe(200);
    expect((await db("users").where({ id: athleteId }).first()).display_name).toBe("runner");

    const noAvatar = await asAdmin(
      request(app)
        .delete(`/api/v1/admin/users/${athleteId}/avatar`)
        .send({ totpCode: totpAt(adminSecret, 1) }),
    );
    expect(noAvatar.status).toBe(404);

    const audit = await db("audit_log")
      .whereIn("action", ["user_role_changed", "admin_deleted_display_name"])
      .andWhere({ entity_id: athleteId })
      .select("action");
    expect(audit.map((row: { action: string }) => row.action).sort()).toEqual([
      "admin_deleted_display_name",
      "user_role_changed",
    ]);
  });

  it("sends reset emails to active users and refuses administrators as targets", async () => {
    const reset = await asAdmin(
      request(app).post(`/api/v1/admin/users/${athleteId}/send-password-reset`),
    );
    expect(reset.status).toBe(200);

    const verification = await asAdmin(
      request(app).post(`/api/v1/admin/users/${athleteId}/send-verification-email`),
    );
    expect(verification.status).toBe(400);
    expect(verification.body).toMatchObject({ error: { code: "USER_ALREADY_VERIFIED" } });

    const adminTarget = await asAdmin(
      request(app).post(`/api/v1/admin/users/${coAdminId}/send-password-reset`),
    );
    expect(adminTarget.status).toBe(403);
  });
});
