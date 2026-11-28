import nodemailer from "nodemailer";
import type { Transporter, SentMessageInfo } from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { captureMail } from "./mail-capture.service.js";

export interface MailMessage {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export class MailerService {
  private transporter: Transporter<SentMessageInfo> | null = null;

  constructor() {
    if (env.email.enabled) {
      this.initializeTransporter();
    }
  }

  private initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        host: env.email.smtp.host,
        port: env.email.smtp.port,
        secure: env.email.smtp.secure,
        auth: {
          user: env.email.smtp.user,
          pass: env.email.smtp.pass,
        },
      });
      logger.info("[mailer] SMTP transporter initialized");
    } catch (error) {
      logger.error({ err: error }, "[mailer] Failed to initialize SMTP transporter");
      this.transporter = null;
    }
  }

  async send(message: MailMessage): Promise<void> {
    captureMail(message);

    if (!env.email.enabled) {
      logger.debug(
        { to: message.to, subject: message.subject },
        "[mailer] Email disabled, skipping send",
      );
      return;
    }

    if (!this.transporter) {
      logger.error("[mailer] Transporter not initialized, cannot send email");
      throw new Error("EMAIL_SERVICE_UNAVAILABLE");
    }

    try {
      const rawResult: unknown = await this.transporter.sendMail({
        from: `${env.email.from.name} <${env.email.from.email}>`,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });

      const infoRecord =
        typeof rawResult === "object" && rawResult !== null
          ? (rawResult as Record<string, unknown>)
          : {};

      const messageId = typeof infoRecord.messageId === "string" ? infoRecord.messageId : null;

      logger.info(
        {
          messageId,
          to: message.to,
          subject: message.subject,
        },
        "[mailer] Email sent successfully",
      );
    } catch (error) {
      logger.error(
        {
          err: error,
          to: message.to,
          subject: message.subject,
        },
        "[mailer] Failed to send email",
      );
      throw error;
    }
  }

  async verify(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      logger.info("[mailer] SMTP connection verified");
      return true;
    } catch (error) {
      logger.error({ err: error }, "[mailer] SMTP verification failed");
      return false;
    }
  }
}

// Export a singleton instance
export const mailerService = new MailerService();
