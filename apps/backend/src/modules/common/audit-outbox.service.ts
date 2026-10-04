import { db } from "../../db/connection.js";
import { logger } from "../../config/logger.js";

export interface AuditOutboxPayload {
  id: string;
  actor_user_id: string | null;
  entity_type: string;
  action: string;
  entity_id: string | null;
  outcome: string;
  request_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function persistAuditOutbox(
  payload: AuditOutboxPayload,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await db("audit_outbox").insert({
    id: payload.id,
    payload,
    last_error: message,
    attempt_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function flushAuditOutbox(limit = 100): Promise<number> {
  const rows = (await db("audit_outbox")
    .select(["id", "payload", "attempt_count"])
    .orderBy("created_at", "asc")
    .limit(limit)) as Array<{
    id: string;
    payload: AuditOutboxPayload;
    attempt_count: number;
  }>;

  let flushed = 0;
  for (const row of rows) {
    try {
      await db("audit_log").insert(row.payload).onConflict("id").ignore();
      await db("audit_outbox").where({ id: row.id }).del();
      flushed += 1;
    } catch (error) {
      await db("audit_outbox")
        .where({ id: row.id })
        .update({
          attempt_count: row.attempt_count + 1,
          last_error: error instanceof Error ? error.message : String(error),
          updated_at: new Date().toISOString(),
        });
      logger.error({ err: error, auditOutboxId: row.id }, "[AUDIT] outbox replay failed");
    }
  }
  return flushed;
}
