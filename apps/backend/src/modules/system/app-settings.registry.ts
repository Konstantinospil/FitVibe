import { z } from "zod";
import { AUTH_SECURITY_POLICY } from "../../config/security-policy.js";

export type SettingActivation = "restart";
export type SettingCategory = "security" | "privacy" | "operations" | "moderation" | "content";

export interface AppSettingDefinition<T> {
  key: string;
  description: string;
  category: SettingCategory;
  sensitive: boolean;
  activation: SettingActivation;
  schema: z.ZodType<T>;
  defaultValue: T;
}

export const APP_SETTINGS_REGISTRY = {
  "auth.password_min_length": {
    key: "auth.password_min_length",
    description: "Minimum accepted password length; cannot be lower than the coded security floor",
    category: "security",
    sensitive: false,
    activation: "restart",
    schema: z.number().int().min(AUTH_SECURITY_POLICY.password.minLengthFloor).max(128),
    defaultValue: AUTH_SECURITY_POLICY.password.minLengthFloor,
  },
  "security.global_rate_limit_points": {
    key: "security.global_rate_limit_points",
    description: "Maximum requests per global API rate-limit window",
    category: "security",
    sensitive: false,
    activation: "restart",
    schema: z.number().int().min(1).max(100000),
    defaultValue: 120,
  },
  "security.global_rate_limit_duration_seconds": {
    key: "security.global_rate_limit_duration_seconds",
    description: "Global API rate-limit window in seconds",
    category: "security",
    sensitive: false,
    activation: "restart",
    schema: z.number().int().min(1).max(86400),
    defaultValue: 60,
  },
  "auth.email_verification_ttl_minutes": {
    key: "auth.email_verification_ttl_minutes",
    description: "Lifetime of email-verification tokens in minutes",
    category: "security",
    sensitive: false,
    activation: "restart",
    schema: z.number().int().min(5).max(1440),
    defaultValue: 15,
  },
  "auth.password_reset_ttl_minutes": {
    key: "auth.password_reset_ttl_minutes",
    description: "Lifetime of password-reset tokens in minutes",
    category: "security",
    sensitive: false,
    activation: "restart",
    schema: z.number().int().min(5).max(1440),
    defaultValue: 15,
  },
  "privacy.dsr_purge_delay_minutes": {
    key: "privacy.dsr_purge_delay_minutes",
    description: "Delay before scheduled account-data purge",
    category: "privacy",
    sensitive: false,
    activation: "restart",
    schema: z.number().int().min(0).max(10080),
    defaultValue: 15,
  },
  "privacy.dsr_backup_purge_days": {
    key: "privacy.dsr_backup_purge_days",
    description: "Retention period for deletion backup material",
    category: "privacy",
    sensitive: false,
    activation: "restart",
    schema: z.number().int().min(1).max(365),
    defaultValue: 14,
  },
  "system.maintenance_message": {
    key: "system.maintenance_message",
    description: "Message shown while FitVibe is in maintenance/read-only mode",
    category: "content",
    sensitive: false,
    activation: "restart",
    schema: z.string().trim().min(1).max(500),
    defaultValue: "System is temporarily in read-only mode for maintenance",
  },
  "moderation.feed_blocked_keywords": {
    key: "moderation.feed_blocked_keywords",
    description: "Case-insensitive keywords blocked from public feed content",
    category: "moderation",
    sensitive: false,
    activation: "restart",
    schema: z.array(z.string().trim().min(1).max(80)).max(500),
    defaultValue: [] as string[],
  },
} satisfies Record<string, AppSettingDefinition<unknown>>;

export type AppSettingKey = keyof typeof APP_SETTINGS_REGISTRY;

export function isAppSettingKey(key: string): key is AppSettingKey {
  return Object.hasOwn(APP_SETTINGS_REGISTRY, key);
}

export function validateAppSetting(key: AppSettingKey, value: unknown): unknown {
  return APP_SETTINGS_REGISTRY[key].schema.parse(value);
}

export function getDefaultSettings(): Record<string, unknown> {
  return Object.fromEntries(
    Object.values(APP_SETTINGS_REGISTRY).map((definition) => [
      definition.key,
      definition.defaultValue,
    ]),
  );
}
