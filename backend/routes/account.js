import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import knex from "../db/knex.js";
import { requireAuth } from "../utils/auth.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Get account details
router.get("/", requireAuth, async (req, res) => {
  try {
    const profile = await knex("user_state").where({ user_id: req.user.id }).first();
    const badges = await knex("badges")
      .where({ user_id: req.user.id })
      .orderBy("awarded_at", "desc");

    res.json({ profile, badges });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load account" });
  }
});

// Update profile (non-static info)
router.put("/", requireAuth, async (req, res) => {
  try {
    const { alias, weight, fitness_level } = req.body || {};
    await knex("user_state")
      .where({ user_id: req.user.id })
      .update({
        alias,
        weight,
        fitness_level,
        updated_at: knex.fn.now(),
      });

    const updated = await knex("user_state").where({ user_id: req.user.id }).first();
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// Show calendar sessions
router.get("/sessions", requireAuth, async (req, res) => {
  try {
    const sessions = await knex("sessions")
      .where({ owner_user_id: req.user.id })
      .select("id", "title", "planned_for", "completed_at", "status", "points_total")
      .orderBy("planned_for", "asc");

    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load sessions" });
  }
});

// 1. Upload Avatar
router.post("/avatar", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const userId = req.user.id;
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const ext = path.extname(req.file.originalname);
    const newPath = `uploads/${userId}_avatar${ext}`;
    fs.renameSync(req.file.path, newPath);

    const photoUrl = `/${newPath}`;

    await knex("user_state")
      .update({ photo_url: photoUrl, updated_at: knex.fn.now() })
      .where({ user_id: userId });

    res.json({ url: photoUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// 2. Add Recovery Email
router.post("/recovery-email", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: "Email required" });

    await knex("user_contacts").insert({
      user_id: userId,
      type: "recovery",
      value: email,
      is_verified: false,
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add recovery email" });
  }
});

// 3. Delete Account
router.delete("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    await knex("users").where({ id: userId }).del();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;
