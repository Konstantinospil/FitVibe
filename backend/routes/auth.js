import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "../db.js"; // single DB import
import { isStrongPassword, cleanUsername } from "../utils/validators.js";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "refreshsecret";
const ACCESS_EXPIRES_IN = "15m";
const REFRESH_EXPIRES_IN = "7d";

// Utility: create tokens
function generateTokens(user) {
  const accessToken = jwt.sign({ sub: user.id }, JWT_SECRET, {
    expiresIn: ACCESS_EXPIRES_IN,
  });
  const refreshToken = jwt.sign({ sub: user.id, typ: "refresh" }, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES_IN,
  });
  return { accessToken, refreshToken };
}

// --- Register ---
router.post("/register", async (req, res) => {
  try {
    const { username, password, sex = null, weight_kg = null, fitness_level = null, age = null } =
      req.body || {};

    const uname = cleanUsername(username);
    if (!uname) return res.status(400).json({ error: "Invalid username" });
    if (!isStrongPassword(password)) return res.status(400).json({ error: "Weak password" });

    const exists = await db("users").where({ username: uname }).first();
    if (exists) return res.status(409).json({ error: "Username taken" });

    const hash = await bcrypt.hash(password, 12);
    const [user] = await db("users")
      .insert({ username: uname, password_hash: hash, status: "active" })
      .returning("*");

    await db("user_profiles").insert({
      user_id: user.id,
      display_name: uname,
      sex,
      weight_kg,
      fitness_level,
      age,
    });

    res.status(201).json({ id: user.id, username: user.username });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Registration failed" });
  }
});

// --- Login ---
router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  const user = await db("users")
    .where({ username: String(username || "").toLowerCase() })
    .first();
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password || "", user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const tokens = generateTokens(user);

  await db("auth_sessions").insert({
    user_id: user.id,
    token: tokens.refreshToken,
    expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000),
  });

  res.json(tokens);
});

// --- Refresh ---
router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: "No token provided" });

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const session = await db("auth_sessions")
      .where({ token: refreshToken, user_id: decoded.sub })
      .first();
    if (!session) return res.status(401).json({ error: "Invalid session" });

    const user = await db("users").where({ id: decoded.sub }).first();
    if (!user) return res.status(401).json({ error: "User not found" });

    const tokens = generateTokens(user);

    // rotate refresh token
    await db("auth_sessions").where({ id: session.id }).del();
    await db("auth_sessions").insert({
      user_id: user.id,
      token: tokens.refreshToken,
      expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    });

    res.json(tokens);
  } catch (err) {
    console.error("Refresh error:", err);
    res.status(401).json({ error: "Invalid refresh token" });
  }
});

// --- Logout ---
router.post("/logout", async (req, res) => {
  const { refreshToken } = req.body || {};
  if (refreshToken) await db("auth_sessions").where({ token: refreshToken }).del();
  res.json({ ok: true });
});

export default router;