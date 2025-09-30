import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import morgan from "morgan";
import db from "./db.js";
import auth from "./routes/auth.js";
import exercises from "./routes/exercises.js";
import sessions from "./routes/sessions.js";
import feed from "./routes/feed.js";
import account from "./routes/account.js";

const app = express();
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.BASE_CLIENT_URL || "http://localhost:5173", credentials: true }));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(morgan("dev"));

app.get("/health", async (_req, res) => {
  try {
    await db.raw("select 1");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.use("/api/v1/auth", auth);
app.use("/api/v1/exercises", exercises);
app.use("/api/v1/sessions", sessions);
app.use("/api/v1/feed", feed);
app.use("/api/v1/account", account);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API on :" + PORT));