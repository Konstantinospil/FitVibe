#!/usr/bin/env node
/**
 * Create an admin user for the FitVibe backoffice (local / bootstrap use).
 *
 * Usage:
 *   ADMIN_PASSWORD='your-secure-password' node scripts/create-admin-user.mjs
 *
 * Optional env:
 *   ADMIN_USERNAME (default: administrator1)
 *   ADMIN_EMAIL (default: admin@fitvibe.local)
 *   ADMIN_DISPLAY_NAME (default: Administrator)
 */

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "../apps/backend/src/db/connection.js";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "administrator1";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@fitvibe.local";
const ADMIN_DISPLAY_NAME = process.env.ADMIN_DISPLAY_NAME ?? "Administrator";
const ADMIN_ROLE = "admin";
const ADMIN_STATUS = "active";

async function createAdminUser() {
  if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 16) {
    console.error("Set ADMIN_PASSWORD in the environment (min 16 characters).");
    process.exit(1);
  }

  try {
    console.log("Creating admin user...");

    const existingUser = await db("users")
      .where("username", ADMIN_USERNAME)
      .orWhere("username", ADMIN_USERNAME.toLowerCase())
      .first();

    if (existingUser) {
      console.log(`User ${ADMIN_USERNAME} already exists. Skipping creation.`);
      return;
    }

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    const adminRole = await db("roles").where("code", ADMIN_ROLE).first();
    if (!adminRole) {
      console.log("Creating admin role...");
      await db("roles").insert({
        code: ADMIN_ROLE,
        description: "Platform administrator",
        created_at: now,
      });
    }

    await db.transaction(async (trx) => {
      await trx("users").insert({
        id: userId,
        username: ADMIN_USERNAME,
        display_name: ADMIN_DISPLAY_NAME,
        locale: "en-US",
        preferred_lang: "en",
        status: ADMIN_STATUS,
        role_code: ADMIN_ROLE,
        password_hash: passwordHash,
        created_at: now,
        updated_at: now,
      });

      await trx("user_contacts").insert({
        id: crypto.randomUUID(),
        user_id: userId,
        type: "email",
        value: ADMIN_EMAIL.toLowerCase(),
        is_primary: true,
        is_recovery: true,
        is_verified: true,
        verified_at: now,
        created_at: now,
      });

      await trx("profiles").insert({
        user_id: userId,
        visibility: "private",
        unit_preferences: {},
        created_at: now,
        updated_at: now,
      });
    });

    console.log("Admin user created successfully.");
    console.log(`   Username: ${ADMIN_USERNAME}`);
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Role: ${ADMIN_ROLE}`);
  } catch (error) {
    console.error("Error creating admin user:", error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

createAdminUser();
