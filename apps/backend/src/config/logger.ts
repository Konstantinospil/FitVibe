import pino, { type LoggerOptions } from "pino";

const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["set-cookie"]',
  'res.headers["set-cookie"]',
  "req.body.password",
  "req.body.currentPassword",
  "req.body.newPassword",
  "req.body.confirmPassword",
  "req.body.passwordConfirmation",
  "req.body.token",
  "req.body.accessToken",
  "req.body.refreshToken",
  "req.query.token",
  "req.query.accessToken",
  "req.query.refreshToken",
  "*.password",
  "*.passwordHash",
  "*.accessToken",
  "*.refreshToken",
  "*.token",
  "*.secret",
  "*.email",
];

const baseConfig: LoggerOptions = {
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  redact: {
    paths: REDACT_PATHS,
    censor: "[REDACTED]",
  },
};

if (
  process.env.CI !== "true" &&
  process.env.NODE_ENV !== "development" &&
  process.env.NODE_ENV !== "test"
) {
  baseConfig.transport = {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      singleLine: true,
    },
  };
}

export const logger = pino(baseConfig);
